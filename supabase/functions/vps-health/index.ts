const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VPS_URL = "https://backend.marketlinkco.live";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let online = false;
    let statusCode = 0;

    try {
      const res = await fetch(VPS_URL, { method: "HEAD", signal: controller.signal });
      statusCode = res.status;
      online = res.status < 500;
    } catch {
      online = false;
    } finally {
      clearTimeout(timeout);
    }

    return new Response(
      JSON.stringify({
        overall_status: online ? "online" : "offline",
        status_code: statusCode,
        url: VPS_URL,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ overall_status: "offline", error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
