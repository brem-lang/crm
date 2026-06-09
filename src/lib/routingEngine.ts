import { isWithinSchedule } from "./scheduleUtils";

export type FilterReason =
  | "advertiser_inactive"
  | "setting_inactive"
  | "country_not_allowed"
  | "affiliate_not_allowed"
  | "outside_schedule"
  | "daily_cap_hit"
  | "affiliate_rule_inactive";

export interface RankedAdvertiser {
  advertiserId: string;
  name: string;
  priority: number;
  weight: number;
  pct: number;
  source: "global" | "affiliate_rule";
  filterReason: FilterReason | null;
  rank: number | null;
}

export interface RoutingAdvertiser {
  id: string;
  name: string;
  is_active: boolean;
}

export interface RoutingSetting {
  advertiser_id: string;
  is_active: boolean;
  priority: number;
  base_weight: number | null;
  default_daily_cap: number | null;
  countries: string[] | null;
  affiliates: string[] | null;
  start_time: string | null;
  end_time: string | null;
  weekly_schedule?: unknown;
}

export interface RoutingRule {
  advertiser_id: string;
  affiliate_id: string;
  country_code: string;
  is_active: boolean;
  weight: number;
  priority_type: "primary" | "fallback";
  daily_cap: number | null;
  start_time: string | null;
  end_time: string | null;
  weekly_schedule?: unknown;
  advertiser_is_active?: boolean;
}

export function runRouting(
  country: string,
  affiliateId: string,
  at: Date,
  advertisers: RoutingAdvertiser[],
  settings: RoutingSetting[],
  rules: RoutingRule[],
  todayCounts: Record<string, number>
): RankedAdvertiser[] {
  const advertiserMap = new Map(advertisers.map(a => [a.id, a]));

  // Prefer affiliate-specific rules for this affiliate + country
  const affiliateRules = affiliateId
    ? rules.filter(r => r.affiliate_id === affiliateId && r.country_code === country)
    : [];

  const results: RankedAdvertiser[] = [];

  if (affiliateRules.length > 0) {
    for (const rule of affiliateRules) {
      const adv = advertiserMap.get(rule.advertiser_id);
      if (!adv) continue;

      let filterReason: FilterReason | null = null;
      if (!adv.is_active) filterReason = "advertiser_inactive";
      else if (!rule.is_active) filterReason = "affiliate_rule_inactive";
      else if (!isWithinSchedule({ start_time: rule.start_time, end_time: rule.end_time, weekly_schedule: rule.weekly_schedule }, at))
        filterReason = "outside_schedule";
      else if (rule.daily_cap != null && (todayCounts[rule.advertiser_id] ?? 0) >= rule.daily_cap)
        filterReason = "daily_cap_hit";

      results.push({
        advertiserId: rule.advertiser_id,
        name: adv.name,
        priority: rule.priority_type === "primary" ? 1 : 2,
        weight: rule.weight,
        pct: 0,
        source: "affiliate_rule",
        filterReason,
        rank: null,
      });
    }
  } else {
    for (const setting of settings) {
      const adv = advertiserMap.get(setting.advertiser_id);
      if (!adv) continue;

      let filterReason: FilterReason | null = null;
      if (!adv.is_active) filterReason = "advertiser_inactive";
      else if (!setting.is_active) filterReason = "setting_inactive";
      else if (setting.countries?.length && !setting.countries.includes(country))
        filterReason = "country_not_allowed";
      else if (affiliateId && setting.affiliates?.length && !setting.affiliates.includes(affiliateId))
        filterReason = "affiliate_not_allowed";
      else if (!isWithinSchedule(setting, at)) filterReason = "outside_schedule";
      else if (setting.default_daily_cap != null && (todayCounts[setting.advertiser_id] ?? 0) >= setting.default_daily_cap)
        filterReason = "daily_cap_hit";

      results.push({
        advertiserId: setting.advertiser_id,
        name: adv.name,
        priority: setting.priority,
        weight: setting.base_weight ?? 100,
        pct: 0,
        source: "global",
        filterReason,
        rank: null,
      });
    }
  }

  // Rank eligible advertisers
  const eligible = results.filter(r => !r.filterReason);
  eligible.sort((a, b) => a.priority - b.priority || b.weight - a.weight);

  const tierWeights: Record<number, number> = {};
  for (const r of eligible) {
    tierWeights[r.priority] = (tierWeights[r.priority] ?? 0) + r.weight;
  }

  let rank = 1;
  for (const r of eligible) {
    r.pct = tierWeights[r.priority] > 0
      ? Math.round((r.weight / tierWeights[r.priority]) * 100)
      : 0;
    r.rank = rank++;
  }

  const filtered = results
    .filter(r => r.filterReason)
    .sort((a, b) => a.priority - b.priority || b.weight - a.weight);

  return [...eligible, ...filtered];
}

/** Returns the winning advertiser ID, or null if no one wins. */
export function getWinner(results: RankedAdvertiser[]): string | null {
  const winner = results.find(r => r.rank === 1);
  return winner?.advertiserId ?? null;
}
