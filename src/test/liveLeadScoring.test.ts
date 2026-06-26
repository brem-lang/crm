import { describe, it, expect } from "vitest";
import {
  computeScore,
  scoreToStatus,
  scoreLeadResult,
  SCORE_WEIGHTS,
  SCORE_THRESHOLDS,
  type ScoreParams,
} from "@/lib/liveLeadScoring";

// Baseline: a "perfect" lead — same IP, country, ASN, no proxy, clicked after 5s, same UA
const PERFECT: ScoreParams = {
  submissionIp: "1.2.3.4",
  clickIp: "1.2.3.4",
  submissionCountry: "CA",
  clickCountry: "CA",
  submissionAsn: "AS12345 Some ISP",
  clickAsn: "AS12345 Some ISP",
  isProxy: false,
  timeToClick: 30,
  submissionUa: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  clickUa: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// Baseline: a "worst case" lead — different everything, proxy used, clicked instantly
const WORST: ScoreParams = {
  submissionIp: "1.2.3.4",
  clickIp: "9.9.9.9",
  submissionCountry: "CA",
  clickCountry: "RU",
  submissionAsn: "AS12345 Some ISP",
  clickAsn: "AS99999 VPN Provider",
  isProxy: true,
  timeToClick: 2,
  submissionUa: "Mozilla/5.0 Chrome",
  clickUa: "curl/7.68.0",
};

// Helper to override specific fields
function make(overrides: Partial<ScoreParams>): ScoreParams {
  return { ...PERFECT, ...overrides };
}

// ─── computeScore ─────────────────────────────────────────────────────────────

describe("computeScore", () => {
  it("awards maximum 100 pts when all signals match", () => {
    expect(computeScore(PERFECT)).toBe(100);
  });

  it("awards 0 pts when all signals mismatch and proxy is used", () => {
    expect(computeScore(WORST)).toBe(0);
  });

  // Individual signal contributions
  it(`awards ${SCORE_WEIGHTS.IP_MATCH} pts for exact IP match`, () => {
    const base = make({ clickCountry: "RU", clickAsn: "AS99999", isProxy: true, timeToClick: 2, clickUa: "other" });
    expect(computeScore(base)).toBe(SCORE_WEIGHTS.IP_MATCH);
  });

  it(`awards ${SCORE_WEIGHTS.COUNTRY_MATCH} pts for country match`, () => {
    const base = make({ clickIp: "9.9.9.9", clickAsn: "AS99999", isProxy: true, timeToClick: 2, clickUa: "other" });
    expect(computeScore(base)).toBe(SCORE_WEIGHTS.COUNTRY_MATCH);
  });

  it(`awards ${SCORE_WEIGHTS.ASN_MATCH} pts for ASN match`, () => {
    const base = make({ clickIp: "9.9.9.9", clickCountry: "RU", isProxy: true, timeToClick: 2, clickUa: "other" });
    expect(computeScore(base)).toBe(SCORE_WEIGHTS.ASN_MATCH);
  });

  it(`awards ${SCORE_WEIGHTS.NO_PROXY} pts when isProxy is false`, () => {
    const base = make({ clickIp: "9.9.9.9", clickCountry: "RU", clickAsn: "AS99999", isProxy: false, timeToClick: 2, clickUa: "other" });
    expect(computeScore(base)).toBe(SCORE_WEIGHTS.NO_PROXY);
  });

  it(`awards ${SCORE_WEIGHTS.TIME_TO_CLICK} pts when timeToClick > 5`, () => {
    const base = make({ clickIp: "9.9.9.9", clickCountry: "RU", clickAsn: "AS99999", isProxy: true, timeToClick: 6, clickUa: "other" });
    expect(computeScore(base)).toBe(SCORE_WEIGHTS.TIME_TO_CLICK);
  });

  it(`awards ${SCORE_WEIGHTS.UA_MATCH} pts for UA match`, () => {
    const base = make({ clickIp: "9.9.9.9", clickCountry: "RU", clickAsn: "AS99999", isProxy: true, timeToClick: 2 });
    expect(computeScore(base)).toBe(SCORE_WEIGHTS.UA_MATCH);
  });

  // Time-to-click edge cases
  it("does NOT award time pts when timeToClick === 5 (must be > 5)", () => {
    expect(computeScore(make({ timeToClick: 5 }))).toBe(100 - SCORE_WEIGHTS.TIME_TO_CLICK);
  });

  it("does NOT award time pts when timeToClick === 0", () => {
    expect(computeScore(make({ timeToClick: 0 }))).toBe(100 - SCORE_WEIGHTS.TIME_TO_CLICK);
  });

  it("does NOT award time pts when timeToClick is null", () => {
    expect(computeScore(make({ timeToClick: null }))).toBe(100 - SCORE_WEIGHTS.TIME_TO_CLICK);
  });

  it("does NOT award time pts when timeToClick is negative (bot replay)", () => {
    expect(computeScore(make({ timeToClick: -1 }))).toBe(100 - SCORE_WEIGHTS.TIME_TO_CLICK);
  });

  // Null / missing field safety
  it("awards 0 for IP match when clickIp is null", () => {
    expect(computeScore(make({ clickIp: null }))).toBe(100 - SCORE_WEIGHTS.IP_MATCH);
  });

  it("awards 0 for IP match when submissionIp is null", () => {
    expect(computeScore(make({ submissionIp: null }))).toBe(100 - SCORE_WEIGHTS.IP_MATCH);
  });

  it("awards 0 for country match when clickCountry is null", () => {
    expect(computeScore(make({ clickCountry: null }))).toBe(100 - SCORE_WEIGHTS.COUNTRY_MATCH);
  });

  it("awards 0 for ASN match when clickAsn is null", () => {
    expect(computeScore(make({ clickAsn: null }))).toBe(100 - SCORE_WEIGHTS.ASN_MATCH);
  });

  it("awards 0 for UA match when clickUa is null", () => {
    expect(computeScore(make({ clickUa: null }))).toBe(100 - SCORE_WEIGHTS.UA_MATCH);
  });

  // Proxy flag
  it("deducts proxy pts when isProxy is true", () => {
    expect(computeScore(make({ isProxy: true }))).toBe(100 - SCORE_WEIGHTS.NO_PROXY);
  });

  // Realistic combos
  it("scores correctly: IP + country + no-proxy (typical real lead, no ASN/UA/time data)", () => {
    const score = computeScore(make({
      clickAsn: null,
      isProxy: false,
      timeToClick: 2,
      clickUa: null,
    }));
    // IP(25) + country(20) + no-proxy(20) = 65
    expect(score).toBe(65);
  });

  it("scores correctly: country + no-proxy + time (VPN detected, different IP)", () => {
    const score = computeScore({
      submissionIp: "1.2.3.4",
      clickIp: "9.9.9.9",
      submissionCountry: "CA",
      clickCountry: "CA",
      submissionAsn: "AS12345",
      clickAsn: "AS99999",
      isProxy: false,
      timeToClick: 10,
      submissionUa: null,
      clickUa: null,
    });
    // country(20) + no-proxy(20) + time(10) = 50
    expect(score).toBe(50);
  });

  it("scores correctly for a mobile user with different UA but same IP/country/ASN", () => {
    const score = computeScore(make({ clickUa: "Mozilla/5.0 (iPhone; CPU iPhone OS 17)" }));
    // IP(25) + country(20) + ASN(15) + no-proxy(20) + time(10) = 90, no UA match
    expect(score).toBe(90);
  });
});

// ─── scoreToStatus ─────────────────────────────────────────────────────────────

describe("scoreToStatus", () => {
  it("returns 'green' at exactly 80", () => expect(scoreToStatus(80)).toBe("green"));
  it("returns 'green' at 100", () => expect(scoreToStatus(100)).toBe("green"));
  it("returns 'green' at 95", () => expect(scoreToStatus(95)).toBe("green"));

  it("returns 'orange' at exactly 60", () => expect(scoreToStatus(60)).toBe("orange"));
  it("returns 'orange' at 79", () => expect(scoreToStatus(79)).toBe("orange"));
  it("returns 'orange' at 65", () => expect(scoreToStatus(65)).toBe("orange"));

  it("returns 'light-red' at exactly 40", () => expect(scoreToStatus(40)).toBe("light-red"));
  it("returns 'light-red' at 59", () => expect(scoreToStatus(59)).toBe("light-red"));
  it("returns 'light-red' at 50", () => expect(scoreToStatus(50)).toBe("light-red"));

  it("returns 'red' at 39", () => expect(scoreToStatus(39)).toBe("red"));
  it("returns 'red' at 0", () => expect(scoreToStatus(0)).toBe("red"));
  it("returns 'red' at 25", () => expect(scoreToStatus(25)).toBe("red"));

  // Boundary check — 79 is NOT green
  it("correctly separates green/orange boundary (79 = orange, 80 = green)", () => {
    expect(scoreToStatus(79)).toBe("orange");
    expect(scoreToStatus(80)).toBe("green");
  });

  it("correctly separates orange/light-red boundary (59 = light-red, 60 = orange)", () => {
    expect(scoreToStatus(59)).toBe("light-red");
    expect(scoreToStatus(60)).toBe("orange");
  });

  it("correctly separates light-red/red boundary (39 = red, 40 = light-red)", () => {
    expect(scoreToStatus(39)).toBe("red");
    expect(scoreToStatus(40)).toBe("light-red");
  });
});

// ─── scoreLeadResult (integration of both) ────────────────────────────────────

describe("scoreLeadResult", () => {
  it("returns score 100 and status 'green' for a perfect lead", () => {
    expect(scoreLeadResult(PERFECT)).toEqual({ score: 100, status: "green" });
  });

  it("returns score 0 and status 'red' for a worst-case lead", () => {
    expect(scoreLeadResult(WORST)).toEqual({ score: 0, status: "red" });
  });

  it("returns 'orange' for a borderline lead (score 65)", () => {
    const params = make({ clickAsn: null, isProxy: false, timeToClick: 2, clickUa: null });
    // IP(25) + country(20) + no-proxy(20) = 65
    const result = scoreLeadResult(params);
    expect(result.score).toBe(65);
    expect(result.status).toBe("orange");
  });

  it("API-only lead with no click data scores 0 (proxy=false adds 20 but no click signals)", () => {
    const params: ScoreParams = {
      submissionIp: "1.2.3.4",
      clickIp: null,
      submissionCountry: null,
      clickCountry: null,
      submissionAsn: null,
      clickAsn: null,
      isProxy: false,
      timeToClick: null,
      submissionUa: null,
      clickUa: null,
    };
    // Only no-proxy(20) = 20 → red
    const result = scoreLeadResult(params);
    expect(result.score).toBe(20);
    expect(result.status).toBe("red");
  });
});

// ─── Constant integrity ────────────────────────────────────────────────────────

describe("scoring constants", () => {
  it("all signal weights sum to 100", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("thresholds are ordered correctly (GREEN > ORANGE > LIGHT_RED)", () => {
    expect(SCORE_THRESHOLDS.GREEN).toBeGreaterThan(SCORE_THRESHOLDS.ORANGE);
    expect(SCORE_THRESHOLDS.ORANGE).toBeGreaterThan(SCORE_THRESHOLDS.LIGHT_RED);
  });
});
