import { describe, expect, it } from "vitest";

const scriptModules = import.meta.glob("../../docs/google-apps-script-sheet-sync.js", {
  eager: true,
  query: "?raw",
  import: "default",
});

const script = Object.values(scriptModules)[0] as string;

function extractFunctionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Function ${name} was not found in the Apps Script.`);

  const bodyStart = script.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }

  throw new Error(`Function ${name} has an incomplete body.`);
}

function loadScriptFunction<T>(name: string, dependencies: string[] = []): T {
  const source = dependencies
    .map((dependency) => extractFunctionSource(dependency))
    .concat(extractFunctionSource(name))
    .join("\n");

  return new Function(`${source}\nreturn ${name};`)() as T;
}

describe("admin Google Apps Script safety", () => {
  it("uses the last resolved tag when the editable tracking cell is blank", () => {
    expect(script).toContain(
      "trackingTag: sheetTrackingTag || previousResolvedTrackingTag"
    );
  });

  it("only replaces triggers managed by the sheet sync script", () => {
    expect(script).toContain(
      'const managedHandlerNames = new Set(["onAdminSheetEdit", "hourlyReconcile"]);'
    );
    expect(script).toContain(
      "managedHandlerNames.has(trigger.getHandlerFunction())"
    );
  });

  it("reports only rows that are actually eligible for reconciliation", () => {
    const manualReconcileStart = script.indexOf("function manualReconcile()");
    const hourlyReconcileStart = script.indexOf("function hourlyReconcile()");
    const manualReconcileSource = script.slice(
      manualReconcileStart,
      hourlyReconcileStart
    );

    expect(manualReconcileSource).toContain("getSubmittedRows_(sheet)");
    expect(manualReconcileSource).not.toContain("getRowsWithAsin_(sheet)");
  });

  it("includes a versioned system check for key, headers, triggers, and blank tags", () => {
    expect(script).toContain('const SCRIPT_VERSION = "2026.11.02-rate-limit-recovery-v4";');
    expect(script).toContain("function runSystemCheck()");
    expect(script).toContain("SHEET_SYNC_KEY is missing from Script Properties.");
    expect(script).toContain("Header mismatch: ");
    expect(script).toContain("Blank tracking + resolved tag protected: ");
    expect(script).toContain("Blank tracking + blank resolved (default candidates): ");
    expect(script).toContain("Submitted rows missing marketplace: ");
    expect(script).toContain("Rows with invalid tracking-tag format: ");
    expect(script).toContain("Rows stuck in Processing for over 15 minutes: ");
    expect(script).toContain(
      "Duplicate marketplace/ASIN products with conflicting tracking tags: "
    );
    expect(script).toContain("Duplicate submitted rows: ");
  });

  it("retries only pending/transient failures after cooldown, not successful or invalid rows", () => {
    const column = {
      ASIN: 1, SUBMIT: 5, SYNC_STATUS: 6, ERROR_MESSAGE: 13, SYNCED_AT: 14,
    };
    const eligible = new Function(
      "COLUMN",
      extractFunctionSource("isAutoRetryEligible_") + "\nreturn isAutoRetryEligible_;"
    )(column) as (row: string[], now: number, failedOnly: boolean) => boolean;
    const now = Date.parse("2026-11-02T12:00:00.000Z");
    const row = (status: string, error = "", agoHours = 0) => {
      const cells = Array<string>(14).fill("");
      cells[0] = "B0SAMPLE01";
      cells[4] = "YES";
      cells[5] = status;
      cells[12] = error;
      cells[13] = new Date(now - agoHours * 3_600_000).toISOString();
      return cells;
    };
    expect(eligible(row(""), now, false)).toBe(true);
    expect(eligible(row("Existing"), now, false)).toBe(false);
    expect(eligible(row("Live"), now, false)).toBe(false);
    expect(eligible(row("Failed", "temporarily rate limited", 1), now, false)).toBe(false);
    expect(eligible(row("Failed", "temporarily rate limited", 7), now, false)).toBe(true);
    expect(eligible(row("Failed", "no live product data", 7), now, false)).toBe(false);
    expect(eligible(row("Failed", "no live product data", 25), now, false)).toBe(true);
    expect(eligible(row("Failed", "Provide a valid 10-character ASIN", 72), now, false)).toBe(false);
    expect(eligible(row("Failed", "Invalid webhook secret", 72), now, false)).toBe(false);
    expect(eligible(row("Failed", "HTTP 503: server error", 7), now, false)).toBe(true);
    expect(eligible(row("Processing", "", 0.1), now, false)).toBe(false);
    expect(eligible(row("Processing", "", 1), now, false)).toBe(true);
    expect(eligible(row(""), now, true)).toBe(false);
    expect(eligible(row("Failed", "rate limited", 7), now, true)).toBe(true);
  });

  it("does not force-refresh or erase successful link fields when retrying failures", () => {
    const current = script.slice(
      script.indexOf("function retryFailedRowsCurrentTab()"),
      script.indexOf("function retryFailedRowsAllCountryTabs()")
    );
    const all = script.slice(
      script.indexOf("function retryFailedRowsAllCountryTabs()"),
      script.indexOf("function clearFailedStatus")
    );
    expect(current).not.toContain("clearResultForRows_");
    expect(all).not.toContain("clearResultForRows_");
    expect(current).toContain("forceUpdateExisting: false");
    expect(all).toContain("forceUpdateExisting: false");
    expect(script).toContain("const HOURLY_RECONCILE_LIMIT = 12;");
    expect(script).toContain("getAutoRetryRows_(sheet, Date.now(), false)");
  });

  it("recovers the agent slug from both public and tracked redirect URLs", () => {
    const extractAgentSlug = loadScriptFunction<(value: unknown) => string>(
      "extractAgentSlug_",
      ["normalizeText_"]
    );

    expect(extractAgentSlug("https://dealsrky.com/dealsrkyuk/uk/B0ABC12345")).toBe(
      "dealsrkyuk"
    );
    expect(extractAgentSlug("https://dealsrky.com/go/dealsrkyuk/uk/B0ABC12345")).toBe(
      "dealsrkyuk"
    );
  });

  it("preserves last-known successful output when a row-level sync fails", () => {
    const writeResultsStart = script.indexOf("function writeResults_");
    const writeChunkFailureStart = script.indexOf("function writeChunkFailure_");
    const writeResultsSource = script.slice(writeResultsStart, writeChunkFailureStart);

    expect(writeResultsSource).toContain('if (status === "Failed")');
    expect(writeResultsSource).toContain("must not erase the last known");
    expect(writeResultsSource).not.toContain('result.errorMessage || "",');
  });

  it("rejects incomplete or duplicate webhook row results", () => {
    expect(script).toContain("Webhook returned an unexpected or duplicate row result.");
    expect(script).toContain("Webhook did not return a result for every submitted row.");
  });

  it("limits error text to a safe Google Sheets cell size", () => {
    const truncateCellText = loadScriptFunction<(value: unknown) => string>(
      "truncateCellText_"
    );
    const longText = "x".repeat(6000);
    const truncated = truncateCellText(longText);

    expect(truncated).toHaveLength(5000);
    expect(truncated.endsWith("...")).toBe(true);
  });

  it("accepts full Amazon tracking tags and rejects malformed values", () => {
    const isValidTrackingTag = loadScriptFunction<(value: unknown) => boolean>(
      "isValidTrackingTag_",
      ["normalizeText_", "normalizeTrackingTag_"]
    );

    expect(isValidTrackingTag("dealsrkyuk-21")).toBe(true);
    expect(isValidTrackingTag("")).toBe(true);
    expect(isValidTrackingTag("not a tracking tag")).toBe(false);
  });
});
