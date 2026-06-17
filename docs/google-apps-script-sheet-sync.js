// =============================================================
// DealsRKY — Google Sheet Auto-Sync to Website
// =============================================================
//
// SETUP INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Delete any existing code in Code.gs
// 4. Paste this entire script
// 5. Replace YOUR_WEBHOOK_URL and YOUR_WEBHOOK_SECRET below
// 6. Click Save (Ctrl+S)
// 7. Click Run > select "setupTrigger" > Run
// 8. Authorize the permissions when prompted
//
// After setup, every time you add/edit/delete a row,
// the website will sync within seconds.
// =============================================================

// ─── CONFIGURATION ──────────────────────────────────────────
// Replace these values before saving:

const WEBHOOK_URL = "YOUR_WEBHOOK_URL";   // e.g. https://dealsrky.com/api/webhooks/sheet-sync
const WEBHOOK_SECRET = "YOUR_WEBHOOK_SECRET"; // shared secret from your admin

// ─── WEBHOOK CALLER ─────────────────────────────────────────
function triggerSync() {
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: "post",
      headers: {
        "X-Webhook-Secret": WEBHOOK_SECRET,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({
        source: "google-sheet",
        timestamp: new Date().toISOString(),
      }),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code >= 200 && code < 300) {
      console.log("[Sync OK] " + body);
    } else {
      console.error("[Sync FAIL] Status: " + code + " Body: " + body);
    }
  } catch (error) {
    console.error("[Sync ERROR] " + error.message);
  }
}

// ─── ON-EDIT TRIGGER (instant, fires on every cell edit) ────
function onEdit(e) {
  triggerSync();
}

// ─── ON-CHANGE TRIGGER (fires on row add/delete/paste) ──────
function onChange(e) {
  if (e.changeType === "INSERT_ROW" || e.changeType === "REMOVE_ROW" || e.changeType === "PASTE") {
    triggerSync();
  }
}

// ─── SETUP: Run this once to install triggers ────────────────
function setupTrigger() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();

  // Remove old triggers first to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }

  // Install onChange trigger (row add/delete/paste)
  ScriptApp.newTrigger("onChange")
    .forSpreadsheet(sheet)
    .onChange()
    .create();

  console.log("[Setup] Trigger installed successfully!");
  SpreadsheetApp.getUi().alert("Auto-sync trigger installed! Website will sync on every sheet change.");
}

// ─── MANUAL SYNC: Run this anytime to force a sync ───────────
function manualSync() {
  triggerSync();
  SpreadsheetApp.getUi().alert("Sync triggered! Website will update within seconds.");
}
