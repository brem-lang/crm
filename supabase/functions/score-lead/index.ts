import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  isp: string;
  as: string;
  proxy: boolean;
  hosting: boolean;
}

async function lookupIp(ip: string | null): Promise<IpApiResponse | null> {
  if (!ip || ip === 'unknown') return null;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,isp,as,proxy,hosting`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data: IpApiResponse = await res.json();
    return data.status === 'success' ? data : null;
  } catch {
    return null;
  }
}

function computeScore(params: {
  submissionIp: string | null;
  clickIp: string | null;
  submissionCountry: string | null;
  clickCountry: string | null;
  submissionAsn: string | null;
  clickAsn: string | null;
  isProxy: boolean;
  timeToClick: number | null;
  submissionUa: string | null;
  clickUa: string | null;
}): number {
  let score = 0;

  // IP exact match: 25 pts
  if (params.clickIp && params.submissionIp && params.clickIp === params.submissionIp) {
    score += 25;
  }

  // Country match: 20 pts
  if (params.clickCountry && params.submissionCountry && params.clickCountry === params.submissionCountry) {
    score += 20;
  }

  // ASN/ISP match: 15 pts
  if (params.clickAsn && params.submissionAsn && params.clickAsn === params.submissionAsn) {
    score += 15;
  }

  // No VPN/proxy: 20 pts
  if (!params.isProxy) {
    score += 20;
  }

  // Time to click > 5 seconds: 10 pts
  if (params.timeToClick !== null && params.timeToClick !== undefined && params.timeToClick > 5) {
    score += 10;
  }

  // User agent match: 10 pts
  if (params.clickUa && params.submissionUa && params.clickUa === params.submissionUa) {
    score += 10;
  }

  return score;
}

function scoreToStatus(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'orange';
  if (score >= 40) return 'light-red';
  return 'red';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const lead_id: string | undefined = body?.lead_id;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lead fields needed for scoring
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, ip_address, user_agent, click_ip, click_ua, time_to_click')
      .eq('id', lead_id)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run both IP lookups in parallel to keep latency low
    const [submissionData, clickData] = await Promise.all([
      lookupIp(lead.ip_address),
      lookupIp(lead.click_ip),
    ]);

    const submissionCountry = submissionData?.countryCode || null;
    const submissionAsn     = submissionData?.as || null;
    const isProxy           = submissionData ? (submissionData.proxy || submissionData.hosting) : false;
    const clickCountry      = clickData?.countryCode || null;
    const clickAsn          = clickData?.as || null;

    const score  = computeScore({
      submissionIp:      lead.ip_address,
      clickIp:           lead.click_ip,
      submissionCountry,
      clickCountry,
      submissionAsn,
      clickAsn,
      isProxy,
      timeToClick:  lead.time_to_click,
      submissionUa: lead.user_agent,
      clickUa:      lead.click_ua,
    });

    const status = scoreToStatus(score);

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        submission_country: submissionCountry,
        submission_asn:     submissionAsn,
        click_country:      clickCountry,
        click_asn:          clickAsn,
        is_proxy:           isProxy,
        live_lead_score:    score,
        live_lead_status:   status,
      })
      .eq('id', lead_id);

    if (updateError) {
      console.error('score-lead update error:', updateError);
    }

    return new Response(JSON.stringify({ score, status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('score-lead unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
