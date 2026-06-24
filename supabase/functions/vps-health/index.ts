const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VPS_BASE = "https://backend.marketlinkco.live/proxy";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Health endpoint is not returning JSON — check if health.php exists on the VPS");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type } = await req.json() as { type?: string };

    if (type === "version") {
      const data = await fetchJson(`${VPS_BASE}/version.php`) as Record<string, unknown>;
      return new Response(JSON.stringify({ version: data.version || "Unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await fetchJson(`${VPS_BASE}/health.php`);
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
