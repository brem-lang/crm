import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// get-all-advertisers — admin-scoped, system-wide advertisers export.
// Authenticated with the same admin_api_keys key as get-all-leads.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-key, x-api-key',
};

const ENDPOINT = 'get-all-advertisers';
const RATE_LIMIT_RPM = 100;
const INVALID_KEY_RATE_LIMIT_PER_IP = 20;

async function isIpRateLimited(supabase: any, clientIp: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('affiliate_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', ENDPOINT)
    .eq('status', 'accepted')
    .eq('request_ip', clientIp)
    .gte('created_at', windowStart);
  return (count ?? 0) >= RATE_LIMIT_RPM;
}

async function isIpRateLimitedForInvalidKeys(supabase: any, clientIp: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('affiliate_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', ENDPOINT)
    .eq('status', 'rejected')
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

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.health_check === true) {
        return new Response(JSON.stringify({ status: "ok", function: ENDPOINT }), {
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

    const { data: keyRow, error: keyError } = await supabase
      .from('admin_api_keys')
      .select('id')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (keyError || !keyRow) {
      try {
        await supabase.from('affiliate_api_logs').insert({
          affiliate_id: null,
          endpoint: ENDPOINT,
          api_key_hint: apiKey.slice(-4),
          request_ip: clientIp,
          payload: null,
          status: 'rejected',
          reason: 'Invalid or inactive admin API key',
        });
      } catch { /* non-critical */ }
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (await isIpRateLimited(supabase, clientIp)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Rate limit exceeded. Maximum 100 requests per minute.',
          rejection: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' }
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const isActive = url.searchParams.get('is_active');
    const advertiserType = url.searchParams.get('advertiser_type');
    const name = url.searchParams.get('name');
    const since = url.searchParams.get('since');
    const afterId = url.searchParams.get('after_id');

    const page = Math.max(0, parseInt(url.searchParams.get('page') || '0'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '500')), 1000);
    const offset = page * limit;

    let cursorRow: { updated_at: string } | null = null;
    if (afterId) {
      const { data: row, error: cursorError } = await supabase
        .from('advertisers')
        .select('updated_at')
        .eq('id', afterId)
        .maybeSingle();
      if (cursorError || !row) {
        return new Response(
          JSON.stringify({ success: false, message: 'after_id does not match any advertiser' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      cursorRow = row;
    } else if (since) {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return new Response(
          JSON.stringify({ success: false, message: 'since must be a valid ISO timestamp' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let query = supabase
      .from('advertisers')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (cursorRow) {
      query = query.or(`updated_at.gt.${cursorRow.updated_at},and(updated_at.eq.${cursorRow.updated_at},id.gt.${afterId})`);
    } else if (since) {
      query = query.gte('updated_at', new Date(since).toISOString());
    }

    if (isActive === '1') query = query.eq('is_active', true);
    else if (isActive === '0') query = query.eq('is_active', false);

    if (advertiserType) query = query.eq('advertiser_type', advertiserType);

    if (name) query = query.ilike('name', `%${name}%`);

    const { data: advertisers, error, count } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to fetch advertisers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { count: allAdvertisersCount } = await supabase
      .from('advertisers')
      .select('*', { count: 'exact', head: true });

    try {
      await supabase.from('affiliate_api_logs').insert({
        affiliate_id: null,
        endpoint: ENDPOINT,
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
        message: 'Advertisers fetched successfully',
        total: count ?? advertisers.length,
        all_advertisers_count: allAdvertisersCount ?? null,
        page,
        limit,
        pages: count ? Math.ceil(count / limit) : 1,
        count: advertisers.length,
        next_cursor: advertisers.length ? advertisers[advertisers.length - 1].id : (afterId ?? null),
        next_since: advertisers.length ? advertisers[advertisers.length - 1].updated_at : (since ?? null),
        data: advertisers,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-all-advertisers error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
