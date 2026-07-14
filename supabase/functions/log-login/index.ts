import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// log-login — records a login/logout audit_logs row with the real client IP
// and ip-api.com geolocation (country/city/isp). Called from useAuth.tsx
// right after sign-in and right before sign-out, since the browser itself
// has no reliable way to know its own public IP — this needs the request's
// own headers, which only exist server-side.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Private/internal ranges — Docker bridge networks and other non-routable
// hops end up in X-Forwarded-For when a proxy appends its own address
// instead of only the original client. Skip these when picking the client IP.
function isPrivateIp(ip: string): boolean {
  return (
    /^10\./.test(ip) ||
    /^127\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === "::1" ||
    /^f[cd][0-9a-f]{2}:/i.test(ip)
  );
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidates = forwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    const publicIp = candidates.find((ip) => !isPrivateIp(ip));
    if (publicIp) return publicIp;
  }

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && !isPrivateIp(cfIp)) return cfIp;

  const realIp = req.headers.get("x-real-ip");
  if (realIp && !isPrivateIp(realIp)) return realIp;

  return "unknown";
}

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  city: string;
  isp: string;
  as: string;
  proxy: boolean;
  hosting: boolean;
}

async function lookupIp(ip: string): Promise<IpApiResponse | null> {
  if (!ip || ip === "unknown") return null;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,isp,as,proxy,hosting`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data: IpApiResponse = await res.json();
    return data.status === "success" ? data : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "log-login" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action: string = body?.action;
    if (action !== "login" && action !== "logout") {
      return new Response(JSON.stringify({ error: "action must be 'login' or 'logout'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = getClientIp(req);
    const geo = await lookupIp(ip);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action,
      changes_summary: `User signed ${action === "login" ? "in" : "out"}: ${user.email}`,
      request_path: body?.request_path ?? null,
      ip_address: ip,
      country: geo?.country ?? null,
      city: geo?.city ?? null,
      isp: geo?.isp ?? null,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("log-login error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
