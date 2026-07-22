import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-key, x-api-key',
};

const RATE_LIMIT_RPM = 100;

async function isRateLimited(supabase: any, affiliateId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('affiliate_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', 'get-leads')
    .eq('affiliate_id', affiliateId)
    .gte('created_at', windowStart);
  return (count ?? 0) >= RATE_LIMIT_RPM;
}

// Invalid-API-key attempts are logged with affiliate_id: null, so they never
// count against isRateLimited() above — without this, brute-forcing API keys
// is completely unthrottled. Bucket those by request IP instead.
const INVALID_KEY_RATE_LIMIT_PER_IP = 20;
async function isIpRateLimitedForInvalidKeys(supabase: any, clientIp: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('affiliate_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', 'get-leads')
    .is('affiliate_id', null)
    .eq('request_ip', clientIp)
    .gte('created_at', windowStart);
  return (count ?? 0) >= INVALID_KEY_RATE_LIMIT_PER_IP;
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept POST for health check
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.health_check === true) {
        return new Response(JSON.stringify({ status: "ok", function: "get-leads" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // Not a health check, fall through
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const apiKey = req.headers.get('Api-Key') || req.headers.get('api-key') || req.headers.get('X-Api-Key');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Api-Key header is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientIp = getClientIp(req);

    if (await isIpRateLimitedForInvalidKeys(supabase, clientIp)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Too many invalid API key attempts. Try again later.',
          rejection: { code: 'RATE_LIMITED', message: 'Too many invalid API key attempts from this IP' }
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (affiliateError || !affiliate) {
      try {
        await supabase.from('affiliate_api_logs').insert({
          affiliate_id: null,
          endpoint: 'get-leads',
          api_key_hint: apiKey.slice(-4),
          request_ip: clientIp,
          payload: null,
          status: 'rejected',
          reason: 'Invalid or inactive API key',
        });
      } catch { /* non-critical */ }
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: max 100 requests per minute per affiliate
    if (await isRateLimited(supabase, affiliate.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Rate limit exceeded. Maximum 100 requests per minute.',
          rejection: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' }
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');
    const hasFTD = url.searchParams.get('hasFTD');
    const status = url.searchParams.get('status');
    const email = url.searchParams.get('email');
    const leadId = url.searchParams.get('lead_id');
    const includeRejected = url.searchParams.get('includeRejected');

    // Pagination — page is 0-indexed, limit capped at 1000
    const page = Math.max(0, parseInt(url.searchParams.get('page') || '0'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '500')), 1000);
    const offset = page * limit;

    if (!fromDate || !toDate) {
      return new Response(
        JSON.stringify({ success: false, message: 'fromDate and toDate are required (MM/DD/YY)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse dates — accepts MM/DD/YY, MM/DD/YYYY, MM-DD-YY, MM-DD-YYYY
    const parseDate = (dateStr: string) => {
      const [month, day, yearRaw] = dateStr.split(/[-\/]/);
      const year = parseInt(yearRaw) < 100 ? 2000 + parseInt(yearRaw) : parseInt(yearRaw);
      return new Date(year, parseInt(month) - 1, parseInt(day));
    };

    const startDate = parseDate(fromDate);
    const endDate = parseDate(toDate);
    endDate.setHours(23, 59, 59, 999);

    // Build query
    let query = supabase
      .from('leads')
      .select('id, request_id, firstname, lastname, email, country_code, mobile, status, sale_status, is_ftd, ftd_date, ftd_released, created_at', { count: 'exact' })
      .eq('affiliate_id', affiliate.id)
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Exclude rejected by default
    if (includeRejected !== '1') {
      query = query.neq('status', 'rejected');
    }

    // Apply filters
    // Filter on ftd_released, not the raw is_ftd column — the response
    // below reports is_ftd based on ftd_released (a lead can be flagged
    // FTD internally before being manually released), so the filter must
    // match that same field or hasFTD=1/0 would silently disagree with
    // what the response payload actually shows.
    if (hasFTD === '1') {
      query = query.eq('ftd_released', true);
    } else if (hasFTD === '0') {
      query = query.eq('ftd_released', false);
    }

    if (status) {
      query = query.eq('sale_status', status);
    }

    if (email) {
      query = query.eq('email', email.toLowerCase());
    }

    if (leadId) {
      query = query.eq('id', leadId);
    }

    const { data: leads, error, count } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to fetch leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response - affiliates see sale_status from advertiser, FTD only if released
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      lead_code: lead.request_id,
      firstname: lead.firstname,
      lastname: lead.lastname,
      email: lead.email,
      country_code: lead.country_code,
      mobile: lead.mobile,
      status: lead.sale_status || 'New',
      sale_status: lead.sale_status || 'New',
      is_ftd: lead.ftd_released ? 1 : 0,
      ftd_date: lead.ftd_released ? lead.ftd_date : null,
      created_at: lead.created_at,
    }));

    try {
      await supabase.from('affiliate_api_logs').insert({
        affiliate_id: affiliate.id,
        endpoint: 'get-leads',
        api_key_hint: apiKey.slice(-4),
        request_ip: clientIp,
        payload: null,
        status: 'accepted',
        reason: null,
      });
    } catch { /* non-critical */ }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Leads fetched successfully',
        total: count ?? formattedLeads.length,
        page,
        limit,
        pages: count ? Math.ceil(count / limit) : 1,
        count: formattedLeads.length,
        data: formattedLeads,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
