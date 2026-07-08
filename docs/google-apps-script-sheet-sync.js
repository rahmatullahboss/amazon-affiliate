// =============================================================
// DealsRKY — Admin ASIN Row Sync
// =============================================================
//
// SETUP:
// 1. Open the Google Sheet and go to Extensions > Apps Script.
// 2. Replace Code.gs with this file.
// 3. Set WEBHOOK_SECRET below.
// 4. Save, reload the Sheet, select setupTrigger, and click Run once.
// 5. Allow the requested permissions.
//
// No Apps Script deployment is required.
//
// USAGE:
// - Use the original "New ASINs" tab when you want to select marketplace per row.
// - Or use Amazon Tools > Create Country Tabs to create one tab per marketplace.
// - In country tabs, marketplace is detected from the tab name, so no row-level
//   country selection is needed.
// - Use Amazon Tools > Mark Current Tab YES for bulk submit.
// =============================================================

const WEBHOOK_URL = "https://dealsrky.com/api/webhooks/sheet-row-sync";
const WEBHOOK_SECRET = "YOUR_WEBHOOK_SECRET";
const INPUT_SHEET_NAME = "New ASINs";
const MAX_ROWS_PER_REQUEST = 100;

const COUNTRY_SHEET_MARKETPLACE = {
  "ASINs-US": "US",
  "ASINs-CA": "CA",
  "ASINs-UK": "UK",
  "ASINs-DE": "DE",
  "ASINs-FR": "FR",
  "ASINs-IT": "IT",
  "ASINs-ES": "ES",
};

const COLUMN = {
  ASIN: 1,
  MARKETPLACE: 2,
  TRACKING_TAG: 3,
  CUSTOM_TITLE: 4,
  SUBMIT: 5,
  SYNC_STATUS: 6,
  PRODUCT_TITLE: 7,
  BRIDGE_PAGE_URL: 8,
  STOREFRONT_URL: 9,
  REDIRECT_URL: 10,
  ORDER_LINK: 11,
  RESOLVED_TRACKING_TAG: 12,
  ERROR_MESSAGE: 13,
  SYNCED_AT: 14,
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Amazon Tools")
    .addItem("Create Country Tabs", "createCountryTabs")
    .addSeparator()
    .addItem("Mark Current Tab YES", "markCurrentTabYes")
    .addItem("Mark All Country Tabs YES", "markAllCountryTabsYes")
    .addItem("Clear Current Tab Selection", "clearCurrentTabSelection")
    .addSeparator()
    .addItem("Manual Reconcile", "manualReconcile")
    .addItem("Setup Trigger", "setupTrigger")
    .addToUi();
}

function onAdminSheetEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (!isInputSheet_(sheet)) return;
  if (e.range.getRow() < 2) return;

  const firstColumn = e.range.getColumn();
  const lastColumn = firstColumn + e.range.getNumColumns() - 1;
  if (firstColumn > COLUMN.SUBMIT || lastColumn < COLUMN.ASIN) return;

  const rowNumbers = [];
  for (let row = e.range.getRow(); row <= e.range.getLastRow(); row += 1) {
    rowNumbers.push(row);
  }

  syncSelectedRows_(sheet, rowNumbers);
}

function createCountryTabs() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const template = spreadsheet.getSheetByName(INPUT_SHEET_NAME) || spreadsheet.getActiveSheet();
  const created = [];

  Object.keys(COUNTRY_SHEET_MARKETPLACE).forEach((sheetName) => {
    if (spreadsheet.getSheetByName(sheetName)) return;

    const sheet = template.copyTo(spreadsheet).setName(sheetName);
    prepareCountrySheet_(sheet, COUNTRY_SHEET_MARKETPLACE[sheetName]);
    created.push(sheetName);
  });

  SpreadsheetApp.getUi().alert(
    created.length > 0
      ? "Created country tabs: " + created.join(", ")
      : "Country tabs already exist."
  );
}

function markCurrentTabYes() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open New ASINs or a country tab first.");
    return;
  }

  const rowNumbers = markSheetSubmit_(sheet, "YES");
  if (rowNumbers.length === 0) {
    SpreadsheetApp.getUi().alert("No ASIN rows found in this tab.");
    return;
  }

  syncSelectedRows_(sheet, rowNumbers);
  SpreadsheetApp.getUi().alert("Marked " + rowNumbers.length + " rows as YES and started sync.");
}

function markAllCountryTabsYes() {
  const sheets = getCountryInputSheets_();
  let total = 0;

  sheets.forEach((sheet) => {
    const rowNumbers = markSheetSubmit_(sheet, "YES");
    total += rowNumbers.length;
    if (rowNumbers.length > 0) {
      syncSelectedRows_(sheet, rowNumbers);
    }
  });

  SpreadsheetApp.getUi().alert(
    total > 0
      ? "Marked " + total + " country-tab rows as YES and started sync."
      : "No ASIN rows found in country tabs."
  );
}

function clearCurrentTabSelection() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open New ASINs or a country tab first.");
    return;
  }

  const rowNumbers = markSheetSubmit_(sheet, "");
  SpreadsheetApp.getUi().alert("Cleared submit value for " + rowNumbers.length + " rows.");
}

function manualReconcile() {
  const sheets = getInputSheets_();
  let total = 0;

  sheets.forEach((sheet) => {
    const rowNumbers = getSheetRowNumbers_(sheet);
    total += rowNumbers.length;
    if (rowNumbers.length > 0) {
      syncSelectedRows_(sheet, rowNumbers);
    }
  });

  SpreadsheetApp.getUi().alert(
    total > 0 ? "Reconciliation completed for " + total + " rows." : "No ASIN rows found."
  );
}

function dailyReconcile() {
  getInputSheets_().forEach((sheet) => {
    const rowNumbers = getSheetRowNumbers_(sheet);
    if (rowNumbers.length > 0) {
      syncSelectedRows_(sheet, rowNumbers);
    }
  });
}

function syncSelectedRows_(sheet, rowNumbers) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    console.log("[Sync SKIP] Another sheet sync is already running.");
    return;
  }

  try {
    const rows = readSubmittableRows_(sheet, rowNumbers);
    if (rows.length === 0) return;

    for (let offset = 0; offset < rows.length; offset += MAX_ROWS_PER_REQUEST) {
      const chunk = rows.slice(offset, offset + MAX_ROWS_PER_REQUEST);
      markRowsProcessing_(sheet, chunk);
      SpreadsheetApp.flush();

      try {
        const results = callRowSyncWebhook_(chunk);
        writeResults_(sheet, results);
      } catch (error) {
        writeChunkFailure_(sheet, chunk, error.message || "Webhook request failed.");
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function readSubmittableRows_(sheet, rowNumbers) {
  const uniqueRows = Array.from(new Set(rowNumbers)).filter((row) => row >= 2);
  const rows = [];
  const sheetMarketplace = getMarketplaceForSheet_(sheet);

  uniqueRows.forEach((rowNumber) => {
    const values = sheet.getRange(rowNumber, 1, 1, COLUMN.SYNCED_AT).getDisplayValues()[0];
    const asin = String(values[COLUMN.ASIN - 1] || "").trim();
    const submit = String(values[COLUMN.SUBMIT - 1] || "").trim().toUpperCase();
    if (!asin || submit !== "YES") return;

    rows.push({
      rowNumber,
      asin,
      marketplace: sheetMarketplace || String(values[COLUMN.MARKETPLACE - 1] || "").trim().toUpperCase(),
      trackingTag: String(values[COLUMN.TRACKING_TAG - 1] || "").trim(),
      customTitle: String(values[COLUMN.CUSTOM_TITLE - 1] || "").trim(),
    });
  });

  return rows;
}

function callRowSyncWebhook_(rows) {
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    payload: JSON.stringify({ rows }),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("HTTP " + statusCode + ": " + responseText);
  }

  const payload = JSON.parse(responseText);
  if (!payload || !Array.isArray(payload.results)) {
    throw new Error("Webhook returned an invalid response.");
  }
  return payload.results;
}

function markRowsProcessing_(sheet, rows) {
  rows.forEach((row) => {
    sheet.getRange(row.rowNumber, COLUMN.SYNC_STATUS).setValue("Processing");
    sheet.getRange(row.rowNumber, COLUMN.ERROR_MESSAGE).clearContent();
  });
}

function writeResults_(sheet, results) {
  results.forEach((result) => {
    const status =
      result.status === "live"
        ? "Live"
        : result.status === "existing"
          ? "Existing"
          : "Failed";

    sheet
      .getRange(result.rowNumber, COLUMN.SYNC_STATUS, 1, 9)
      .setValues([[
        status,
        result.productTitle || "",
        result.bridgePageUrl || "",
        result.storefrontUrl || "",
        result.redirectUrl || "",
        result.orderLink || "",
        result.resolvedTrackingTag || "",
        result.errorMessage || "",
        result.syncedAt || new Date().toISOString(),
      ]]);
  });
}

function writeChunkFailure_(sheet, rows, message) {
  rows.forEach((row) => {
    sheet.getRange(row.rowNumber, COLUMN.SYNC_STATUS).setValue("Failed");
    sheet.getRange(row.rowNumber, COLUMN.ERROR_MESSAGE).setValue(message);
    sheet.getRange(row.rowNumber, COLUMN.SYNCED_AT).setValue(new Date().toISOString());
  });
}

function prepareCountrySheet_(sheet, marketplace) {
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const lastColumn = Math.max(sheet.getLastColumn(), COLUMN.SYNCED_AT);

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
  }

  sheet.getRange(2, COLUMN.MARKETPLACE, Math.max(lastRow - 1, 1), 1).setValue(marketplace);
  sheet.hideColumns(COLUMN.MARKETPLACE);
  sheet.setFrozenRows(1);
}

function markSheetSubmit_(sheet, submitValue) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const asinValues = sheet.getRange(2, COLUMN.ASIN, lastRow - 1, 1).getDisplayValues();
  const submitValues = [];
  const rowNumbers = [];

  asinValues.forEach((row, index) => {
    const asin = String(row[0] || "").trim();
    submitValues.push([asin ? submitValue : ""]);
    if (asin) rowNumbers.push(index + 2);
  });

  sheet.getRange(2, COLUMN.SUBMIT, submitValues.length, 1).setValues(submitValues);
  return rowNumbers;
}

function getSheetRowNumbers_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rowNumbers = [];
  for (let row = 2; row <= lastRow; row += 1) {
    rowNumbers.push(row);
  }
  return rowNumbers;
}

function getInputSheets_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [];
  const primarySheet = spreadsheet.getSheetByName(INPUT_SHEET_NAME);

  if (primarySheet) sheets.push(primarySheet);
  getCountryInputSheets_().forEach((sheet) => sheets.push(sheet));

  if (sheets.length === 0) {
    throw new Error('No input sheet was found. Expected "' + INPUT_SHEET_NAME + '" or a country tab.');
  }

  return sheets;
}

function getCountryInputSheets_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return Object.keys(COUNTRY_SHEET_MARKETPLACE)
    .map((sheetName) => spreadsheet.getSheetByName(sheetName))
    .filter((sheet) => Boolean(sheet));
}

function isInputSheet_(sheet) {
  if (!sheet) return false;
  return sheet.getName() === INPUT_SHEET_NAME || Boolean(getMarketplaceForSheet_(sheet));
}

function getMarketplaceForSheet_(sheet) {
  return COUNTRY_SHEET_MARKETPLACE[sheet.getName()] || "";
}

function setupTrigger() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger("onAdminSheetEdit")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger("dailyReconcile")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  SpreadsheetApp.getUi().alert(
    "Setup complete: country tabs, bulk YES menu, immediate sync, and daily reconciliation are ready."
  );
}
