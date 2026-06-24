const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VPS_HOST = "backend.marketlinkco.live";
const VPS_BASE = `http://174.138.179.173/proxy`;
const VPS_HEADERS = { "Host": VPS_HOST };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type } = await req.json() as { type?: string };

    if (type === "version") {
      const res = await fetch(`${VPS_BASE}/version.php`, {
        headers: VPS_HEADERS,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify({ version: data.version || "Unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: health
    const res = await fetch(`${VPS_BASE}/health.php`, { headers: VPS_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        overall_status: "offline",
        services: {},
        system: {},
        recent_errors: [],
        error: message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
