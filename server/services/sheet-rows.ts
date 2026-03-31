import { extractAsinFromInput, isValidAsin } from "./product-ingestion";
import { AMAZON_DOMAINS } from "../utils/types";

export type SheetRowRecord = Record<string, string>;

export interface ParsedSheetSyncRow {
  asin: string;
  marketplace: string;
  title: string | null;
  category: string | null;
  customTitle: string | null;
  agentSlug: string | null;
  trackingTag: string | null;
  rowStatus: "active" | "inactive";
  productStatus: "active" | "pending_review" | "rejected";
}

export function mapRows(
  values: string[][],
  options?: { dedupe?: boolean }
): SheetRowRecord[] {
  const shouldDedupe = options?.dedupe ?? true;

  if (values.length === 0) {
    return [];
  }

  const headers = values[0].map(normalizeHeader);
  const hasAsinHeader = headers.includes("asin");

  if (!hasAsinHeader) {
    const records = mapHeaderlessAsinGrid(values);
    return shouldDedupe ? dedupeSheetRecords(records) : records;
  }

  if (values.length < 2) {
    return [];
  }

  const records = values.slice(1).map((row) =>
    headers.reduce<SheetRowRecord>((accumulator, header, index) => {
      accumulator[header] = row[index] ?? "";
      return accumulator;
    }, {})
  );

  return shouldDedupe ? dedupeSheetRecords(records) : records;
}

export function parseSheetSyncRow(
  row: SheetRowRecord,
  defaultMarketplace: string
): ParsedSheetSyncRow | null {
  const rawAsinInput = getRowValue(row, [
    "asin",
    "product_asin",
    "amazon_url",
    "product_url",
    "url",
  ]);
  const asin = extractAsinFromInput(rawAsinInput)?.toUpperCase() || "";
  if (!isValidAsin(asin)) {
    return null;
  }

  const explicitMarketplace = normalizeCell(
    getRowValue(row, ["marketplace", "country", "country_code", "domain_country"])
  ).toUpperCase();
  const inferredMarketplace = extractMarketplaceFromInput(rawAsinInput);
  const marketplace = explicitMarketplace || inferredMarketplace || defaultMarketplace;

  return {
    asin,
    marketplace,
    title: getNullableRowValue(row, ["title", "product_title"]),
    category: getNullableRowValue(row, ["category", "product_category"]),
    customTitle: getNullableRowValue(row, ["custom_title", "mapping_title"]),
    agentSlug: getNullableRowValue(row, ["agent_slug", "agent", "slug"])?.toLowerCase() || null,
    trackingTag: normalizeTrackingTag(getNullableRowValue(row, ["tracking_tag", "tag"]) || ""),
    rowStatus: parseRowStatus(row),
    productStatus: parseProductStatus(row),
  };
}

export function normalizeTrackingTag(value: string): string | null {
  const cleaned = value.trim().replace(/^\?/i, "").replace(/^tag=/i, "");
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeCell(value?: string): string {
  return (value || "").trim();
}

export function getRowValue(row: SheetRowRecord, keys: string[]): string {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    const value = row[normalizedKey];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "";
}

export function getNullableRowValue(row: SheetRowRecord, keys: string[]): string | null {
  const value = getRowValue(row, keys).trim();
  return value.length > 0 ? value : null;
}

export function dedupeSheetRecords(records: SheetRowRecord[]): SheetRowRecord[] {
  const seen = new Set<string>();
  const deduped: SheetRowRecord[] = [];

  for (const record of records) {
    const asin = (
      extractAsinFromInput(record.asin || "") || normalizeCell(record.asin)
    ).toUpperCase();
    const marketplace = normalizeCell(record.marketplace).toUpperCase();
    const agentSlug = normalizeCell(record.agent_slug || record.agent).toLowerCase();
    const trackingTag = normalizeTrackingTag(record.tracking_tag || record.tag || "") || "";
    const key = `${asin}:${marketplace}:${agentSlug}:${trackingTag}`;

    if (!asin || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(record);
  }

  return deduped;
}

function extractMarketplaceFromInput(rawInput: string): string {
  const normalized = normalizeCell(rawInput).toLowerCase();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    return "";
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "");
    const match = Object.entries(AMAZON_DOMAINS).find(
      ([, domain]) => domain === `www.${host}` || domain === host
    );
    return match?.[0] || "";
  } catch {
    return "";
  }
}

function parseRowStatus(row: SheetRowRecord): "active" | "inactive" {
  const rawStatus = normalizeCell(getRowValue(row, ["status", "sync_status"])).toLowerCase();
  const rawIsActive = normalizeCell(getRowValue(row, ["is_active"])).toLowerCase();

  if (
    [
      "0",
      "false",
      "no",
      "hidden",
      "hide",
      "inactive",
      "off",
      "disabled",
      "paused",
      "pause",
    ].includes(rawIsActive)
  ) {
    return "inactive";
  }

  if (
    ["hidden", "hide", "inactive", "off", "disabled", "paused", "pause"].includes(rawStatus)
  ) {
    return "inactive";
  }

  return "active";
}

function parseProductStatus(row: SheetRowRecord): "active" | "pending_review" | "rejected" {
  const explicitStatus = normalizeCell(getRowValue(row, ["product_status", "review_status"]))
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const fallbackStatus = normalizeCell(getRowValue(row, ["status"]))
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    explicitStatus === "pending_review" ||
    explicitStatus === "rejected" ||
    explicitStatus === "active"
  ) {
    return explicitStatus;
  }

  if (fallbackStatus === "pending_review" || fallbackStatus === "rejected") {
    return fallbackStatus;
  }

  return "active";
}

function mapHeaderlessAsinGrid(values: string[][]): SheetRowRecord[] {
  const records: SheetRowRecord[] = [];

  for (const row of values) {
    for (const cell of row) {
      const normalized = normalizeCell(cell).toUpperCase();

      if (!isValidAsin(normalized)) {
        continue;
      }

      records.push({ asin: normalized });
    }
  }

  return records;
}
