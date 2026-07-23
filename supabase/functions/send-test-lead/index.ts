import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// send-test-lead — admin-scoped. Wraps distribute-lead's test_mode flow
// (the same one the "Send Test Lead" dialog on the Advertisers page uses)
// behind admin_api_keys auth, so a test lead can be triggered
// programmatically for a specific advertiser instead of through the UI.
// Authenticated with the same admin_api_keys key as get-all-leads.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api-key, x-api-key',
};

const ENDPOINT = 'send-test-lead';
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

const REQUIRED_FIELDS = ['advertiser_id', 'firstname', 'lastname', 'email', 'mobile', 'country_code', 'ip_address'];

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

    // Validate required fields — the UI dialog does this client-side, but
    // there's no UI here so it must be enforced server-side.
    const missing = REQUIRED_FIELDS.filter((f) => !body[f]);
    if (missing.length > 0) {
      try {
        await supabase.from('affiliate_api_logs').insert({
          affiliate_id: null,
          endpoint: ENDPOINT,
          api_key_hint: apiKey.slice(-4),
          request_ip: clientIp,
          payload: null,
          status: 'rejected',
          reason: `Missing required fields: ${missing.join(', ')}`,
        });
      } catch { /* non-critical */ }
      return new Response(
        JSON.stringify({ success: false, message: `Missing required fields: ${missing.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testLeadData = {
      firstname: body.firstname,
      lastname: body.lastname,
      email: body.email,
      mobile: body.mobile,
      country_code: body.country_code,
      country: body.country ?? null,
      ip_address: body.ip_address,
      offer_name: body.offer_name ?? undefined,
      custom1: body.custom1 ?? undefined,
      custom2: body.custom2 ?? undefined,
      custom3: body.custom3 ?? undefined,
      locale: body.locale ?? undefined,
      password: body.password ?? undefined,
      currency: body.currency ?? undefined,
    };

    // Delegate to distribute-lead's existing test_mode flow (same one the
    // "Send Test Lead" dialog uses) — reuses its advertiser lookup, working
    // hours check, adapter dispatch, and test_lead_logs/rejected_leads
    // bookkeeping instead of duplicating it here.
    const distributeResponse = await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        test_mode: true,
        advertiser_id: body.advertiser_id,
        test_lead_data: testLeadData,
        user_id: null,
      }),
    });

    const distributeResult = await distributeResponse.json().catch(() => ({
      success: false,
      message: 'Failed to parse distribute-lead response',
    }));

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
      JSON.stringify(distributeResult),
      { status: distributeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('send-test-lead error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
