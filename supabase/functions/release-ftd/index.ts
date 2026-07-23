import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// release-ftd — admin-scoped. Mirrors the "Release FTD" action on the
// Conversions page (marks a lead's FTD as released to the affiliate) as
// an API call instead of a UI click. Authenticated with the same
// admin_api_keys key as get-all-leads/send-test-lead.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-key, x-api-key',
};

const ENDPOINT = 'release-ftd';
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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (body?.health_check === true) {
    return new Response(JSON.stringify({ status: "ok", function: ENDPOINT }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    const leadId = body.lead_id as string | undefined;
    if (!leadId) {
      try {
        await supabase.from('affiliate_api_logs').insert({
          affiliate_id: null,
          endpoint: ENDPOINT,
          api_key_hint: apiKey.slice(-4),
          request_ip: clientIp,
          payload: null,
          status: 'rejected',
          reason: 'Missing required field: lead_id',
        });
      } catch { /* non-critical */ }
      return new Response(
        JSON.stringify({ success: false, message: 'lead_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, is_ftd, ftd_released')
      .eq('id', leadId)
      .is('deleted_at', null)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ success: false, message: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lead.is_ftd) {
      return new Response(
        JSON.stringify({ success: false, message: 'Lead is not flagged as FTD' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (lead.ftd_released) {
      return new Response(
        JSON.stringify({ success: false, message: 'FTD already released' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const releasedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('leads')
      .update({ ftd_released: true, ftd_released_at: releasedAt })
      .eq('id', leadId);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to release FTD' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        message: 'FTD released to affiliate',
        lead_id: leadId,
        ftd_released_at: releasedAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('release-ftd error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
