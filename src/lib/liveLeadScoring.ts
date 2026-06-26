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
