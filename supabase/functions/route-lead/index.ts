import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
  ].join(", "),
};

// ---- Types ----

interface RuleConditions {
  affiliate_ids?: string[];
  country_codes?: string[];
  language_codes?: string[];
  device_types?: string[];
}

interface DistributionRule {
  id: string;
  name: string;
  rule_type: "priority" | "weighted" | "affiliate" | "geo";
  is_active: boolean;
  priority: number;
  conditions: RuleConditions;
}

interface RuleTarget {
  advertiser_id: string;
  weight: number;
  priority_order: number;
  is_fallback: boolean;
  is_enabled: boolean;
}

interface AdvertiserConfig {
  advertiser_id: string;
  is_active: boolean;
  default_daily_cap: number | null;
  default_hourly_cap: number | null;
  countries: string[] | null;
  affiliates: string[] | null;
  weekly_schedule: unknown;
  overflow_option: string;
  timezone: string;
}

type RejectionReason =
  | "no_matching_rule"
  | "advertiser_paused"
  | "outside_working_hours"
  | "daily_cap_reached"
  | "hourly_cap_reached"
  | "country_not_allowed"
  | "affiliate_not_allowed"
  | "duplicate_lead"
  | "advertiser_rejected";

// ---- Helpers ----

function conditionsMatch(
  conditions: RuleConditions,
  lead: {
    affiliate_id?: string;
    country_code: string;
    language_code?: string;
    device_type?: string;
  }
): boolean {
  if (conditions.affiliate_ids?.length && lead.affiliate_id) {
    if (!conditions.affiliate_ids.includes(lead.affiliate_id)) return false;
  }
  if (conditions.country_codes?.length) {
    if (!conditions.country_codes.includes(lead.country_code)) return false;
  }
  if (conditions.language_codes?.length && lead.language_code) {
    if (!conditions.language_codes.includes(lead.language_code)) return false;
  }
  if (conditions.device_types?.length && lead.device_type) {
    if (!conditions.device_types.includes(lead.device_type)) return false;
  }
  return true;
}

function getTimeInTimezone(tz: string): { dayIndex: number; time: string } {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(now);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return { dayIndex: dayMap[weekday] ?? 0, time: `${hour}:${minute}` };
  } catch {
    return {
      dayIndex: now.getUTCDay(),
      time: `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}`,
    };
  }
}

function isWithinSchedule(config: AdvertiserConfig): boolean {
  const ws = config.weekly_schedule as any;
  const tz = config.timezone || "UTC";
  const { dayIndex, time } = getTimeInTimezone(tz);

  if (ws && ws.format === "heatmap" && Array.isArray(ws.matrix)) {
    // heatmap format: matrix[day][hour] boolean
    const [hourStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    // Heatmap day 0 = Monday, 6 = Sunday
    const heatmapDay = dayIndex === 0 ? 6 : dayIndex - 1;
    return ws.matrix[heatmapDay]?.[hour] === true;
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayKey = dayNames[dayIndex];

  if (ws && ws.format !== "heatmap") {
    const daySchedule = ws[todayKey];
    if (!daySchedule?.is_active) return false;
    const start = daySchedule.start_time ?? "00:00";
    const end = daySchedule.end_time ?? "23:59";
    return time >= start && time <= end;
  }

  // Legacy start_time / end_time columns (no schedule = always active)
  if (!config.weekly_schedule) {
    return true;
  }

  return true;
}

// deno-lint-ignore no-explicit-any
async function checkEligible(
  supabase: any,
  target: RuleTarget,
  configMap: Map<string, AdvertiserConfig>,
  lead: { affiliate_id?: string; country_code: string },
  today: string,
  hourAgo: string
): Promise<{ eligible: boolean; reason?: RejectionReason }> {
  const config = configMap.get(target.advertiser_id);

  if (!config || !config.is_active) {
    return { eligible: false, reason: "advertiser_paused" };
  }

  // Working schedule
  if (!isWithinSchedule(config)) {
    return { eligible: false, reason: "outside_working_hours" };
  }

  // Country check
  if (config.countries?.length && !config.countries.includes(lead.country_code)) {
    return { eligible: false, reason: "country_not_allowed" };
  }

  // Affiliate check
  if (config.affiliates?.length && lead.affiliate_id && !config.affiliates.includes(lead.affiliate_id)) {
    return { eligible: false, reason: "affiliate_not_allowed" };
  }

  // Daily cap
  if (config.default_daily_cap != null) {
    const { count } = await supabase
      .from("lead_distributions")
      .select("*", { count: "exact", head: true })
      .eq("advertiser_id", target.advertiser_id)
      .eq("status", "sent")
      .gte("created_at", `${today}T00:00:00Z`);

    if ((count ?? 0) >= config.default_daily_cap) {
      return { eligible: false, reason: "daily_cap_reached" };
    }
  }

  // Hourly cap
  if (config.default_hourly_cap != null) {
    const { count } = await supabase
      .from("lead_distributions")
      .select("*", { count: "exact", head: true })
      .eq("advertiser_id", target.advertiser_id)
      .eq("status", "sent")
      .gte("created_at", hourAgo);

    if ((count ?? 0) >= config.default_hourly_cap) {
      return { eligible: false, reason: "hourly_cap_reached" };
    }
  }

  return { eligible: true };
}

function selectByWeight(targets: RuleTarget[]): RuleTarget {
  if (targets.length === 1) return targets[0];
  const total = targets.reduce((s, t) => s + t.weight, 0);
  let rnd = Math.random() * total;
  for (const t of targets) {
    rnd -= t.weight;
    if (rnd <= 0) return t;
  }
  return targets[targets.length - 1];
}

// ---- Main handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      lead_id,
      affiliate_id,
      country_code,
      language_code,
      device_type,
    }: {
      lead_id: string;
      affiliate_id?: string;
      country_code: string;
      language_code?: string;
      device_type?: string;
    } = body;

    if (!lead_id || !country_code) {
      return new Response(
        JSON.stringify({ success: false, message: "lead_id and country_code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`route-lead: lead=${lead_id} country=${country_code} affiliate=${affiliate_id ?? "none"}`);

    // Load active rules ordered by priority
    const { data: rules, error: rulesError } = await supabase
      .from("distribution_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (rulesError) throw rulesError;

    if (!rules?.length) {
      console.log("No active distribution rules found");
      return new Response(
        JSON.stringify({ success: false, rejected: true, reason: "no_matching_rule" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find first matching rule
    const leadContext = { affiliate_id, country_code, language_code, device_type };
    const matchingRule = (rules as DistributionRule[]).find((r) =>
      conditionsMatch(r.conditions ?? {}, leadContext)
    );

    if (!matchingRule) {
      console.log("No rule matched the lead's conditions");
      return new Response(
        JSON.stringify({ success: false, rejected: true, reason: "no_matching_rule" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Matched rule: "${matchingRule.name}" (type=${matchingRule.rule_type})`);

    // Load rule targets
    const { data: targets, error: targetsError } = await supabase
      .from("distribution_rule_targets")
      .select("*")
      .eq("rule_id", matchingRule.id)
      .order("priority_order", { ascending: true });

    if (targetsError) throw targetsError;
    if (!targets?.length) {
      return new Response(
        JSON.stringify({ success: false, rejected: true, reason: "no_matching_rule" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load advertiser configs
    const advertiserIds = [...new Set((targets as RuleTarget[]).map((t) => t.advertiser_id))];
    const { data: configs } = await supabase
      .from("advertiser_distribution_settings")
      .select("*")
      .in("advertiser_id", advertiserIds);

    const configMap = new Map<string, AdvertiserConfig>();
    for (const c of configs ?? []) {
      configMap.set(c.advertiser_id, c as AdvertiserConfig);
    }

    const today = new Date().toISOString().split("T")[0];
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const primaryTargets = (targets as RuleTarget[]).filter((t) => !t.is_fallback && (t.is_enabled ?? true));
    const fallbackTargets = (targets as RuleTarget[]).filter((t) => t.is_fallback && (t.is_enabled ?? true));

    // Build ordered list of advertisers to try
    let orderedToTry: string[] = [];

    if (matchingRule.rule_type === "priority" || matchingRule.rule_type === "affiliate" || matchingRule.rule_type === "geo") {
      // Try primary in priority_order, then fallbacks in priority_order
      const eligiblePrimary: string[] = [];
      for (const t of primaryTargets) {
        const { eligible } = await checkEligible(supabase, t, configMap, leadContext, today, hourAgo);
        if (eligible) eligiblePrimary.push(t.advertiser_id);
      }
      const eligibleFallback: string[] = [];
      for (const t of fallbackTargets) {
        const { eligible } = await checkEligible(supabase, t, configMap, leadContext, today, hourAgo);
        if (eligible) eligibleFallback.push(t.advertiser_id);
      }
      orderedToTry = [...eligiblePrimary, ...eligibleFallback];
    } else if (matchingRule.rule_type === "weighted") {
      // Filter eligible primary targets, pick one by weight, then fallbacks
      const eligiblePrimary: RuleTarget[] = [];
      for (const t of primaryTargets) {
        const { eligible } = await checkEligible(supabase, t, configMap, leadContext, today, hourAgo);
        if (eligible) eligiblePrimary.push(t);
      }
      if (eligiblePrimary.length) {
        const picked = selectByWeight(eligiblePrimary);
        const rest = eligiblePrimary.filter((t) => t.advertiser_id !== picked.advertiser_id);
        orderedToTry = [picked, ...rest].map((t) => t.advertiser_id);
      }
      // Fallbacks
      for (const t of fallbackTargets) {
        const { eligible } = await checkEligible(supabase, t, configMap, leadContext, today, hourAgo);
        if (eligible) orderedToTry.push(t.advertiser_id);
      }
    }

    if (!orderedToTry.length) {
      const firstReason = await (async () => {
        for (const t of primaryTargets) {
          const { reason } = await checkEligible(supabase, t, configMap, leadContext, today, hourAgo);
          if (reason) return reason;
        }
        return "daily_cap_reached" as RejectionReason;
      })();
      console.log(`No eligible advertisers. First reason: ${firstReason}`);
      return new Response(
        JSON.stringify({ success: false, rejected: true, reason: firstReason }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try each advertiser by calling the distribute-lead function
    for (const advertiserId of orderedToTry) {
      console.log(`Trying advertiser ${advertiserId}...`);
      try {
        const distributeResp = await fetch(
          `${supabaseUrl}/functions/v1/distribute-lead`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
            },
            body: JSON.stringify({ lead_id, advertiser_id: advertiserId }),
          }
        );

        const result = await distributeResp.json();
        if (result.success) {
          console.log(`Successfully routed lead to advertiser ${advertiserId}`);
          return new Response(
            JSON.stringify({
              success: true,
              advertiser_id: advertiserId,
              rule_id: matchingRule.id,
              rule_name: matchingRule.name,
              external_lead_id: result.external_lead_id,
              autologin_url: result.autologin_url,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log(`Advertiser ${advertiserId} rejected lead, trying next...`);
      } catch (err) {
        console.error(`Error calling distribute-lead for ${advertiserId}:`, err);
      }
    }

    // All advertisers failed
    console.log("All eligible advertisers failed or rejected the lead");
    return new Response(
      JSON.stringify({ success: false, rejected: true, reason: "advertiser_rejected" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("route-lead error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(
      JSON.stringify({ success: false, message: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
