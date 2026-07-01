/**
 * excelUtils.ts
 * Browser-side Excel template download & upload using ExcelJS + file-saver.
 * ExcelJS produces real OOXML data-validation dropdowns — SheetJS did not.
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface ExcelField {
  field: string;
  label: string;
  type?: string;
  require?: boolean;
  options?: { label: string; value: any }[];
}

/* ─── DOWNLOAD TEMPLATE ────────────────────────────────────────────────────
 * Sheet 1 "Template"  — header + hint row, dropdown validations on data rows
 * Sheet 2 "Options"   — human-readable label / ID reference for every select
 */
export async function downloadExcelTemplate(
  fields: ExcelField[],
  filename: string = "template"
): Promise<void> {
  const inputFields = fields.filter(
    (f) => !["file", "checkbox", "switch"].includes(f.type ?? "")
  );
  const selectFields = inputFields.filter(
    (f) => f.type === "select" && f.options && f.options.length > 0
  );

  const wb = new ExcelJS.Workbook();

  /* ── Sheet 1: Template ── */
  const ws = wb.addWorksheet("Template");

  
  // Column definitions — visible columns + hidden option-list columns
  ws.columns = [
    ...inputFields.map((f) => ({
      header: `${f.label}${f.require ? " *" : ""}`,
      key: f.field,
      width: Math.max(f.label.length + 4, 20),
    })),
    // Hidden columns hold option labels for data-validation list references
    ...selectFields.map((f) => ({
      header: `__${f.field}_opts`,
      key: `__${f.field}_opts`,
      width: 20,
      hidden: true,
    })),
  ];

  // Header row styling (row 1)
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber > inputFields.length) return; // skip hidden cols
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(1).height = 22;

  // Hint row (row 2)
  const hintRow = ws.addRow(
    inputFields.map((f) => {
      if (f.type === "select" && f.options && f.options.length > 0) return "↓ Select from list";
      if (f.type === "number") return "Number";
      if (f.type === "date") return "YYYY-MM-DD";
      return "Text";
    })
  );
  hintRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const f = inputFields[colNumber - 1];
    const isSelect = f?.type === "select" && f?.options && f.options!.length > 0;
    cell.font = { italic: true, color: { argb: isSelect ? "FFD97706" : "FF9CA3AF" } };
  });

  // Write option labels into hidden columns (starting from row 1 so the reference range is clean)
  selectFields.forEach((f) => {
    const col = ws.getColumn(`__${f.field}_opts`);
    (f.options || []).forEach((opt, rIdx) => {
      ws.getCell(rIdx + 1, col.number).value = String(opt.label);
    });
  });

  // Data-validation dropdowns on rows 3–1000
  inputFields.forEach((f, colIdx) => {
    if (f.type !== "select" || !f.options || f.options.length === 0) return;

    const optCount = f.options.length;
    const hiddenCol = ws.getColumn(`__${f.field}_opts`);
    const hiddenColLetter = columnIndexToLetter(hiddenCol.number);
    const inputColLetter = columnIndexToLetter(colIdx + 1);

    (ws as any).dataValidations.add(`${inputColLetter}3:${inputColLetter}1000`, {
      type: "list",
      allowBlank: true,
      formulae: [`$${hiddenColLetter}$1:$${hiddenColLetter}$${optCount}`],
      showErrorMessage: true,
      error: `Please select a valid ${f.label} from the dropdown.`,
      errorTitle: "Invalid Selection",
      errorStyle: "warning",
      showInputMessage: true,
      prompt: `Choose a ${f.label}`,
      promptTitle: f.label,
    });
  });

  /* ── Sheet 2: Options reference ── */
  if (selectFields.length > 0) {
    const wsOpts = wb.addWorksheet("Options");

    wsOpts.columns = selectFields.flatMap((f) => [
      { header: `${f.label} — Label`, key: `${f.field}_label`, width: Math.max(f.label.length + 16, 28) },
      { header: `${f.label} — ID`,    key: `${f.field}_id`,    width: 18 },
    ]);

    // Header styling
    wsOpts.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const isLabel = colNumber % 2 === 1;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isLabel ? "FF059669" : "FF6B7280" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    wsOpts.getRow(1).height = 22;

    const maxRows = Math.max(...selectFields.map((f) => (f.options || []).length));
    for (let i = 0; i < maxRows; i++) {
      const rowData: any[] = [];
      for (const f of selectFields) {
        const opt = (f.options || [])[i];
        rowData.push(opt ? String(opt.label) : "");
        rowData.push(opt ? String(opt.value) : "");
      }
      const dataRow = wsOpts.addRow(rowData);
      const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF0FDF4";
      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      });
    }
  }

  // Write & trigger download
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename.replace(/\s+/g, "_").toLowerCase()}_template.xlsx`
  );
}

/* ─── PARSE UPLOADED EXCEL ─────────────────────────────────────────────────
 * Reads an .xlsx file and maps columns by header label.
 * Returns plain objects keyed by `field`. Skips the hint row automatically.
 * For select fields, matches by label OR raw value so users can type either.
 */
export async function parseExcelFile(
  file: File,
  fields: ExcelField[]
): Promise<{ rows: Record<string, any>[]; errors: string[] }> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0]; // always read the first sheet ("Template")
  if (!ws) return { rows: [], errors: ["Excel has no worksheets."] };

  const allRows: ExcelJS.Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => allRows.push(row));

  if (allRows.length < 2) return { rows: [], errors: ["Excel has no data rows."] };

  // Row 1 = headers
  const headerRow = allRows[0];
  const headerValues: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    headerValues.push(String(cell.value ?? "").trim().replace(/\s?\*$/, ""));
  });

  // Build label→field map (case-insensitive)
  const labelToField: Record<string, string> = {};
  fields.forEach((f) => { labelToField[f.label.toLowerCase()] = f.field; });

  const colToField: (string | null)[] = headerValues.map((h) => labelToField[h.toLowerCase()] ?? null);

  // Detect hint row (row 2)
  const secondRowFirstCell = String(allRows[1]?.getCell(1).value ?? "");
  const hasHintRow =
    secondRowFirstCell.startsWith("↓") ||
    secondRowFirstCell === "Number" ||
    secondRowFirstCell === "Text" ||
    secondRowFirstCell === "YYYY-MM-DD";
  const dataRows = allRows.slice(hasHintRow ? 2 : 1);

  const rows: Record<string, any>[] = [];
  const errors: string[] = [];
  const baseRowNum = hasHintRow ? 3 : 2;

  dataRows.forEach((row, idx) => {
    const cellValues: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cellValues.push(cell.value);
    });

    // Only check known data columns — hidden option columns (colToField[i] === null) would
    // otherwise cause option-list rows (e.g. 1187 product names) to look like real data rows.
    const hasDataInKnownCols = colToField.some(
      (fieldName, colIdx) =>
        fieldName !== null &&
        cellValues[colIdx] !== null &&
        cellValues[colIdx] !== "" &&
        cellValues[colIdx] !== undefined
    );
    if (!hasDataInKnownCols) return;

    const obj: Record<string, any> = {};
    colToField.forEach((fieldName, colIdx) => {
      if (!fieldName) return;
      const fieldDef = fields.find((f) => f.field === fieldName);
      let val = cellValues[colIdx] ?? "";

      if (fieldDef?.type === "number") {
        val = parseFloat(String(val)) || 0;
      } else if (fieldDef?.type === "date" && val instanceof Date) {
        const d = val as Date;
        val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      } else {
        val = String(val ?? "").trim();
      }

      // Match select by label OR value
      if (fieldDef?.options && fieldDef.options.length > 0 && typeof val === "string") {
        const match = fieldDef.options.find(
          (o) =>
            o.label.toLowerCase() === val.toLowerCase() ||
            String(o.value).toLowerCase() === val.toLowerCase()
        );
        if (match) val = match.value;
      }

      obj[fieldName] = val;
    });

    const missingRequired = fields
      .filter((f) => f.require && (obj[f.field] === "" || obj[f.field] == null))
      .map((f) => f.label);

    if (missingRequired.length > 0) {
      errors.push(`Row ${baseRowNum + idx}: Missing required — ${missingRequired.join(", ")}`);
      return;
    }

    rows.push(obj);
  });

  return { rows, errors };
}

/* ─── QUOTATION ITEMS EXCEL DOWNLOAD ───────────────────────────────────────
 * Downloads an Excel pre-filled with read-only item info (prod_name, spec, unit).
 * Editable pricing columns (qty, unit_price, disc, tax, delivery, remarks) are
 * highlighted amber so the user knows what to fill in.
 */
export interface QuotationItemRow {
  prod_name: string;
  specification: string;
  qty: number;
  unit_name: string;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  delivery_days: number;
  remarks: string;
}

export interface QuotationItemParsed {
  qty: number;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  delivery_days: number;
  remarks: string;
}

export async function downloadQuotationItemsExcel(
  items: QuotationItemRow[],
  filename: string = "quotation_items"
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Quotation Items");

  ws.columns = [
    { header: "#",             key: "sno",           width: 6  },
    { header: "Item / Product",key: "prod_name",     width: 32 },
    { header: "Specification", key: "specification",  width: 30 },
    { header: "Unit",          key: "unit_name",      width: 12 },
    { header: "Qty *",         key: "qty",            width: 10 },
    { header: "Unit Price *",  key: "unit_price",     width: 14 },
    { header: "Disc %",        key: "discount_pct",   width: 10 },
    { header: "Tax %",         key: "tax_pct",        width: 10 },
    { header: "Delivery Days", key: "delivery_days",  width: 14 },
    { header: "Remarks",       key: "remarks",        width: 30 },
  ];
  const READ_ONLY_COLS = 4; // first 4 columns are display-only

  // Header row styling
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const isEditable = col > READ_ONLY_COLS;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEditable ? "FFD97706" : "FF6B7280" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(1).height = 22;

  // Hint row
  const hints = ["", "Read-only", "Read-only", "Read-only", "Number", "Number (required)", "0–100", "0–100", "Days", "Text"];
  const hintRow = ws.addRow(hints);
  hintRow.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { italic: true, color: { argb: col > READ_ONLY_COLS ? "FFD97706" : "FF9CA3AF" } };
    if (col <= READ_ONLY_COLS) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    }
  });

  // Data rows
  items.forEach((item, idx) => {
    const row = ws.addRow([
      idx + 1,
      item.prod_name,
      item.specification,
      item.unit_name,
      item.qty,
      item.unit_price || "",
      item.discount_pct || "",
      item.tax_pct || "",
      item.delivery_days || "",
      item.remarks || "",
    ]);

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const isEditable = col > READ_ONLY_COLS;
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: isEditable ? "FFFEF9C3" : "FFF9FAFB" },
      };
      if (!isEditable) cell.font = { color: { argb: "FF6B7280" } };
      cell.border = {
        top:    { style: "thin", color: { argb: "FFE5E7EB" } },
        left:   { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right:  { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  ws.views = [{ state: "frozen", ySplit: 2 }];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename.replace(/\s+/g, "_").toLowerCase()}.xlsx`
  );
}

/* ─── QUOTATION ITEMS EXCEL PARSE ──────────────────────────────────────────
 * Reads a file produced by downloadQuotationItemsExcel (or compatible format).
 * Returns one QuotationItemParsed per data row; row order matches original items.
 */
export async function parseQuotationItemsExcel(
  file: File
): Promise<{ items: QuotationItemParsed[]; errors: string[] }> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) return { items: [], errors: ["Excel has no worksheets."] };

  const allRows: ExcelJS.Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => allRows.push(row));

  if (allRows.length < 3) return { items: [], errors: ["No data rows found (expected header + hint + data rows)."] };

  const dataRows = allRows.slice(2); // skip header and hint
  const items: QuotationItemParsed[] = [];
  const errors: string[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 3;
    const num = (col: number) => parseFloat(String(row.getCell(col).value ?? "")) || 0;
    const str = (col: number) => String(row.getCell(col).value ?? "").trim();

    const unit_price = num(6);
    if (unit_price <= 0) {
      errors.push(`Row ${rowNum} (${str(2) || "item"}): Unit Price must be greater than 0`);
    }

    items.push({
      qty:           num(5),
      unit_price,
      discount_pct:  num(7),
      tax_pct:       num(8),
      delivery_days: num(9),
      remarks:       str(10),
    });
  });

  return { items, errors };
}

/* ── helper: 1-based column index → Excel letter (A, B, …, Z, AA, …) ── */
function columnIndexToLetter(index: number): string {
  let result = "";
  while (index > 0) {
    const rem = (index - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    index = Math.floor((index - 1) / 26);
  }
  return result;
}
