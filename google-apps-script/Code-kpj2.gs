const SHEET_NAMES = {
  budgetConfig: "BudgetConfig",
};

const SPREADSHEET_ID = "PUT_YOUR_SPREADSHEET_ID_HERE";

const CATEGORY_HEADERS = ["Category", "Budget"];
const CATEGORY_SHEET_HEADERS = [
  "ที่",
  "ชื่อ - สกุล",
  "เบิกแล้ว",
  "คงเหลือ",
  "เบิกครั้งนี้",
  "ยอดรวม",
  "วัน/เดือน/ปี",
];

function doGet(e) {
  try {
    setupSheets_();
    const payload = e && e.parameter && e.parameter.mode === "snapshot"
      ? getSnapshot_()
      : {
          ok: true,
          message: "PEA Budget KPJ2 endpoint is ready.",
        };

    return output_(payload, e);
  } catch (error) {
    return output_({
      ok: false,
      error: String(error && error.message ? error.message : error),
    }, e);
  }
}

function doPost(e) {
  try {
    setupSheets_();
    const payload = parsePayload_(e);

    if (payload.type === "bulk") {
      replaceCategories_(payload.categories || []);
      replaceCategorySheets_(payload.transactions || []);
      return json_({
        ok: true,
        mode: "bulk",
        count: (payload.transactions || []).length,
      });
    }

    if (payload.type === "single" && payload.transaction) {
      appendTransactionToCategorySheet_(payload.transaction);
      return json_({
        ok: true,
        mode: "single",
        id: payload.transaction.id,
        category: payload.transaction.category,
      });
    }

    if (payload.type === "delete" && payload.transaction) {
      const deleted = deleteTransactionFromCategorySheet_(payload.transaction);
      return json_({
        ok: true,
        mode: "delete",
        deleted: deleted,
        category: payload.transaction.category,
      });
    }

    return json_({
      ok: false,
      error: "Unknown payload type.",
    });
  } catch (error) {
    return json_({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function parsePayload_(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }

  throw new Error("Missing payload.");
}

function setupSheets_() {
  const spreadsheet = getSpreadsheet_();
  const configSheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.budgetConfig);
  ensureHeader_(configSheet, CATEGORY_HEADERS);
}

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  if (SPREADSHEET_ID && SPREADSHEET_ID !== "PUT_YOUR_SPREADSHEET_ID_HERE") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  throw new Error("Spreadsheet not found. Bind this script to a Google Sheet or set SPREADSHEET_ID.");
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeader_(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some((value) => value !== "");

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function replaceCategories_(categories) {
  const spreadsheet = getSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.budgetConfig);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]);
  sheet.setFrozenRows(1);

  if (!categories.length) return;

  const rows = categories.map((item) => [
    item.name || "",
    Number(item.budget || 0),
  ]);
  sheet.getRange(2, 1, rows.length, CATEGORY_HEADERS.length).setValues(rows);
}

function replaceCategorySheets_(transactions) {
  const spreadsheet = getSpreadsheet_();
  const grouped = {};
  const categories = getConfiguredCategoryNames_();

  transactions.forEach((item) => {
    const category = String(item.category || "").trim();
    if (!category) return;
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  });

  categories.forEach((category) => {
    const sheet = getOrCreateCategorySheet_(spreadsheet, category);
    resetCategorySheet_(sheet);
    const carryOver = getCategoryCarryOver_(category);
    (grouped[category] || []).forEach((item) => appendTransactionRow_(sheet, item, carryOver));
  });
}

function getConfiguredCategoryNames_() {
  const spreadsheet = getSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.budgetConfig);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map((row) => String(row[0] || "").trim())
    .filter((name) => name !== "");
}

function getOrCreateCategorySheet_(spreadsheet, categoryName) {
  const sheet = getOrCreateSheet_(spreadsheet, categoryName);
  ensureHeader_(sheet, CATEGORY_SHEET_HEADERS);
  return sheet;
}

function resetCategorySheet_(sheet) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, CATEGORY_SHEET_HEADERS.length).setValues([CATEGORY_SHEET_HEADERS]);
  sheet.setFrozenRows(1);
}

function appendTransactionToCategorySheet_(transaction) {
  const spreadsheet = getSpreadsheet_();
  const categoryName = String(transaction.category || "").trim();
  if (!categoryName) {
    throw new Error("Missing category.");
  }

  const sheet = getOrCreateCategorySheet_(spreadsheet, categoryName);
  appendTransactionRow_(sheet, transaction, getCategoryCarryOver_(categoryName));
}

function getCategoryCarryOver_(categoryName) {
  const spreadsheet = getSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.budgetConfig);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const match = values.find((row) => String(row[0]).trim() === String(categoryName).trim());
  return Number(match && match[1] ? match[1] : 0);
}

function appendTransactionRow_(sheet, transaction, carryOver) {
  const dataStartRow = 2;
  const lastRow = Math.max(sheet.getLastRow(), dataStartRow);
  const dataRowCount = Math.max(lastRow - 1, 1);
  const existingRows = sheet.getRange(dataStartRow, 1, dataRowCount, CATEGORY_SHEET_HEADERS.length).getValues();
  const populatedRows = existingRows.filter((row) => row.slice(1).some((cell) => cell !== ""));
  const nextIndex = populatedRows.length + 1;
  let usedBefore = Number(carryOver || 0);

  if (populatedRows.length) {
    const lastValues = populatedRows[populatedRows.length - 1];
    usedBefore = Number(lastValues[5] || 0);
  }

  const amount = Number(transaction.amount || 0);
  const totalAfter = usedBefore + amount;
  const row = [
    nextIndex,
    transaction.employee || "",
    usedBefore,
    "-",
    amount,
    totalAfter,
    transaction.date || "",
  ];

  const firstEmptyOffset = existingRows.findIndex((existingRow) => existingRow.slice(1).every((cell) => cell === ""));
  const targetRow = firstEmptyOffset >= 0 ? dataStartRow + firstEmptyOffset : lastRow + 1;
  sheet.getRange(targetRow, 1, 1, CATEGORY_SHEET_HEADERS.length).setValues([row]);
}

function deleteTransactionFromCategorySheet_(transaction) {
  const spreadsheet = getSpreadsheet_();
  const categoryName = String(transaction.category || "").trim();
  if (!categoryName) {
    throw new Error("Missing category.");
  }

  const sheet = spreadsheet.getSheetByName(categoryName);
  if (!sheet || sheet.getLastRow() < 2) return false;

  const lastRow = sheet.getLastRow();
  const rows = sheet.getRange(2, 1, lastRow - 1, CATEGORY_SHEET_HEADERS.length).getValues();
  const targetIndex = rows.findIndex((row) => transactionRowMatches_(row, transaction));
  if (targetIndex < 0) return false;

  const remainingTransactions = rows
    .filter((row, index) => index !== targetIndex && row.slice(1).some((cell) => cell !== ""))
    .map((row) => ({
      date: row[6] || "",
      category: categoryName,
      employee: row[1] || "",
      detail: "",
      amount: Number(row[4] || 0),
      note: "",
    }));

  resetCategorySheet_(sheet);
  const carryOver = getCategoryCarryOver_(categoryName);
  remainingTransactions.forEach((item) => appendTransactionRow_(sheet, item, carryOver));
  return true;
}

function transactionRowMatches_(row, transaction) {
  return normalizeDate_(row[6]) === normalizeDate_(transaction.date)
    && normalize_(row[1]) === normalize_(transaction.employee)
    && Number(row[4] || 0) === Number(transaction.amount || 0);
}

function normalizeDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const text = normalize_(value);
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoDate ? isoDate[1] : text;
}

function normalize_(value) {
  return String(value == null ? "" : value).trim();
}

function getSnapshot_() {
  const spreadsheet = getSpreadsheet_();
  const configSheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.budgetConfig);
  const configLastRow = configSheet.getLastRow();
  const categoryRows = configLastRow >= 2
    ? configSheet.getRange(2, 1, configLastRow - 1, 2).getValues()
    : [];

  const categories = categoryRows
    .filter((row) => row[0] !== "")
    .map((row) => ({
      name: String(row[0]).trim(),
      budget: Number(row[1] || 0),
    }));

  const transactions = [];
  let nextId = 1;

  categories.forEach((category) => {
    const sheet = spreadsheet.getSheetByName(category.name);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const rows = sheet.getRange(2, 1, lastRow - 1, CATEGORY_SHEET_HEADERS.length).getValues();
    rows.forEach((row) => {
      if (!row.slice(1).some((cell) => cell !== "")) return;
      transactions.push({
        id: nextId++,
        date: row[6] || "",
        category: category.name,
        employee: row[1] || "",
        detail: "",
        amount: Number(row[4] || 0),
        note: "",
      });
    });
  });

  return {
    ok: true,
    categories: categories,
    transactions: transactions,
    updatedAt: new Date().toISOString(),
  };
}

function output_(data, e) {
  const callback = e && e.parameter ? e.parameter.callback : "";
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(data);
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
