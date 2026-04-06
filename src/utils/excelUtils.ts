/**
 * excelUtils.ts
 * Browser-side Excel template download & upload using SheetJS (xlsx).
 * No server required — everything runs in the client.
 */

import * as XLSX from "xlsx";

export interface ExcelField {
  field: string;   // JS key name
  label: string;   // Column header shown in Excel
  type?: string;   // 'number' | 'text' | 'select' | etc.
  require?: boolean;
  options?: { label: string; value: any }[];
}

/* ─── DOWNLOAD TEMPLATE ────────────────────────────────────────────────────
 * Creates an .xlsx file with:
 *  Row 1 — header row (bold, colored background)
 *  Row 2 — example/hint row (grey italic text)
 *  Columns sized to content
 */
export function downloadExcelTemplate(
  fields: ExcelField[],
  filename: string = "template"
): void {
  // Only include text/number/select fields — skip file/switch/checkbox
  const inputFields = fields.filter(
    (f) => !["file", "checkbox", "switch"].includes(f.type ?? "")
  );

  const headers = inputFields.map((f) => {
    const mark = f.require ? " *" : "";
    return `${f.label}${mark}`;
  });

  // Hint row: show allowed values for selects, or type hint
  const hints = inputFields.map((f) => {
    if (f.options && f.options.length > 0) {
      const vals = f.options.map((o) => o.label).slice(0, 5).join(" / ");
      return `Options: ${vals}${f.options.length > 5 ? "…" : ""}`;
    }
    if (f.type === "number") return "Number";
    if (f.type === "date") return "YYYY-MM-DD";
    return "Text";
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, hints]);

  // Column widths
  ws["!cols"] = inputFields.map((f) => ({
    wch: Math.max(f.label.length + 4, 18),
  }));

  // Style header row cells
  inputFields.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F46E5" } }, // indigo
      alignment: { horizontal: "center" },
    };
  });

  // Style hint row
  inputFields.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 1, c: colIdx });
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font: { italic: true, color: { rgb: "9CA3AF" } },
    };
  });

  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `${filename.replace(/\s+/g, "_").toLowerCase()}_template.xlsx`);
}

/* ─── PARSE UPLOADED EXCEL ─────────────────────────────────────────────────
 * Reads an .xlsx/.xls/.csv file and maps columns by header label.
 * Returns an array of plain objects keyed by `field` name.
 * Skips the hint row if its first cell starts with "Options:" or "Number" etc.
 */
export async function parseExcelFile(
  file: File,
  fields: ExcelField[]
): Promise<{ rows: Record<string, any>[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
        }) as any[][];

        if (rawRows.length < 2) {
          resolve({ rows: [], errors: ["Excel has no data rows."] });
          return;
        }

        // First row = headers
        const headerRow: string[] = (rawRows[0] as string[]).map((h) =>
          String(h ?? "")
            .trim()
            .replace(/\s?\*$/, "") // strip required marker
        );

        // Build label→field map (case-insensitive)
        const labelToField: Record<string, string> = {};
        fields.forEach((f) => {
          labelToField[f.label.toLowerCase()] = f.field;
        });

        // Map header columns to field names
        const colToField: (string | null)[] = headerRow.map((h) => {
          const key = h.toLowerCase();
          return labelToField[key] ?? null;
        });

        const rows: Record<string, any>[] = [];
        const errors: string[] = [];

        // Determine if row 2 is the hint row
        const firstDataRowIdx = (() => {
          if (rawRows.length < 2) return 1;
          const secondRow = String(rawRows[1][0] ?? "");
          const isHint =
            secondRow.startsWith("Options:") ||
            secondRow === "Number" ||
            secondRow === "Text" ||
            secondRow === "YYYY-MM-DD";
          return isHint ? 2 : 1;
        })();

        rawRows.slice(firstDataRowIdx).forEach((row, idx) => {
          // Skip completely empty rows
          if ((row as any[]).every((cell) => cell === "" || cell == null)) return;

          const obj: Record<string, any> = {};
          colToField.forEach((fieldName, colIdx) => {
            if (!fieldName) return;
            const fieldDef = fields.find((f) => f.field === fieldName);
            let val = row[colIdx] ?? "";

            // Type coercion
            if (fieldDef?.type === "number") {
              val = parseFloat(String(val)) || 0;
            } else if (fieldDef?.type === "date" && typeof val === "number") {
              // Excel date serial → JS Date → ISO string
              const d = XLSX.SSF.parse_date_code(val);
              val = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
            } else {
              val = String(val).trim();
            }

            // If it's a select field, try to match label → value
            if (fieldDef?.options && fieldDef.options.length > 0 && typeof val === "string") {
              const match = fieldDef.options.find(
                (o) => o.label.toLowerCase() === val.toLowerCase()
              );
              if (match) val = match.value;
            }

            obj[fieldName] = val;
          });

          // Basic required-field validation
          const missingRequired = fields
            .filter((f) => f.require && (obj[f.field] === "" || obj[f.field] == null))
            .map((f) => f.label);

          if (missingRequired.length > 0) {
            errors.push(
              `Row ${firstDataRowIdx + idx + 1}: Missing required — ${missingRequired.join(", ")}`
            );
            return;
          }

          rows.push(obj);
        });

        resolve({ rows, errors });
      } catch (err: any) {
        resolve({ rows: [], errors: [`Failed to parse file: ${err.message}`] });
      }
    };

    reader.onerror = () => {
      resolve({ rows: [], errors: ["Failed to read file."] });
    };

    reader.readAsArrayBuffer(file);
  });
}
