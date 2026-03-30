type ZarazPrimitive = string | number | boolean;

type ZarazPayload = Record<string, ZarazPrimitive | null | undefined>;

interface ZarazApi {
  track: (eventName: string, payload?: Record<string, ZarazPrimitive>) => Promise<unknown> | unknown;
  set?: (key: string, value: ZarazPrimitive) => Promise<unknown> | unknown;
}

interface ZarazQueueItem {
  type: "set" | "track";
  eventName?: string;
  payload: Record<string, ZarazPrimitive>;
}

interface ZarazAttribution {
  first_referrer?: string;
  first_landing_path?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
}

declare global {
  interface Window {
    zaraz?: ZarazApi;
    __dealsrkyZarazQueue?: ZarazQueueItem[];
  }
}

const ATTRIBUTION_STORAGE_KEY = "dealsrky_zaraz_attribution";
const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

function sanitizePayload(payload: ZarazPayload): Record<string, ZarazPrimitive> {
  return Object.entries(payload).reduce<Record<string, ZarazPrimitive>>((accumulator, [key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

function getZarazApi(): ZarazApi | null {
  if (typeof window === "undefined" || !window.zaraz) {
    return null;
  }

  return window.zaraz;
}

function enqueueZarazCall(item: ZarazQueueItem): void {
  if (typeof window === "undefined") {
    return;
  }

  const queue = window.__dealsrkyZarazQueue ?? [];
  queue.push(item);
  window.__dealsrkyZarazQueue = queue;
}

export function flushQueuedZarazCalls(): boolean {
  const zaraz = getZarazApi();
  if (!zaraz || typeof window === "undefined") {
    return false;
  }

  const queue = window.__dealsrkyZarazQueue ?? [];
  if (queue.length === 0) {
    return true;
  }

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;

    if (item.type === "set" && zaraz.set) {
      for (const [key, value] of Object.entries(item.payload)) {
        zaraz.set(key, value);
      }
    }

    if (item.type === "track" && item.eventName) {
      void zaraz.track(item.eventName, item.payload);
    }
  }

  window.__dealsrkyZarazQueue = queue;
  return true;
}

export function setZarazContext(payload: ZarazPayload): void {
  const sanitizedPayload = sanitizePayload(payload);
  if (Object.keys(sanitizedPayload).length === 0) {
    return;
  }

  const zaraz = getZarazApi();
  if (zaraz?.set) {
    for (const [key, value] of Object.entries(sanitizedPayload)) {
      zaraz.set(key, value);
    }
    return;
  }

  enqueueZarazCall({ type: "set", payload: sanitizedPayload });
}

export async function trackZaraz(eventName: string, payload: ZarazPayload = {}): Promise<void> {
  const sanitizedPayload = sanitizePayload(payload);
  const zaraz = getZarazApi();

  if (zaraz) {
    await Promise.resolve(zaraz.track(eventName, sanitizedPayload));
    return;
  }

  enqueueZarazCall({
    type: "track",
    eventName,
    payload: sanitizedPayload,
  });
}

function readStoredAttribution(): ZarazAttribution {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ZarazAttribution;
    }
  } catch {
    return {};
  }

  return {};
}

export function captureZarazAttribution(): ZarazAttribution {
  if (typeof window === "undefined") {
    return {};
  }

  const currentUrl = new URL(window.location.href);
  const stored = readStoredAttribution();
  const nextAttribution: ZarazAttribution = { ...stored };
  let changed = false;

  if (!nextAttribution.first_landing_path) {
    nextAttribution.first_landing_path = `${currentUrl.pathname}${currentUrl.search}`;
    changed = true;
  }

  if (!nextAttribution.first_referrer && document.referrer) {
    nextAttribution.first_referrer = document.referrer;
    changed = true;
  }

  for (const param of ATTRIBUTION_PARAMS) {
    const value = currentUrl.searchParams.get(param);
    if (value && !nextAttribution[param]) {
      nextAttribution[param] = value;
      changed = true;
    }
  }

  if (changed) {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(nextAttribution));
  }

  return nextAttribution;
}

export function getZarazAttributionPayload(): Record<string, ZarazPrimitive> {
  return sanitizePayload({ ...readStoredAttribution() });
}
