import { describe, expect, it } from "vitest";

const scriptModules = import.meta.glob("../../docs/google-apps-script-sheet-sync.js", {
  eager: true,
  query: "?raw",
  import: "default",
});

const script = Object.values(scriptModules)[0] as string;

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
    expect(script).toContain('const SCRIPT_VERSION = "2026.07.14-safe-reconcile";');
    expect(script).toContain("function runSystemCheck()");
    expect(script).toContain("SHEET_SYNC_KEY is missing from Script Properties.");
    expect(script).toContain("Header mismatch: ");
    expect(script).toContain("Blank tracking + resolved tag protected: ");
    expect(script).toContain("Blank tracking + blank resolved (default candidates): ");
  });
});
