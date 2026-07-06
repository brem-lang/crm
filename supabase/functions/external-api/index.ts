import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, Api-Key, X-Api-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─── Country name → ISO 2-letter code lookup ────────────────────────────────
const COUNTRY_CODES: Record<string, string> = {
  "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "andorra": "AD",
  "angola": "AO", "argentina": "AR", "armenia": "AM", "australia": "AU",
  "austria": "AT", "azerbaijan": "AZ", "bahrain": "BH", "bangladesh": "BD",
  "belarus": "BY", "belgium": "BE", "bolivia": "BO", "bosnia": "BA",
  "brazil": "BR", "bulgaria": "BG", "cambodia": "KH", "cameroon": "CM",
  "canada": "CA", "chile": "CL", "china": "CN", "colombia": "CO",
  "croatia": "HR", "cyprus": "CY", "czech republic": "CZ", "czechia": "CZ",
  "denmark": "DK", "ecuador": "EC", "egypt": "EG", "estonia": "EE",
  "ethiopia": "ET", "finland": "FI", "france": "FR", "georgia": "GE",
  "germany": "DE", "ghana": "GH", "greece": "GR", "hungary": "HU",
  "india": "IN", "indonesia": "ID", "iran": "IR", "iraq": "IQ",
  "ireland": "IE", "israel": "IL", "italy": "IT", "jamaica": "JM",
  "japan": "JP", "jordan": "JO", "kazakhstan": "KZ", "kenya": "KE",
  "kuwait": "KW", "kyrgyzstan": "KG", "latvia": "LV", "lebanon": "LB",
  "libya": "LY", "liechtenstein": "LI", "lithuania": "LT", "luxembourg": "LU",
  "malaysia": "MY", "malta": "MT", "mexico": "MX", "moldova": "MD",
  "monaco": "MC", "mongolia": "MN", "morocco": "MA", "mozambique": "MZ",
  "myanmar": "MM", "nepal": "NP", "netherlands": "NL", "new zealand": "NZ",
  "nigeria": "NG", "north macedonia": "MK", "norway": "NO", "oman": "OM",
  "pakistan": "PK", "panama": "PA", "paraguay": "PY", "peru": "PE",
  "philippines": "PH", "poland": "PL", "portugal": "PT", "qatar": "QA",
  "romania": "RO", "russia": "RU", "saudi arabia": "SA", "senegal": "SN",
  "serbia": "RS", "singapore": "SG", "slovakia": "SK", "slovenia": "SI",
  "south africa": "ZA", "south korea": "KR", "spain": "ES", "sri lanka": "LK",
  "sweden": "SE", "switzerland": "CH", "syria": "SY", "taiwan": "TW",
  "tajikistan": "TJ", "tanzania": "TZ", "thailand": "TH", "tunisia": "TN",
  "turkey": "TR", "turkmenistan": "TM", "ukraine": "UA",
  "united arab emirates": "AE", "uae": "AE",
  "united kingdom": "GB", "uk": "GB", "great britain": "GB",
  "united states": "US", "usa": "US", "united states of america": "US",
  "uruguay": "UY", "uzbekistan": "UZ", "venezuela": "VE", "vietnam": "VN",
  "yemen": "YE", "zambia": "ZM", "zimbabwe": "ZW",
};

function resolveCountryCode(country?: string): string {
  if (!country) return "XX";
  const key = country.trim().toLowerCase();
  // Accept 2-letter codes directly
  if (/^[a-z]{2}$/i.test(key)) return key.toUpperCase();
  return COUNTRY_CODES[key] ?? "XX";
}

// ─── Auth helper ─────────────────────────────────────────────────────────────
async function authenticate(req: Request, supabase: ReturnType<typeof createClient>) {
  const apiKey =
    req.headers.get("x-api-key") ??
    req.headers.get("Api-Key") ??
    req.headers.get("X-Api-Key");

  if (!apiKey) return null;

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id, name, email, is_active, allowed_countries, test_mode")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (!affiliate || !affiliate.is_active) return null;
  return affiliate as {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
    allowed_countries: string[] | null;
    test_mode: boolean;
  };
}

// ─── Route: GET /health ───────────────────────────────────────────────────────
async function healthHandler(
  req: Request,
  supabase: ReturnType<typeof createClient>
) {
  const affiliate = await authenticate(req, supabase).catch(() => null);
  const body: Record<string, unknown> = {
    success: true,
    message: "API is working correctly",
    timestamp: new Date().toISOString(),
  };
  if (affiliate) {
    body.provider = { id: affiliate.id, name: affiliate.name, email: affiliate.email };
  }
  return json(body);
}

// ─── Route: POST /leads ───────────────────────────────────────────────────────
async function createLeadHandler(
  req: Request,
  affiliate: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
  supabase: ReturnType<typeof createClient>
) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: { message: "Invalid JSON body" } }, 400);
  }

  const phone = (body.phone as string | undefined)?.trim();
  if (!phone) {
    return json(
      {
        success: false,
        error: {
          message: "Validation failed",
          details: [{ msg: "Phone number is required", param: "phone", location: "body" }],
        },
      },
      400
    );
  }

  // Validate E.164 format (+ followed by 7-15 digits)
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!/^\+\d{7,15}$/.test(cleaned)) {
    return json(
      {
        success: false,
        error: {
          message: "Validation failed",
          details: [
            {
              msg: "Phone number must be in E.164 format (e.g. +393401234567)",
              param: "phone",
              location: "body",
            },
          ],
        },
      },
      400
    );
  }

  // Country code resolution
  const country = (body.country as string | undefined)?.trim() ?? null;
  const country_code = resolveCountryCode(country ?? undefined);

  // Check allowed countries
  if (affiliate.allowed_countries && affiliate.allowed_countries.length > 0) {
    if (!affiliate.allowed_countries.includes(country_code)) {
      return json(
        {
          success: false,
          error: {
            message: `Country '${country_code}' is not allowed for your provider account`,
          },
        },
        403
      );
    }
  }

  // Duplicate phone check
  const { data: dupPhone } = await supabase
    .from("leads")
    .select("id")
    .eq("mobile", cleaned)
    .maybeSingle();

  if (dupPhone) {
    return json(
      {
        success: false,
        error: { message: "Lead with this phone number already exists" },
        data: { leadId: dupPhone.id },
      },
      409
    );
  }

  // Duplicate email check (if provided)
  const email = (body.email as string | undefined)?.trim().toLowerCase() ?? null;
  if (email) {
    const { data: dupEmail } = await supabase
      .from("leads")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (dupEmail) {
      return json(
        {
          success: false,
          error: { message: "Lead with this email already exists" },
          data: { leadId: dupEmail.id },
        },
        409
      );
    }
  }

  // Map SAXO fields to DB columns
  const firstName = (body.firstName as string | undefined)?.trim() ?? "";
  const lastName = (body.lastName as string | undefined)?.trim() ?? "";
  const city = (body.city as string | undefined)?.trim() ?? null;
  const source = (body.source as string | undefined)?.substring(0, 255) ?? null;
  const campaign = (body.campaign as string | undefined)?.substring(0, 100) ?? null;
  const priorityRaw = body.priority;
  const priority =
    typeof priorityRaw === "number" && priorityRaw >= 1 && priorityRaw <= 5
      ? String(priorityRaw)
      : null;
  const agentComment = (body.agentComment as string | undefined)?.substring(0, 500) ?? null;

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // Duplicate IP address check
  if (clientIp !== "unknown") {
    const { data: dupIp } = await supabase
      .from("leads")
      .select("id")
      .eq("ip_address", clientIp)
      .maybeSingle();

    if (dupIp) {
      return json(
        {
          success: false,
          error: { message: "Lead with this IP address already exists" },
          data: { leadId: dupIp.id },
        },
        409
      );
    }
  }

  const { data: newLead, error: insertError } = await supabase
    .from("leads")
    .insert({
      firstname: firstName,
      lastname: lastName,
      email: email,
      mobile: cleaned,
      country_code,
      country,
      city,
      ip_address: clientIp,
      affiliate_id: affiliate.id,
      offer_name: campaign,
      custom1: source,
      custom2: priority,
      comment: agentComment,
      status: "new",
    })
    .select("id, created_at")
    .single();

  if (insertError || !newLead) {
    console.error("Insert error:", insertError);
    return json(
      { success: false, error: { message: "Server error — could not store lead" } },
      500
    );
  }

  // Audit log
  try {
    await supabase.from("audit_logs").insert({
      user_id: null,
      action: "lead_submitted",
      table_name: "leads",
      record_id: newLead.id,
      new_data: { email, country_code, affiliate_id: affiliate.id },
      changes_summary: `Lead submitted via SAXO API by provider "${affiliate.name}": ${email ?? cleaned}`,
      ip_address: clientIp,
    });
  } catch { /* non-critical */ }

  // Async distribution
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ lead_id: newLead.id, affiliate_id: affiliate.id }),
    }).catch(() => {});
  } catch { /* non-critical */ }

  return json(
    {
      success: true,
      data: {
        lead: {
          id: newLead.id,
          firstName,
          lastName,
          email: email ?? null,
          phone: cleaned,
          country: country ?? null,
          city: city ?? null,
          source: source ?? null,
          campaign: campaign ?? null,
          status: "NEW",
          priority: priority ? parseInt(priority, 10) : null,
          createdAt: newLead.created_at,
        },
      },
    },
    201
  );
}

// ─── Route: GET /leads ────────────────────────────────────────────────────────
async function listLeadsHandler(
  req: Request,
  affiliate: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
  supabase: ReturnType<typeof createClient>
) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const statusFilter = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("leads")
    .select(
      "id, firstname, lastname, email, mobile, country, city, custom1, offer_name, custom2, sale_status, status, created_at, updated_at",
      { count: "exact" }
    )
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter) {
    query = query.ilike("sale_status", statusFilter);
  }

  if (search) {
    const s = `%${search}%`;
    query = query.or(`mobile.ilike.${s},email.ilike.${s},firstname.ilike.${s},lastname.ilike.${s}`);
  }

  const { data: leads, error, count } = await query;

  if (error) {
    console.error("List leads error:", error);
    return json({ success: false, error: { message: "Server error" } }, 500);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const mapped = (leads ?? []).map((l) => ({
    id: l.id,
    firstName: l.firstname ?? "",
    lastName: l.lastname ?? "",
    email: l.email ?? null,
    phone: l.mobile,
    country: l.country ?? null,
    city: l.city ?? null,
    source: l.custom1 ?? null,
    campaign: l.offer_name ?? null,
    status: ((l.sale_status ?? l.status) as string | null)?.toUpperCase() ?? "NEW",
    priority: l.custom2 ? (parseInt(l.custom2, 10) || 3) : 3,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }));

  return json({
    success: true,
    data: {
      leads: mapped,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
  });
}

// ─── Route: GET /leads/:leadId/status ─────────────────────────────────────────
async function getLeadStatusHandler(
  leadId: string,
  affiliate: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
  supabase: ReturnType<typeof createClient>
) {
  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      `id, firstname, lastname, email, mobile, sale_status, status, custom2,
       created_at, updated_at, last_contact_at, next_follow_up_at,
       profiles:assigned_to ( full_name, email )`
    )
    .eq("id", leadId)
    .eq("affiliate_id", affiliate.id)
    .maybeSingle();

  if (error) {
    console.error("Lead status error:", error);
    return json({ success: false, error: { message: "Server error" } }, 500);
  }

  if (!lead) {
    return json(
      { success: false, error: { message: "Lead not found or not accessible" } },
      404
    );
  }

  // Parse assigned agent
  const agentRaw = lead.profiles as { full_name?: string; email?: string } | null;
  let assignedAgent: { firstName: string; lastName: string; email: string } | null = null;
  if (agentRaw?.email) {
    const parts = (agentRaw.full_name ?? "").trim().split(/\s+/);
    assignedAgent = {
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      email: agentRaw.email,
    };
  }

  return json({
    success: true,
    data: {
      lead: {
        id: lead.id,
        firstName: lead.firstname ?? "",
        lastName: lead.lastname ?? "",
        email: lead.email ?? null,
        phone: lead.mobile,
        status: ((lead.sale_status ?? lead.status) as string | null)?.toUpperCase() ?? "NEW",
        priority: lead.custom2 ? (parseInt(lead.custom2, 10) || 3) : 3,
        lastContactAt: (lead as Record<string, unknown>).last_contact_at ?? null,
        nextFollowUpAt: (lead as Record<string, unknown>).next_follow_up_at ?? null,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
        assignedAgent,
      },
    },
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);

  // Strip function prefix: /external-api/... or /functions/v1/external-api/...
  let path = url.pathname
    .replace(/^\/functions\/v1\/external-api/, "")
    .replace(/^\/external-api/, "")
    .replace(/\/$/, "") || "/";

  // ── GET /health ──────────────────────────────────────────────────────────
  if ((path === "/" || path === "/health") && req.method === "GET") {
    return healthHandler(req, supabase);
  }

  // All remaining routes require auth
  const affiliate = await authenticate(req, supabase);
  if (!affiliate) {
    return json(
      { success: false, error: { message: "Missing or invalid API key" } },
      401
    );
  }

  // ── POST /leads ──────────────────────────────────────────────────────────
  if (path === "/leads" && req.method === "POST") {
    return createLeadHandler(req, affiliate, supabase);
  }

  // ── GET /leads ───────────────────────────────────────────────────────────
  if (path === "/leads" && req.method === "GET") {
    return listLeadsHandler(req, affiliate, supabase);
  }

  // ── GET /leads/:leadId/status  or  GET /leads/:leadId ────────────────────
  const leadStatusMatch = path.match(/^\/leads\/([^/]+)(\/status)?$/);
  if (leadStatusMatch && req.method === "GET") {
    const leadId = leadStatusMatch[1];
    return getLeadStatusHandler(leadId, affiliate, supabase);
  }

  return json({ success: false, error: { message: "Not found" } }, 404);
});
