import React, { useState, useRef, useCallback } from "react";
import {
  Plus, Trash2, CheckCircle2, XCircle,
  Loader2, ArrowLeft, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import usePost from "@/hooks/usePostHook";
import { apiPostCommonMaster } from "@/Services/Api";

/* ── Types ─────────────────────────────────────────────────────────────── */
type Option = { label: string; value: string | number };

export type SpreadsheetField = {
  field: string;
  label: string;
  type?: string;
  require?: boolean;
  options?: Option[];
  input?: boolean;
};

type RowStatus = "idle" | "saving" | "saved" | "error";
type CellErrors = Record<string, string | null>;

type GridRow = {
  id: string;
  data: Record<string, any>;
  errors: CellErrors;
  status: RowStatus;
  statusMsg?: string;
};

interface InlineSpreadsheetGridProps {
  fields: SpreadsheetField[];
  master: string;
  onClose: () => void;
  onSaved?: () => void;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const INITIAL_ROWS = 5;

const COL_MIN_WIDTH: Record<string, number> = {
  textarea: 220,
  select: 180,
  number: 120,
};
const defaultColWidth = (f: SpreadsheetField) =>
  COL_MIN_WIDTH[f.type ?? ""] ?? 160;

/* ── Component ──────────────────────────────────────────────────────────── */
const InlineSpreadsheetGrid: React.FC<InlineSpreadsheetGridProps> = ({
  fields,
  master,
  onClose,
  onSaved,
}) => {
  // Only show editable input fields
  const inputFields = fields.filter((f) => f.input !== false);

  const makeEmptyRow = useCallback(
    (): GridRow => ({
      id: genId(),
      data: Object.fromEntries(inputFields.map((f) => [f.field, ""])),
      errors: {},
      status: "idle",
    }),
    [inputFields]
  );

  const [rows, setRows] = useState<GridRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, makeEmptyRow)
  );
  const [saving, setSaving] = useState(false);
  const { postData } = usePost();

  // Tracks which cell is the paste anchor
  const [focusedCell, setFocusedCell] = useState<{ rowIdx: number; colIdx: number }>({ rowIdx: 0, colIdx: 0 });

  // 2-D ref grid: cellRefs.current[rowIdx][colIdx]
  const cellRefs = useRef<
    (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)[][]
  >([]);

  /* ── Focus helper ── */
  const focusCell = (rowIdx: number, colIdx: number) => {
    requestAnimationFrame(() => {
      cellRefs.current[rowIdx]?.[colIdx]?.focus();
    });
  };

  /* ── Keyboard nav: Tab / Enter ── */
  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number
  ) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (colIdx + 1 < inputFields.length) {
        focusCell(rowIdx, colIdx + 1);
      } else if (rowIdx + 1 < rows.length) {
        focusCell(rowIdx + 1, 0);
      } else {
        // last cell of last row → add new row
        setRows((prev) => {
          const updated = [...prev, makeEmptyRow()];
          requestAnimationFrame(() => focusCell(updated.length - 1, 0));
          return updated;
        });
      }
    } else if (
      e.key === "Enter" &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault();
      if (rowIdx + 1 < rows.length) {
        focusCell(rowIdx + 1, colIdx);
      } else {
        setRows((prev) => {
          const updated = [...prev, makeEmptyRow()];
          requestAnimationFrame(() => focusCell(updated.length - 1, colIdx));
          return updated;
        });
      }
    }
  };

  /* ── Cell value change ── */
  const setCellValue = (rowId: string, field: string, value: any) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              data: { ...row.data, [field]: value },
              errors: { ...row.errors, [field]: null },
            }
          : row
      )
    );
  };

  /* ── Row management ── */
  const addRow = () => {
    setRows((prev) => {
      const updated = [...prev, makeEmptyRow()];
      requestAnimationFrame(() => focusCell(updated.length - 1, 0));
      return updated;
    });
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  /* ── Clipboard paste (Ctrl+V from Excel / Sheets) ── */
  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    // Parse TSV — rows split by newline, cells by tab
    const pastedRows = text
      .split(/\r?\n/)
      .map((line) => line.split("\t"))
      .filter((cells) => cells.some((c) => c.trim() !== ""));

    if (pastedRows.length === 0) return;

    // Single-cell paste (one row, one column) → let the input handle it natively
    if (pastedRows.length === 1 && pastedRows[0].length === 1) return;

    e.preventDefault();

    const { rowIdx: anchorRow, colIdx: anchorCol } = focusedCell;

    setRows((prev) => {
      const updated = [...prev];

      for (let r = 0; r < pastedRows.length; r++) {
        const targetRowIdx = anchorRow + r;

        // Grow grid if paste goes beyond existing rows
        while (updated.length <= targetRowIdx) {
          updated.push(makeEmptyRow());
        }

        const row = updated[targetRowIdx];
        // Never overwrite already-saved rows
        if (row.status === "saved") continue;

        const newData = { ...row.data };
        const newErrors = { ...row.errors };

        for (let c = 0; c < pastedRows[r].length; c++) {
          const targetColIdx = anchorCol + c;
          if (targetColIdx >= inputFields.length) break;

          const field = inputFields[targetColIdx];
          let value = pastedRows[r][c].trim();

          // For select fields: try to match pasted label → stored value
          if (field.type === "select" && field.options && field.options.length > 0 && value !== "") {
            const match = field.options.find(
              (o) =>
                o.label.toLowerCase() === value.toLowerCase() ||
                String(o.value).toLowerCase() === value.toLowerCase()
            );
            if (match) value = String(match.value);
          }

          newData[field.field] = value;
          newErrors[field.field] = null;
        }

        updated[targetRowIdx] = { ...row, data: newData, errors: newErrors, status: "idle" };
      }

      return updated;
    });

    const pastedRowCount = pastedRows.length;
    const pastedColCount = Math.max(...pastedRows.map((r) => r.length));
    toast.success(
      `Pasted ${pastedRowCount} row${pastedRowCount !== 1 ? "s" : ""} × ${pastedColCount} column${pastedColCount !== 1 ? "s" : ""}`
    );
  };

  const isRowEmpty = (row: GridRow) =>
    inputFields.every(
      (f) => row.data[f.field] === "" || row.data[f.field] == null
    );

  /* ── Validation ── */
  const validateAll = (): boolean => {
    let allValid = true;
    const updated = rows.map((row) => {
      if (isRowEmpty(row)) return { ...row, errors: {} };

      const errors: CellErrors = {};

      inputFields.forEach((f) => {
        const val = row.data[f.field];
        const empty = val === "" || val == null;

        // Required
        if (f.require && empty) {
          errors[f.field] = `${f.label} is required`;
          allValid = false;
          return;
        }

        // Select: value must exist in options list
        if (
          f.type === "select" &&
          f.options &&
          f.options.length > 0 &&
          !empty
        ) {
          const found = f.options.find(
            (o) => String(o.value) === String(val)
          );
          if (!found) {
            errors[f.field] = `"${val}" is not in ${f.label} master`;
            allValid = false;
          }
        }
      });

      return { ...row, errors };
    });

    setRows(updated);
    return allValid;
  };

  /* ── Save all ── */
  const handleSaveAll = async () => {
    if (!validateAll()) {
      toast.error("Fix validation errors before saving");
      return;
    }

    const toSave = rows.filter(
      (r) => !isRowEmpty(r) && r.status !== "saved"
    );
    if (toSave.length === 0) {
      toast.info("No new rows to save");
      return;
    }

    setSaving(true);
    let ok = 0;
    let fail = 0;

    for (const row of toSave) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, status: "saving" } : r
        )
      );
      try {
        await postData(apiPostCommonMaster(master), row.data);
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, status: "saved" } : r
          )
        );
        ok++;
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Save failed";
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, status: "error", statusMsg: msg }
              : r
          )
        );
        fail++;
      }
    }

    setSaving(false);
    if (ok > 0) {
      toast.success(`${ok} record${ok !== 1 ? "s" : ""} saved`);
      onSaved?.();
    }
    if (fail > 0) {
      toast.error(`${fail} record${fail !== 1 ? "s" : ""} failed — see red rows`);
    }
  };

  /* ── Derived counts ── */
  const filledCount  = rows.filter((r) => !isRowEmpty(r)).length;
  const savedCount   = rows.filter((r) => r.status === "saved").length;
  const errorCount   = rows.filter((r) => r.status === "error").length;
  const pendingCount = rows.filter(
    (r) => !isRowEmpty(r) && r.status === "idle"
  ).length;

  const masterLabel = master.replace(/Master$/, " Master").trim();

  /* ── Render ── */
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5 text-muted-foreground -ml-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-sm font-semibold">
              Bulk Entry — {masterLabel}
            </h2>
            <p className="text-xs text-muted-foreground">
              Fill rows · Tab / Enter to navigate · Copy columns in Excel/Sheets and Ctrl+V to paste
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSaveAll}
          disabled={saving || filledCount === 0}
          className="gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {saving ? "Saving…" : `Save All${filledCount ? ` (${filledCount})` : ""}`}
        </Button>
      </div>

      {/* ── Legend strip ── */}
      <div className="flex items-center gap-4 px-5 py-1.5 border-b bg-muted/30 text-xs text-muted-foreground shrink-0 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-100 dark:bg-green-900/40 border border-green-400 dark:border-green-700" />
          Saved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-700" />
          API error
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-400 dark:border-amber-700" />
          Validation error
        </span>
        <span className="ml-auto">
          {savedCount > 0 && (
            <span className="text-green-600 dark:text-green-400 mr-3">
              {savedCount} saved
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-red-600 dark:text-red-400 mr-3">
              {errorCount} failed
            </span>
          )}
          {pendingCount > 0 && (
            <span>{pendingCount} pending</span>
          )}
        </span>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto" onPaste={handleContainerPaste}>
        <table className="border-collapse w-max min-w-full text-sm">

          {/* Header */}
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <tr>
              <th className="border border-border w-10 text-xs font-medium text-center text-muted-foreground px-1 py-2 select-none">
                #
              </th>
              {inputFields.map((f) => (
                <th
                  key={f.field}
                  className="border border-border text-xs font-medium text-left text-muted-foreground px-2 py-2 whitespace-nowrap"
                  style={{ minWidth: defaultColWidth(f) }}
                >
                  {f.label}
                  {f.require && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </th>
              ))}
              {/* Status */}
              <th className="border border-border w-16 text-xs font-medium text-center text-muted-foreground px-1 py-2">
                Status
              </th>
              {/* Delete */}
              <th className="border border-border w-10" />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIdx) => {
              if (!cellRefs.current[rowIdx]) cellRefs.current[rowIdx] = [];
              const rowHasValidationError = Object.values(row.errors).some(Boolean);
              const rowBg = cn(
                row.status === "saved" &&
                  "bg-green-50 dark:bg-green-950/20",
                row.status === "error" &&
                  "bg-red-50 dark:bg-red-950/20",
                rowHasValidationError &&
                  row.status === "idle" &&
                  "bg-amber-50/60 dark:bg-amber-950/10"
              );

              return (
                <tr key={row.id} className={cn("group", rowBg)}>

                  {/* Row number */}
                  <td className="border border-border text-xs text-center text-muted-foreground px-1 py-0 font-mono select-none w-10">
                    {rowIdx + 1}
                  </td>

                  {/* Data cells */}
                  {inputFields.map((f, colIdx) => {
                    const cellError = row.errors[f.field];
                    const val = row.data[f.field] ?? "";
                    const locked =
                      row.status === "saved" || row.status === "saving";

                    const baseCell = cn(
                      "w-full bg-transparent outline-none",
                      "focus:bg-primary/5 dark:focus:bg-primary/10",
                      locked && "pointer-events-none opacity-60"
                    );

                    return (
                      <td
                        key={f.field}
                        className={cn(
                          "border p-0 relative",
                          cellError
                            ? "border-red-400 dark:border-red-600"
                            : "border-border"
                        )}
                        title={cellError ?? undefined}
                        style={{ minWidth: defaultColWidth(f) }}
                      >
                        {f.type === "select" && f.options ? (
                          <select
                            ref={(el) => {
                              cellRefs.current[rowIdx][colIdx] = el;
                            }}
                            className={cn(
                              baseCell,
                              "h-8 px-2 cursor-pointer appearance-none"
                            )}
                            value={String(val)}
                            onChange={(e) =>
                              setCellValue(row.id, f.field, e.target.value)
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, rowIdx, colIdx)
                            }
                            onFocus={() => setFocusedCell({ rowIdx, colIdx })}
                            disabled={locked}
                          >
                            <option value="">— select —</option>
                            {f.options.map((o) => (
                              <option
                                key={o.value}
                                value={String(o.value)}
                              >
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "textarea" ? (
                          <textarea
                            ref={(el) => {
                              cellRefs.current[rowIdx][colIdx] =
                                el as any;
                            }}
                            className={cn(
                              baseCell,
                              "px-2 py-1 resize-none"
                            )}
                            rows={2}
                            value={val}
                            onChange={(e) =>
                              setCellValue(row.id, f.field, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Tab")
                                handleKeyDown(e, rowIdx, colIdx);
                            }}
                            onFocus={() => setFocusedCell({ rowIdx, colIdx })}
                            disabled={locked}
                          />
                        ) : (
                          <input
                            ref={(el) => {
                              cellRefs.current[rowIdx][colIdx] = el;
                            }}
                            type={
                              f.type === "number" ? "number" : "text"
                            }
                            className={cn(baseCell, "h-8 px-2")}
                            value={val}
                            onChange={(e) =>
                              setCellValue(row.id, f.field, e.target.value)
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, rowIdx, colIdx)
                            }
                            onFocus={() => setFocusedCell({ rowIdx, colIdx })}
                            disabled={locked}
                          />
                        )}

                        {/* Error icon overlay */}
                        {cellError && (
                          <div
                            className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"
                            title={cellError}
                          >
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Status cell */}
                  <td className="border border-border text-center px-1 py-0 w-16">
                    {row.status === "saving" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mx-auto" />
                    )}
                    {row.status === "saved" && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mx-auto" />
                    )}
                    {row.status === "error" && (
                      <span title={row.statusMsg}>
                        <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto cursor-help" />
                      </span>
                    )}
                    {row.status === "idle" && rowHasValidationError && (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                    )}
                  </td>

                  {/* Delete row button */}
                  <td className="border border-border text-center px-1 py-0 w-10">
                    <button
                      className={cn(
                        "p-1 rounded text-muted-foreground",
                        "opacity-0 group-hover:opacity-100",
                        "hover:text-destructive hover:bg-destructive/10 transition-all",
                        (row.status === "saving" ||
                          row.status === "saved" ||
                          rows.length === 1) &&
                          "pointer-events-none opacity-0"
                      )}
                      onClick={() => removeRow(row.id)}
                      title="Remove row"
                      tabIndex={-1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Add row button as a full-width row */}
            <tr>
              <td
                colSpan={inputFields.length + 3}
                className="border-t border-border p-0"
              >
                <button
                  className="flex items-center gap-1.5 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                  onClick={addRow}
                  tabIndex={-1}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="border-t px-5 py-2.5 bg-card flex items-center justify-between text-xs text-muted-foreground shrink-0">
        <span>
          {savedCount > 0 && (
            <span className="text-green-600 dark:text-green-400 mr-3">
              ✓ {savedCount} saved
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-red-600 dark:text-red-400 mr-3">
              ✗ {errorCount} failed
            </span>
          )}
          {pendingCount > 0 && <span>{pendingCount} pending</span>}
          {filledCount === 0 && "Fill rows above to save"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={addRow}
            tabIndex={-1}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleSaveAll}
            disabled={saving || filledCount === 0}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save All
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InlineSpreadsheetGrid;
