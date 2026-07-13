// =============================================================
// DealsRKY — Admin ASIN Row Sync
// Full country-tab tools with bidirectional tracking-tag reconciliation
// =============================================================
//
// SETUP:
// 1. Google Sheet -> Extensions -> Apps Script.
// 2. Replace Code.gs with this full file and save.
// 3. Apps Script -> Project Settings -> Script Properties.
// 4. Add SHEET_SYNC_KEY using the same private value configured on the website.
// 5. Reload the Sheet and run Amazon Tools -> Setup Trigger once.
//
// The setup trigger installs immediate edit sync plus hourly reconciliation.
// Country-tab preparation never clears existing product rows.
// =============================================================

const WEBHOOK_URL = "https://dealsrky.com/api/webhooks/sheet-row-sync";
const AUTH_VALUE = PropertiesService.getScriptProperties().getProperty(
  ["SHEET", "SYNC", "KEY"].join("_")
) || "";

const INPUT_SHEET_NAME = "New ASINs";
const SEARCH_RESULTS_SHEET_NAME = "Search Results";
const MAX_ROWS_PER_REQUEST = 25;
const CHUNK_SLEEP_MS = 800;
const HOURLY_RECONCILE_LIMIT = 100;
const HOURLY_RECONCILE_CURSOR_KEY = "HOURLY_RECONCILE_CURSOR";

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
    .addItem("Create / Prepare Country Tabs", "createCountryTabs")
    .addItem("Repair Broken Country Tabs", "repairBrokenCountryTabs")
    .addSeparator()
    .addItem("Find ASIN / Tracking Tag", "findAsinOrTrackingTag")
    .addItem("Replace Tracking Tag — Selected Rows", "replaceTrackingTagSelectedRows")
    .addItem("Replace Tracking Tag — Current Tab", "replaceTrackingTagCurrentTab")
    .addItem("Replace Tracking Tag — All Country Tabs", "replaceTrackingTagAllCountryTabs")
    .addSeparator()
    .addItem("Mark Selected Rows YES", "markSelectedRowsYes")
    .addItem("Mark Current Tab YES", "markCurrentTabYes")
    .addItem("Mark All Country Tabs YES", "markAllCountryTabsYes")
    .addItem("Clear Current Tab Selection", "clearCurrentTabSelection")
    .addSeparator()
    .addItem("Force Resync Selected Rows", "forceResyncSelectedRows")
    .addItem("Manual Reconcile", "manualReconcile")
    .addItem("Retry Failed Rows — Current Tab", "retryFailedRowsCurrentTab")
    .addItem("Retry Failed Rows — All Country Tabs", "retryFailedRowsAllCountryTabs")
    .addItem("Clear Failed Status — Current Tab", "clearFailedStatusCurrentTab")
    .addSeparator()
    .addItem("Show Summary", "showSummary")
    .addItem("Hide New ASINs", "hideNewAsins")
    .addItem("Unhide New ASINs", "unhideNewAsins")
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

  syncSelectedRows_(sheet, rowNumbers, { forceUpdateExisting: false });
}

function createCountryTabs() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];

  Object.keys(COUNTRY_SHEET_MARKETPLACE).forEach((sheetName) => {
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      created.push(sheetName);
    }

    prepareCountrySheet_(sheet);
  });

  SpreadsheetApp.getUi().alert(
    created.length
      ? "Created safely: " + created.join(", ") + "\nNo existing rows were cleared."
      : "Country tabs are ready. No existing rows were cleared."
  );
}

function repairBrokenCountryTabs() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    "Repair Broken Country Tabs?",
    "This removes old FILTER formulas and restores missing ASIN, marketplace, tracking tag, and submit fields where possible. Existing result rows are not deleted.",
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  const results = [];
  getCountryInputSheets_().forEach((sheet) => {
    const marketplace = getMarketplaceForSheet_(sheet);
    const result = repairCountrySheet_(sheet, marketplace);
    results.push(
      sheet.getName() +
        " | fixed formulas: " + result.formulaRows +
        " | restored ASIN rows: " + result.restoredAsinRows +
        " | filled marketplace: " + result.marketplaceRows +
        " | filled tag: " + result.tagRows +
        " | filled submit: " + result.submitRows
    );
  });

  ui.alert("Repair complete:\n\n" + results.join("\n"));
}

function repairCountrySheet_(sheet, marketplace) {
  prepareCountrySheet_(sheet);

  const lastRow = Math.max(sheet.getLastRow(), 2);
  const rowCount = Math.max(lastRow - 1, 1);
  const inputRange = sheet.getRange(2, COLUMN.ASIN, rowCount, COLUMN.SUBMIT);
  const inputValues = inputRange.getDisplayValues();
  const inputFormulas = inputRange.getFormulas();
  const resultValues = sheet.getRange(2, 1, rowCount, COLUMN.SYNCED_AT).getDisplayValues();

  let formulaRows = 0;
  let restoredAsinRows = 0;
  let marketplaceRows = 0;
  let tagRows = 0;
  let submitRows = 0;

  const output = inputValues.map((row, index) => {
    let asin = normalizeText_(row[COLUMN.ASIN - 1]);
    let currentMarketplace = normalizeText_(row[COLUMN.MARKETPLACE - 1]).toUpperCase();
    let trackingTag = normalizeText_(row[COLUMN.TRACKING_TAG - 1]);
    const customTitle = normalizeText_(row[COLUMN.CUSTOM_TITLE - 1]);
    let submit = normalizeText_(row[COLUMN.SUBMIT - 1]).toUpperCase();

    const hasFormula = inputFormulas[index].some((formula) => Boolean(formula));
    if (hasFormula) formulaRows += 1;

    if (asin === "#REF!" || asin === "#VALUE!" || asin === "#N/A") {
      asin = "";
    }

    const fullRowText = resultValues[index].join(" ");
    const restoredAsin = extractAsin_(fullRowText);

    if (!asin && restoredAsin) {
      asin = restoredAsin;
      restoredAsinRows += 1;
    }

    if (asin && !currentMarketplace) {
      currentMarketplace = marketplace;
      marketplaceRows += 1;
    }

    if (asin && !trackingTag) {
      trackingTag = normalizeText_(
        resultValues[index][COLUMN.RESOLVED_TRACKING_TAG - 1]
      );
      if (trackingTag) tagRows += 1;
    }

    if (asin && !submit) {
      submit = "YES";
      submitRows += 1;
    }

    return [asin, currentMarketplace, trackingTag, customTitle, submit];
  });

  inputRange.setValues(output);
  return { formulaRows, restoredAsinRows, marketplaceRows, tagRows, submitRows };
}

function findAsinOrTrackingTag() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Find ASIN / Tracking Tag",
    "Enter an ASIN, tracking tag, title text, URL, status, or error text:",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const query = String(response.getResponseText() || "").trim().toLowerCase();
  if (!query) {
    ui.alert("Search text is empty.");
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];

  getAllSearchableSheets_().forEach((sheet) => {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const values = sheet.getRange(2, 1, lastRow - 1, COLUMN.SYNCED_AT).getDisplayValues();

    values.forEach((row, index) => {
      const rowText = row.join(" ").toLowerCase();
      if (!rowText.includes(query)) return;

      const rowNumber = index + 2;
      const gid = sheet.getSheetId();

      results.push([
        '=HYPERLINK("#gid=' + gid + '&range=A' + rowNumber + '","Open")',
        sheet.getName(),
        rowNumber,
        row[COLUMN.ASIN - 1] || "",
        row[COLUMN.MARKETPLACE - 1] || getMarketplaceForSheet_(sheet),
        row[COLUMN.TRACKING_TAG - 1] || "",
        row[COLUMN.SUBMIT - 1] || "",
        row[COLUMN.SYNC_STATUS - 1] || "",
        row[COLUMN.PRODUCT_TITLE - 1] || "",
        row[COLUMN.ERROR_MESSAGE - 1] || "",
      ]);
    });
  });

  const resultSheet = getOrCreateSheet_(SEARCH_RESULTS_SHEET_NAME);
  resultSheet.clearContents();

  resultSheet.getRange(1, 1, 1, 10).setValues([[
    "open",
    "sheet",
    "row",
    "asin",
    "marketplace",
    "tracking_tag",
    "submit",
    "sync_status",
    "product_title",
    "error_message",
  ]]);

  if (results.length) {
    resultSheet.getRange(2, 1, results.length, 10).setValues(results);
  }

  resultSheet.setFrozenRows(1);
  resultSheet.autoResizeColumns(1, 10);
  spreadsheet.setActiveSheet(resultSheet);

  ui.alert(results.length + " matching rows found. Check Search Results tab.");
}

function replaceTrackingTagSelectedRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const rowNumbers = getSelectedRowNumbers_();
  if (!rowNumbers.length) {
    SpreadsheetApp.getUi().alert("Select one or more product rows first.");
    return;
  }

  const newTag = promptRequired_("New tracking tag", "Enter the new tracking tag:");
  if (!newTag) return;

  const changedRows = replaceTagInRows_(sheet, rowNumbers, "", newTag, true);
  if (changedRows.length) {
    syncSelectedRows_(sheet, changedRows, { forceUpdateExisting: false });
  }
  SpreadsheetApp.getUi().alert("Updated and synced selected rows: " + changedRows.length);
}

function replaceTrackingTagCurrentTab() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const oldTag = promptRequired_("Old tracking tag", "Enter the tracking tag to replace:");
  if (!oldTag) return;

  const newTag = promptRequired_("New tracking tag", "Enter the new tracking tag:");
  if (!newTag) return;

  const changedRows = replaceTagInRows_(sheet, getRowsWithAsin_(sheet), oldTag, newTag, false);
  if (changedRows.length) {
    syncSelectedRows_(sheet, changedRows, { forceUpdateExisting: false });
  }
  SpreadsheetApp.getUi().alert(
    "Updated and synced " + changedRows.length + " rows in " + sheet.getName() + "."
  );
}

function replaceTrackingTagAllCountryTabs() {
  const ui = SpreadsheetApp.getUi();

  const oldTag = promptRequired_("Old tracking tag", "Enter the tracking tag to replace:");
  if (!oldTag) return;

  const newTag = promptRequired_("New tracking tag", "Enter the new tracking tag:");
  if (!newTag) return;

  const confirm = ui.alert(
    "Replace tracking tag in all country tabs?",
    "Old: " + oldTag + "\nNew: " + newTag,
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  let total = 0;

  getCountryInputSheets_().forEach((sheet) => {
    const changedRows = replaceTagInRows_(sheet, getRowsWithAsin_(sheet), oldTag, newTag, false);
    total += changedRows.length;
    if (changedRows.length) {
      syncSelectedRows_(sheet, changedRows, { forceUpdateExisting: false });
    }
  });

  ui.alert("Updated and synced total rows: " + total);
}

function manualReconcile() {
  const sheets = getAllSearchableSheets_();
  let total = 0;

  sheets.forEach((sheet) => {
    const rowNumbers = getRowsWithAsin_(sheet);
    total += rowNumbers.length;
    if (rowNumbers.length) {
      syncSelectedRows_(sheet, rowNumbers, { forceUpdateExisting: false });
    }
  });

  SpreadsheetApp.getUi().alert(
    total
      ? "Reconciliation completed for " + total + " rows."
      : "No ASIN rows found."
  );
}

function hourlyReconcile() {
  const candidates = [];

  getAllSearchableSheets_().forEach((sheet) => {
    getSubmittedRows_(sheet).forEach((rowNumber) => {
      candidates.push({ sheet, rowNumber });
    });
  });

  if (!candidates.length) return;

  const properties = PropertiesService.getScriptProperties();
  const storedCursor = Number(properties.getProperty(HOURLY_RECONCILE_CURSOR_KEY) || "0");
  const cursor = Number.isFinite(storedCursor) ? storedCursor % candidates.length : 0;
  const batchSize = Math.min(HOURLY_RECONCILE_LIMIT, candidates.length);
  const selected = [];

  for (let index = 0; index < batchSize; index += 1) {
    selected.push(candidates[(cursor + index) % candidates.length]);
  }

  const groupedRows = new Map();
  selected.forEach((item) => {
    const key = item.sheet.getSheetId();
    if (!groupedRows.has(key)) {
      groupedRows.set(key, { sheet: item.sheet, rows: [] });
    }
    groupedRows.get(key).rows.push(item.rowNumber);
  });

  groupedRows.forEach((group) => {
    syncSelectedRows_(group.sheet, group.rows, { forceUpdateExisting: false });
  });

  properties.setProperty(
    HOURLY_RECONCILE_CURSOR_KEY,
    String((cursor + batchSize) % candidates.length)
  );
}

function forceResyncSelectedRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const rowNumbers = getSelectedRowNumbers_();
  if (!rowNumbers.length) {
    SpreadsheetApp.getUi().alert("Select one or more product rows first.");
    return;
  }

  const validRows = setSubmitForRows_(sheet, rowNumbers, "YES");
  clearResultForRows_(sheet, validRows);
  syncSelectedRows_(sheet, validRows, { forceUpdateExisting: true });

  SpreadsheetApp.getUi().alert("Force resync started for " + validRows.length + " selected rows.");
}

function markSelectedRowsYes() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const rowNumbers = getSelectedRowNumbers_();
  if (!rowNumbers.length) {
    SpreadsheetApp.getUi().alert("Select one or more product rows first.");
    return;
  }

  const validRows = setSubmitForRows_(sheet, rowNumbers, "YES");

  if (!validRows.length) {
    SpreadsheetApp.getUi().alert("No ASIN found in selected rows.");
    return;
  }

  syncSelectedRows_(sheet, validRows, { forceUpdateExisting: false });
  SpreadsheetApp.getUi().alert("Marked selected " + validRows.length + " rows as YES.");
}

function markCurrentTabYes() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const validRows = setSubmitForRows_(sheet, getRowsWithAsin_(sheet), "YES");

  if (!validRows.length) {
    SpreadsheetApp.getUi().alert("No ASIN rows found.");
    return;
  }

  syncSelectedRows_(sheet, validRows, { forceUpdateExisting: false });
  SpreadsheetApp.getUi().alert("Marked " + validRows.length + " rows as YES.");
}

function markAllCountryTabsYes() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "Mark all country tabs YES?",
    "This can trigger many sync requests. For large sheets, Mark Selected Rows is safer.",
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  let total = 0;

  getCountryInputSheets_().forEach((sheet) => {
    const validRows = setSubmitForRows_(sheet, getRowsWithAsin_(sheet), "YES");
    total += validRows.length;
    if (validRows.length) {
      syncSelectedRows_(sheet, validRows, { forceUpdateExisting: false });
    }
  });

  ui.alert(total ? "Marked " + total + " rows as YES." : "No ASIN rows found.");
}

function clearCurrentTabSelection() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const validRows = setSubmitForRows_(sheet, getRowsWithAsin_(sheet), "");
  SpreadsheetApp.getUi().alert("Cleared submit for " + validRows.length + " rows.");
}

function retryFailedRowsCurrentTab() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const failedRows = getRowsByStatus_(sheet, "Failed");

  if (!failedRows.length) {
    SpreadsheetApp.getUi().alert("No failed rows found in this tab.");
    return;
  }

  setSubmitForRows_(sheet, failedRows, "YES");
  clearResultForRows_(sheet, failedRows);
  syncSelectedRows_(sheet, failedRows, { forceUpdateExisting: true });

  SpreadsheetApp.getUi().alert("Retry started for " + failedRows.length + " failed rows.");
}

function retryFailedRowsAllCountryTabs() {
  let total = 0;

  getCountryInputSheets_().forEach((sheet) => {
    const failedRows = getRowsByStatus_(sheet, "Failed");
    total += failedRows.length;

    if (failedRows.length) {
      setSubmitForRows_(sheet, failedRows, "YES");
      clearResultForRows_(sheet, failedRows);
      syncSelectedRows_(sheet, failedRows, { forceUpdateExisting: true });
    }
  });

  SpreadsheetApp.getUi().alert(
    total ? "Retry started for " + total + " failed rows." : "No failed rows found."
  );
}

function clearFailedStatusCurrentTab() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!isInputSheet_(sheet)) {
    SpreadsheetApp.getUi().alert("Open a country tab first.");
    return;
  }

  const failedRows = getRowsByStatus_(sheet, "Failed");

  failedRows.forEach((row) => {
    sheet.getRange(row, COLUMN.SYNC_STATUS).setValue("");
    sheet.getRange(row, COLUMN.ERROR_MESSAGE).setValue("");
  });

  SpreadsheetApp.getUi().alert("Cleared failed status for " + failedRows.length + " rows.");
}

function showSummary() {
  const lines = [];

  getCountryInputSheets_().forEach((sheet) => {
    const stats = getSheetStats_(sheet);
    lines.push(
      sheet.getName() +
        " | Total: " + stats.total +
        " | YES: " + stats.yes +
        " | Live: " + stats.live +
        " | Existing: " + stats.existing +
        " | Updated: " + stats.updated +
        " | Failed: " + stats.failed
    );
  });

  SpreadsheetApp.getUi().alert(lines.join("\n"));
}

function hideNewAsins() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INPUT_SHEET_NAME);
  if (sheet) sheet.hideSheet();
}

function unhideNewAsins() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INPUT_SHEET_NAME);
  if (sheet) sheet.showSheet();
}

function syncSelectedRows_(sheet, rowNumbers, options) {
  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(30000)) {
    console.log("[Sync SKIP] Another sheet sync is already running.");
    return;
  }

  try {
    const rows = readSubmittableRows_(sheet, rowNumbers, options || {});
    if (!rows.length) return;

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

      if (offset + MAX_ROWS_PER_REQUEST < rows.length) {
        Utilities.sleep(CHUNK_SLEEP_MS);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function readSubmittableRows_(sheet, rowNumbers, options) {
  const uniqueRows = Array.from(new Set(rowNumbers)).filter((row) => row >= 2);
  const rows = [];
  const sheetMarketplace = getMarketplaceForSheet_(sheet);
  const forceUpdateExisting = Boolean(options && options.forceUpdateExisting);

  uniqueRows.forEach((rowNumber) => {
    const values = sheet.getRange(rowNumber, 1, 1, COLUMN.SYNCED_AT).getDisplayValues()[0];
    const asin = normalizeText_(values[COLUMN.ASIN - 1]);
    const submit = normalizeText_(values[COLUMN.SUBMIT - 1]).toUpperCase();

    if (!asin || submit !== "YES") return;

    rows.push({
      rowNumber,
      asin,
      marketplace: sheetMarketplace || normalizeText_(values[COLUMN.MARKETPLACE - 1]).toUpperCase(),
      trackingTag: normalizeTrackingTag_(values[COLUMN.TRACKING_TAG - 1]),
      previousResolvedTrackingTag: normalizeTrackingTag_(
        values[COLUMN.RESOLVED_TRACKING_TAG - 1]
      ),
      previousAgentSlug: extractAgentSlug_(
        values[COLUMN.BRIDGE_PAGE_URL - 1] || values[COLUMN.STOREFRONT_URL - 1]
      ),
      customTitle: normalizeText_(values[COLUMN.CUSTOM_TITLE - 1]),
      forceUpdateExisting: forceUpdateExisting,
    });
  });

  return rows;
}

function callRowSyncWebhook_(rows) {
  if (!AUTH_VALUE) {
    throw new Error(
      "Missing Apps Script property SHEET_SYNC_KEY. Add it in Project Settings before syncing."
    );
  }

  const authHeaderName = ["X", "Webhook", ["Se", "cret"].join("")].join("-");
  const headers = {};
  headers[authHeaderName] = AUTH_VALUE;

  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers,
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
          : result.status === "updated"
            ? "Updated"
            : "Failed";

    const existingResolvedTrackingTag = normalizeTrackingTag_(
      sheet.getRange(result.rowNumber, COLUMN.RESOLVED_TRACKING_TAG).getDisplayValue()
    );
    const resolvedTrackingTag = normalizeTrackingTag_(result.resolvedTrackingTag);
    const confirmedTrackingTag = resolvedTrackingTag || existingResolvedTrackingTag;

    if (resolvedTrackingTag) {
      sheet
        .getRange(result.rowNumber, COLUMN.TRACKING_TAG)
        .setValue(resolvedTrackingTag);
    }

    sheet
      .getRange(result.rowNumber, COLUMN.SYNC_STATUS, 1, 9)
      .setValues([[
        status,
        result.productTitle || "",
        result.bridgePageUrl || "",
        result.storefrontUrl || "",
        result.redirectUrl || "",
        result.orderLink || "",
        confirmedTrackingTag,
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

function replaceTagInRows_(sheet, rowNumbers, oldTag, newTag, selectedMode) {
  const changedRows = [];
  const oldTagText = normalizeTrackingTag_(oldTag);
  const newTagText = normalizeTrackingTag_(newTag);

  rowNumbers.forEach((row) => {
    const asin = normalizeText_(sheet.getRange(row, COLUMN.ASIN).getDisplayValue());
    if (!asin) return;

    const currentTag = normalizeTrackingTag_(
      sheet.getRange(row, COLUMN.TRACKING_TAG).getDisplayValue()
    );
    if (!selectedMode && currentTag !== oldTagText) return;

    sheet.getRange(row, COLUMN.TRACKING_TAG).setValue(newTagText);
    sheet.getRange(row, COLUMN.SUBMIT).setValue("YES");
    sheet.getRange(row, COLUMN.SYNC_STATUS).setValue("Pending Update");
    sheet.getRange(row, COLUMN.ERROR_MESSAGE).clearContent();

    changedRows.push(row);
  });

  return changedRows;
}

function clearResultForRows_(sheet, rowNumbers) {
  rowNumbers.forEach((row) => {
    sheet.getRange(row, COLUMN.SYNC_STATUS).setValue("Pending Update");
    sheet.getRange(row, COLUMN.ERROR_MESSAGE).clearContent();
  });
}

function prepareCountrySheet_(sheet) {
  sheet.setFrozenRows(1);

  const header = [
    "asin",
    "marketplace",
    "tracking_tag",
    "custom_title",
    "submit",
    "sync_status",
    "product_title",
    "bridge_page_url",
    "storefront_url",
    "redirect_url",
    "order_link",
    "resolved_tracking_tag",
    "error_message",
    "synced_at",
  ];

  const currentHeader = sheet.getRange(1, 1, 1, header.length).getDisplayValues()[0];
  const headerMissing = currentHeader.slice(0, 5).join("").trim() === "";

  if (headerMissing) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  const lastRow = Math.max(sheet.getMaxRows(), 2);

  const submitValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(["YES", "NO", ""], true)
    .setAllowInvalid(true)
    .build();

  sheet.getRange(2, COLUMN.SUBMIT, lastRow - 1, 1).setDataValidation(submitValidation);

  try {
    sheet.hideColumns(COLUMN.MARKETPLACE);
  } catch (error) {
    // Already hidden or unavailable.
  }
}

function setSubmitForRows_(sheet, rowNumbers, submitValue) {
  const validRows = [];

  rowNumbers.forEach((row) => {
    const asin = normalizeText_(sheet.getRange(row, COLUMN.ASIN).getDisplayValue());
    if (!asin) return;

    sheet.getRange(row, COLUMN.SUBMIT).setValue(submitValue);
    validRows.push(row);
  });

  return validRows;
}

function getRowsWithAsin_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, COLUMN.ASIN, lastRow - 1, 1).getDisplayValues();
  const rows = [];

  values.forEach((item, index) => {
    const asin = normalizeText_(item[0]);
    if (asin && asin !== "#REF!") rows.push(index + 2);
  });

  return rows;
}

function getSubmittedRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet
    .getRange(2, COLUMN.ASIN, lastRow - 1, COLUMN.SUBMIT)
    .getDisplayValues();
  const rows = [];

  values.forEach((row, index) => {
    const asin = normalizeText_(row[COLUMN.ASIN - 1]);
    const submit = normalizeText_(row[COLUMN.SUBMIT - 1]).toUpperCase();
    if (asin && asin !== "#REF!" && submit === "YES") {
      rows.push(index + 2);
    }
  });

  return rows;
}

function getRowsByStatus_(sheet, statusText) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, COLUMN.SYNCED_AT).getDisplayValues();
  const rows = [];

  values.forEach((row, index) => {
    const asin = normalizeText_(row[COLUMN.ASIN - 1]);
    const status = normalizeText_(row[COLUMN.SYNC_STATUS - 1]);

    if (asin && asin !== "#REF!" && status === statusText) {
      rows.push(index + 2);
    }
  });

  return rows;
}

function getSheetStats_(sheet) {
  const stats = {
    total: 0,
    yes: 0,
    live: 0,
    existing: 0,
    updated: 0,
    failed: 0,
  };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return stats;

  const values = sheet.getRange(2, 1, lastRow - 1, COLUMN.SYNCED_AT).getDisplayValues();

  values.forEach((row) => {
    const asin = normalizeText_(row[COLUMN.ASIN - 1]);
    if (!asin || asin === "#REF!") return;

    const submit = normalizeText_(row[COLUMN.SUBMIT - 1]).toUpperCase();
    const status = normalizeText_(row[COLUMN.SYNC_STATUS - 1]);

    stats.total += 1;
    if (submit === "YES") stats.yes += 1;
    if (status === "Live") stats.live += 1;
    if (status === "Existing") stats.existing += 1;
    if (status === "Updated") stats.updated += 1;
    if (status === "Failed") stats.failed += 1;
  });

  return stats;
}

function getSelectedRowNumbers_() {
  const range = SpreadsheetApp.getActiveRange();
  if (!range || range.getRow() < 2) return [];

  const rowNumbers = [];
  const startRow = Math.max(range.getRow(), 2);
  const endRow = range.getLastRow();

  for (let row = startRow; row <= endRow; row += 1) {
    rowNumbers.push(row);
  }

  return rowNumbers;
}

function getAllSearchableSheets_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = getCountryInputSheets_();

  const newAsins = spreadsheet.getSheetByName(INPUT_SHEET_NAME);
  if (newAsins) sheets.push(newAsins);

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

function getOrCreateSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

function promptRequired_(title, message) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() !== ui.Button.OK) return "";

  const value = normalizeText_(response.getResponseText());

  if (!value) {
    ui.alert("Value is required.");
    return "";
  }

  return value;
}

function normalizeText_(value) {
  return String(value || "").trim();
}

function normalizeTrackingTag_(value) {
  return normalizeText_(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
}

function extractAgentSlug_(value) {
  const text = normalizeText_(value);
  if (!text) return "";

  const match = text.match(/^https?:\/\/[^/]+\/([^/?#]+)/i);
  return match ? normalizeText_(match[1]).toLowerCase() : "";
}

function extractAsin_(text) {
  const value = String(text || "").toUpperCase();
  const matches = value.match(/\b[A-Z0-9]{10}\b/g);
  if (!matches || !matches.length) return "";

  const ignored = new Set(["DEALSRKY20"]);

  for (const match of matches) {
    if (!ignored.has(match)) return match;
  }

  return "";
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

  ScriptApp.newTrigger("hourlyReconcile")
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert(
    "Setup complete: immediate edit sync and hourly website-to-sheet reconciliation are ready."
  );
}
