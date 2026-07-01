export interface ScoreParams {
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
}

export type LiveLeadStatus = 'green' | 'orange' | 'light-red' | 'red';

export const SCORE_WEIGHTS = {
  IP_MATCH: 25,
  COUNTRY_MATCH: 20,
  NO_PROXY: 20,
  ASN_MATCH: 15,
  TIME_TO_CLICK: 10,
  UA_MATCH: 10,
} as const;

export const SCORE_THRESHOLDS = {
  GREEN: 80,
  ORANGE: 60,
  LIGHT_RED: 40,
} as const;

export function computeScore(params: ScoreParams): number {
  let score = 0;

  if (params.clickIp && params.submissionIp && params.clickIp === params.submissionIp) {
    score += SCORE_WEIGHTS.IP_MATCH;
  }

  if (params.clickCountry && params.submissionCountry && params.clickCountry === params.submissionCountry) {
    score += SCORE_WEIGHTS.COUNTRY_MATCH;
  }

  if (params.clickAsn && params.submissionAsn && params.clickAsn === params.submissionAsn) {
    score += SCORE_WEIGHTS.ASN_MATCH;
  }

  if (!params.isProxy) {
    score += SCORE_WEIGHTS.NO_PROXY;
  }

  if (params.timeToClick !== null && params.timeToClick !== undefined && params.timeToClick > 5) {
    score += SCORE_WEIGHTS.TIME_TO_CLICK;
  }

  if (params.clickUa && params.submissionUa && params.clickUa === params.submissionUa) {
    score += SCORE_WEIGHTS.UA_MATCH;
  }

  return score;
}

export function scoreToStatus(score: number): LiveLeadStatus {
  if (score >= SCORE_THRESHOLDS.GREEN) return 'green';
  if (score >= SCORE_THRESHOLDS.ORANGE) return 'orange';
  if (score >= SCORE_THRESHOLDS.LIGHT_RED) return 'light-red';
  return 'red';
}

export function scoreLeadResult(params: ScoreParams): { score: number; status: LiveLeadStatus } {
  const score = computeScore(params);
  return { score, status: scoreToStatus(score) };
}

export interface ScoreFactor {
  key: string;
  label: string;
  passed: boolean | null; // null = not enough data to evaluate
  points: number;
  maxPoints: number;
  reason: string;
}

// Per-signal breakdown for surfacing "why" a lead got its score, using the same
// conditions as computeScore().
export function getScoreBreakdown(params: ScoreParams): ScoreFactor[] {
  const ipMatch = !!(params.clickIp && params.submissionIp) && params.clickIp === params.submissionIp;
  const countryMatch = !!(params.clickCountry && params.submissionCountry) && params.clickCountry === params.submissionCountry;
  const asnMatch = !!(params.clickAsn && params.submissionAsn) && params.clickAsn === params.submissionAsn;
  const hasTimeToClick = params.timeToClick !== null && params.timeToClick !== undefined;
  const timeOk = hasTimeToClick && params.timeToClick! > 5;
  const uaMatch = !!(params.clickUa && params.submissionUa) && params.clickUa === params.submissionUa;

  return [
    {
      key: "ip_match",
      label: "IP Match",
      passed: params.clickIp && params.submissionIp ? ipMatch : null,
      points: ipMatch ? SCORE_WEIGHTS.IP_MATCH : 0,
      maxPoints: SCORE_WEIGHTS.IP_MATCH,
      reason: !params.clickIp || !params.submissionIp
        ? "Missing submission or click IP — could not compare."
        : ipMatch
          ? `Click IP ${params.clickIp} matches submission IP ${params.submissionIp}.`
          : `Click IP ${params.clickIp} differs from submission IP ${params.submissionIp}.`,
    },
    {
      key: "country_match",
      label: "Country Match",
      passed: params.clickCountry && params.submissionCountry ? countryMatch : null,
      points: countryMatch ? SCORE_WEIGHTS.COUNTRY_MATCH : 0,
      maxPoints: SCORE_WEIGHTS.COUNTRY_MATCH,
      reason: !params.clickCountry || !params.submissionCountry
        ? "Missing submission or click country lookup."
        : countryMatch
          ? `Click country ${params.clickCountry} matches submission country ${params.submissionCountry}.`
          : `Click country ${params.clickCountry} differs from submission country ${params.submissionCountry}.`,
    },
    {
      key: "no_proxy",
      label: "No Proxy/VPN",
      passed: !params.isProxy,
      points: !params.isProxy ? SCORE_WEIGHTS.NO_PROXY : 0,
      maxPoints: SCORE_WEIGHTS.NO_PROXY,
      reason: !params.isProxy
        ? "Submission IP is not flagged as a proxy, VPN, or hosting provider."
        : "Submission IP is flagged as a proxy, VPN, or hosting provider.",
    },
    {
      key: "asn_match",
      label: "ASN Match",
      passed: params.clickAsn && params.submissionAsn ? asnMatch : null,
      points: asnMatch ? SCORE_WEIGHTS.ASN_MATCH : 0,
      maxPoints: SCORE_WEIGHTS.ASN_MATCH,
      reason: !params.clickAsn || !params.submissionAsn
        ? "Missing submission or click ASN lookup."
        : asnMatch
          ? `Click network (${params.clickAsn}) matches submission network.`
          : `Click network (${params.clickAsn}) differs from submission network (${params.submissionAsn}).`,
    },
    {
      key: "time_to_click",
      label: "Time to Click",
      passed: hasTimeToClick ? timeOk : null,
      points: timeOk ? SCORE_WEIGHTS.TIME_TO_CLICK : 0,
      maxPoints: SCORE_WEIGHTS.TIME_TO_CLICK,
      reason: !hasTimeToClick
        ? "No click timestamp recorded."
        : timeOk
          ? `Took ${params.timeToClick}s to click — consistent with a human reading the message.`
          : `Clicked in ${params.timeToClick}s — too fast, consistent with automated clicking.`,
    },
    {
      key: "ua_match",
      label: "User-Agent Match",
      passed: params.clickUa && params.submissionUa ? uaMatch : null,
      points: uaMatch ? SCORE_WEIGHTS.UA_MATCH : 0,
      maxPoints: SCORE_WEIGHTS.UA_MATCH,
      reason: !params.clickUa || !params.submissionUa
        ? "Missing submission or click user agent."
        : uaMatch
          ? "Click device/browser matches the submission device/browser."
          : "Click device/browser differs from the submission device/browser.",
    },
  ];
}
