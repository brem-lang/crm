import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortId(value: string | null | undefined, length = 8): string {
  return value ? value.slice(0, length) : "-";
}

export type ParsedRequestPayload =
  | { kind: "json"; value: unknown }
  | { kind: "form"; value: Array<[string, string]> }
  | { kind: "raw"; value: string };

// Different advertisers send request bodies in different shapes (JSON vs
// application/x-www-form-urlencoded) — inspect the raw string instead of
// assuming one format so new integrations keep rendering readably.
export function parseRequestPayload(raw: string | null | undefined): ParsedRequestPayload {
  if (!raw) return { kind: "raw", value: "" };

  try {
    return { kind: "json", value: JSON.parse(raw) };
  } catch {
    // not JSON, fall through
  }

  if (raw.includes("=")) {
    try {
      const params = new URLSearchParams(raw);
      const entries = Array.from(params.entries());
      if (entries.length > 0 && entries.every(([key]) => key.length > 0)) {
        return { kind: "form", value: entries };
      }
    } catch {
      // not form-encoded, fall through
    }
  }

  return { kind: "raw", value: raw };
}

// Some advertiser responses embed a JSON object as an escaped string within a
// field (e.g. a "request_body" field that is itself a JSON string) — a plain
// JSON.stringify(parsed, null, 2) leaves that field as one unreadable escaped
// line. Recursively parse any string value that looks like JSON so the whole
// structure pretty-prints consistently.
export function deepParseJsonStrings(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const looksLikeJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"));
    if (!looksLikeJson) return value;
    try {
      return deepParseJsonStrings(JSON.parse(trimmed));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return value.map(deepParseJsonStrings);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepParseJsonStrings(v)])
    );
  }
  return value;
}
