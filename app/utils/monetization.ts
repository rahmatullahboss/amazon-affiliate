export type MonetizationProvider = "adsterra" | "monetag";
export type MonetizationTagAdapter = "single-script-src";

export interface MonetizationEnvironment {
  ADS_ENABLED?: string;
  ADS_PROVIDER?: string;
  ADS_TAG_ADAPTER?: string;
  ADSTERRA_SCRIPT_URL?: string;
  MONETAG_SCRIPT_URL?: string;
  ADS_LOAD_DELAY_MS?: string;
}

export interface PublicMonetizationConfig {
  enabled: boolean;
  provider: MonetizationProvider | null;
  tagAdapter: MonetizationTagAdapter | null;
  scriptUrl: string | null;
  loadDelayMs: number;
}

const DEFAULT_LOAD_DELAY_MS = 10_000;
const MIN_LOAD_DELAY_MS = 3_000;
const MAX_LOAD_DELAY_MS = 60_000;

function isEnabledFlag(value?: string): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function parseProvider(value?: string): MonetizationProvider | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "adsterra" || normalized === "monetag") {
    return normalized;
  }
  return null;
}

function parseTagAdapter(value?: string): MonetizationTagAdapter | null {
  return (value ?? "").trim().toLowerCase() === "single-script-src"
    ? "single-script-src"
    : null;
}

function parseHttpsScriptUrl(value?: string): string | null {
  const candidate = (value ?? "").trim();
  if (!candidate) {
    return null;
  }

  const normalized = candidate.startsWith("//") ? `https:${candidate}` : candidate;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseLoadDelay(value?: string): number {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LOAD_DELAY_MS;
  }
  return Math.min(MAX_LOAD_DELAY_MS, Math.max(MIN_LOAD_DELAY_MS, parsed));
}

export function buildPublicMonetizationConfig(
  env: MonetizationEnvironment
): PublicMonetizationConfig {
  const provider = parseProvider(env.ADS_PROVIDER);
  const tagAdapter = parseTagAdapter(env.ADS_TAG_ADAPTER);
  const scriptUrl =
    provider === "adsterra"
      ? parseHttpsScriptUrl(env.ADSTERRA_SCRIPT_URL)
      : provider === "monetag"
        ? parseHttpsScriptUrl(env.MONETAG_SCRIPT_URL)
        : null;
  const enabled =
    isEnabledFlag(env.ADS_ENABLED) &&
    provider !== null &&
    tagAdapter !== null &&
    scriptUrl !== null;

  return {
    enabled,
    provider: enabled ? provider : null,
    tagAdapter: enabled ? tagAdapter : null,
    scriptUrl: enabled ? scriptUrl : null,
    loadDelayMs: parseLoadDelay(env.ADS_LOAD_DELAY_MS),
  };
}

const SAFE_TWO_SEGMENT_PREFIXES = new Set(["blog", "category", "deals"]);

export function isMonetizationEligiblePath(pathname: string): boolean {
  const segments = pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return true;
  }

  const first = segments[0]?.toLowerCase() ?? "";
  if (first === "admin" || first === "portal" || first === "t") {
    return false;
  }

  if (segments.length === 1) {
    return true;
  }

  if (segments.length === 2 && SAFE_TWO_SEGMENT_PREFIXES.has(first)) {
    return true;
  }

  // Any other multi-segment public route is currently an Amazon bridge/redirect
  // or an unknown future route. Default-deny to protect affiliate conversion.
  return false;
}
