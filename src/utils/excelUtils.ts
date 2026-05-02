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

    if (cellValues.every((v) => v === null || v === "" || v === undefined)) return;

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
