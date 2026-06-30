import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// track-autologin — captures click-time signals, scores the lead, then redirects.
//
// The affiliate redirects the real user to:
//   GET /functions/v1/track-autologin?lead_id=<uuid>
//
// This endpoint:
//  1. Captures click IP + UA from request headers
//  2. Computes time_to_click (seconds since lead was created)
//  3. Persists click_ip, click_ua, time_to_click on the lead
//  4. Calls score-lead synchronously so the score is ready immediately
//  5. 302-redirects the user to the real advertiser autologin URL

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parsePlatform(ua: string): string {
  if (/windows/i.test(ua))  return 'Windows';
  if (/iphone/i.test(ua))   return 'iPhone';
  if (/ipad/i.test(ua))     return 'iPad';
  if (/android/i.test(ua))  return 'Android';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua))    return 'Linux';
  return 'Other';
}

function parseBrowser(ua: string): string {
  if (/edg\//i.test(ua))     return 'Edge';
  if (/opr\//i.test(ua))     return 'Opera';
  if (/chrome\//i.test(ua))  return 'Chrome';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/safari\//i.test(ua))  return 'Safari';
  if (/msie|trident/i.test(ua)) return 'IE';
  return 'Other';
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Accept lead_id from query string (GET redirect) or JSON body (POST)
  let lead_id: string | null = null;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    lead_id = url.searchParams.get('lead_id');
  } else {
    try {
      const body = await req.json();
      lead_id = body?.lead_id ?? null;
    } catch { /* ignore */ }
  }

  if (!lead_id) {
    return new Response('Missing lead_id', { status: 400, headers: corsHeaders });
  }

  // Fetch lead — need created_at and autologin URL
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, created_at, autologin')
    .eq('id', lead_id)
    .maybeSingle();

  if (leadError || !lead) {
    return new Response('Lead not found', { status: 404, headers: corsHeaders });
  }

  // If leads.autologin is not set, fall back to lead_distributions.autologin_url.
  // Exclude tracking URLs to prevent redirect loops.
  if (!lead.autologin) {
    const { data: dist } = await supabase
      .from('lead_distributions')
      .select('autologin_url')
      .eq('lead_id', lead_id)
      .eq('status', 'sent')
      .not('autologin_url', 'like', '%track-autologin%')
      .not('autologin_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dist?.autologin_url) {
      lead.autologin = dist.autologin_url;
      // Backfill leads.autologin so future clicks don't need this fallback
      await supabase
        .from('leads')
        .update({ autologin: dist.autologin_url })
        .eq('id', lead_id);
    }
  }

  // Capture click signals from request
  const clickIp = getClientIp(req);
  const clickUa = req.headers.get('user-agent') || null;
  const timeToClick = Math.round(
    (Date.now() - new Date(lead.created_at).getTime()) / 1000
  );
  const platform = clickUa ? parsePlatform(clickUa) : null;
  const browser  = clickUa ? parseBrowser(clickUa)  : null;

  // Persist click data on the lead
  const { error: updateError } = await supabase
    .from('leads')
    .update({
      click_ip:      clickIp !== 'unknown' ? clickIp : null,
      click_ua:      clickUa,
      time_to_click: timeToClick,
      platform,
      browser,
    })
    .eq('id', lead_id);

  if (updateError) {
    console.error('track-autologin: failed to update click data:', updateError);
  }

  // Call score-lead synchronously — lead is mid-redirect, score before they land
  try {
    await fetch(`${supabaseUrl}/functions/v1/score-lead`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ lead_id }),
    });
  } catch (err) {
    console.error('track-autologin: score-lead call failed:', err);
  }

  // Redirect to the real advertiser autologin URL
  const destination = lead.autologin;

  if (!destination) {
    return new Response(
      'No autologin URL available for this lead.',
      { status: 404, headers: corsHeaders }
    );
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': destination,
    },
  });
});
