import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Download, Plus,
  ChevronLeft, ChevronRight, Edit2, Trash2,
  AlertTriangle, FileX, Upload, FileSpreadsheet, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { useAppState } from "@/globalState/hooks/useAppState";
import usePost from "@/hooks/usePostHook";
import useUpdate from "@/hooks/useUpdateHook";
import useDelete from "@/hooks/useDeleteHook";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { downloadExcelTemplate, parseExcelFile } from "@/utils/excelUtils";
import InlineSpreadsheetGrid from "@/LayoutComponent/InlineSpreadsheetGrid";

/* ── Types ────────────────────────────────────────────────── */
type RowData = Record<string, any>;

type Option = { label: string; value: string };

type HeaderDef = {
  field: string;
  label: string;
  input?: boolean;
  view?: boolean;
  type?: string;
  require?: boolean;
  options?: Option[];
};

type DynamicTableProps = {
  headers?: HeaderDef[];
  data?: RowData[];
  title?: string;
  searchable?: boolean;
  sortable?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
  exportEnabled?: boolean;
  settingsEnabled?: boolean;
  onAddNew?: (() => void) | null;
  master?: string;
  setCurrentScreen?: (screen: string) => void;
};

/* ── Component ────────────────────────────────────────────── */
const DynamicTable: React.FC<DynamicTableProps> = ({
  headers = [],
  data = [],
  title = "Records",
  searchable = true,
  sortable = true,
  striped = true,
  hoverable = true,
  className = "",
  exportEnabled = false,
  onAddNew = null,
  master = "",
  setCurrentScreen = () => {},
}) => {
  const { userData, setFormData } = useAppState();
  const API_BASE = import.meta.env.VITE_API_URL || "";
  console.log("master:", master);
  const { postData, loading: isAdding } = usePost();
  const { updateData, loading: isUpdating } = useUpdate();
  const { deleteData, loading: isDeleting } = useDelete();

  /* ── Table state ── */
  const [tableData, setTableData]   = useState<RowData[]>(data || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: "asc" | "desc" }>({ key: null, direction: "asc" });
  const [importing, setImporting]   = useState(false);
  const importInputRef              = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  /* ── Modal state ── */
  const [showAddModal,      setShowAddModal]      = useState(false);
  const [showEditModal,     setShowEditModal]      = useState(false);
  const [showDeleteModal,   setShowDeleteModal]    = useState(false);
  const [showSpreadsheet,   setShowSpreadsheet]    = useState(false);
  const [editingItem,  setEditingItem]  = useState<RowData | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RowData | null>(null);

  /* ── Form state (shared by add + edit modals) ── */
  const [formState, setFormState] = useState<RowData>({});

  useEffect(() => {
    setTableData(Array.isArray(data) ? data : []);
  }, [data]);

  useEffect(() => {
    if (showEditModal && editingItem) {
      setFormState({ ...editingItem });
      setFormData({ ...editingItem });
    }
    if (showAddModal) {
      setFormState({});
      setFormData({});
    }
  }, [showAddModal, showEditModal, editingItem]);

  const formHeaders = headers.filter((h) => h.input !== false);

  const handleFieldChange = (field: string, value: any) => {
    const next = { ...formState, [field]: value };
    setFormState(next);
    setFormData(next);
  };

  /* ── Sorting ── */
  const handleSort = (key: string) => {
    if (!sortable) return;
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  /* ── Processed data ── */
  const processedData = useMemo(() => {
    let filtered = [...tableData];
    if (searchable && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((v) =>
          v == null ? false : String(v).toLowerCase().includes(q)
        )
      );
    }
    if (sortConfig.key && sortable) {
      const k = sortConfig.key;
      filtered.sort((a, b) => {
        const av = a[k], bv = b[k];
        if (av == null && bv == null) return 0;
        if (av == null) return sortConfig.direction === "asc" ? 1 : -1;
        if (bv == null) return sortConfig.direction === "asc" ? -1 : 1;
        if (!isNaN(Number(av)) && !isNaN(Number(bv)))
          return sortConfig.direction === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
        return sortConfig.direction === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return filtered;
  }, [tableData, searchTerm, sortConfig, searchable, sortable]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(processedData.length / itemsPerPage));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1); }, [totalPages, currentPage]);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = processedData.slice(startIndex, startIndex + itemsPerPage);

  /* ── CRUD ── */
  const handleAddSave = async (fd: RowData) => {
    try {
      if (master) {
        // fd.created_by = userData[0]?.ecno || "";
        const resp = await postData(`${API_BASE}/api/common_master/${master}`,fd);
        if (resp?.data && Array.isArray(resp.data)) setTableData(resp.data);
        else if (resp?.data) setTableData((p) => [...p, resp.data]);
        toast.success(resp?.data?.[0]?.Message || resp?.message || "Item added");
      } else {
        setTableData((p) => [...p, { ...fd, id: Date.now() }]);
        toast.success("Item added");
      }
      setShowAddModal(false);
    } catch (error) {
      console.log(error)
      toast.error("Failed to add item");
    }
  };

  const handleEditSave = async (fd: RowData) => {
    if (!editingItem) return;
    try {
      if (master) {
        const resp = await updateData(`${API_BASE}/api/${master}`, null, { ...editingItem, ...fd });
        setTableData((prev) =>
          prev.map((it) => (it.id ?? it.Sno) === (editingItem.id ?? editingItem.Sno) ? { ...it, ...fd } : it)
        );
        toast.success(resp?.message || "Item updated");
      } else {
        setTableData((prev) =>
          prev.map((it) => (it.id ?? it.Sno) === (editingItem.id ?? editingItem.Sno) ? { ...it, ...fd } : it)
        );
        toast.success("Item updated");
      }
      setShowEditModal(false);
      setEditingItem(null);
    } catch { toast.error("Failed to update item"); }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      if (master) {
        const resp = await deleteData(`${API_BASE}/api/${master}`, itemToDelete);
        if (resp?.data && Array.isArray(resp.data)) {
          setTableData(resp.data);
        } else {
          setTableData((prev) =>
            prev.filter((it) => (it.id ?? it.Sno) !== (itemToDelete.id ?? itemToDelete.Sno))
          );
        }
        toast.success(resp?.message || "Item deleted");
      } else {
        setTableData((prev) =>
          prev.filter((it) => (it.id ?? it.Sno) !== (itemToDelete.id ?? itemToDelete.Sno))
        );
        toast.success("Item deleted");
      }
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch { toast.error("Failed to delete item"); }
  };

  /* ── CSV export ── */
  const handleExportCSV = () => {
    const csvHeaders = headers.map((h) => h.label);
    const rows = tableData.map((row) =>
      headers.map((h) => JSON.stringify(row[h.field] ?? ""))
    );
    const csv = [csvHeaders, ...rows].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${title.replace(/\s+/g, "_").toLowerCase()}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Excel template download ── */
  const handleDownloadTemplate = () => {
    const inputFields = formHeaders.map((h) => ({
      field: h.field,
      label: h.label,
      type: h.type,
      require: h.require,
      options: h.options,
    }));
    downloadExcelTemplate(inputFields, title);
    toast.success(`Template downloaded — fill it and import back`);
  };

  /* ── Excel import ── */
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be re-selected

    setImporting(true);
    try {
      const inputFields = formHeaders.map((h) => ({
        field: h.field,
        label: h.label,
        type: h.type,
        require: h.require,
        options: h.options,
      }));

      const { rows, errors } = await parseExcelFile(file, inputFields);

      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
      }

      if (rows.length === 0) {
        toast.error("No valid rows found in the Excel file.");
        return;
      }

      // Save each row via the same handler as manual Add
      let successCount = 0;
      for (const row of rows) {
        try {
          await handleAddSave({ ...row });
          successCount++;
        } catch {
          // individual failure already toasted inside handleAddSave
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} record${successCount > 1 ? "s" : ""} imported successfully`);
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  /* ── Pagination numbers ── */
  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  const viewHeaders = headers.filter((h) => h.view !== false);

  /* ── Render ── */
  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="border-b bg-card px-5 py-4">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 gap-1.5 text-muted-foreground hover:text-foreground -ml-1"
            onClick={() => setCurrentScreen("main")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Main
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {processedData.length} record{processedData.length !== 1 ? "s" : ""}
                {searchTerm ? ` matching "${searchTerm}"` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {searchable && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search records…"
                    className="pl-9 h-9 w-52 sm:w-60 text-sm"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              )}

              {/* Inline spreadsheet bulk entry */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30"
                onClick={() => setShowSpreadsheet(true)}
                title="Open inline spreadsheet for bulk entry"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk Entry</span>
              </Button>

              {/* Excel template download */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                onClick={handleDownloadTemplate}
                title="Download Excel template to fill and re-import"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Template</span>
              </Button>

              {/* Excel import */}
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportExcel}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                title="Import records from Excel"
              >
                {importing ? (
                  <Download className="h-4 w-4 animate-bounce" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{importing ? "Importing…" : "Import"}</span>
              </Button>

              {exportEnabled && (
                <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExportCSV}>
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              )}

              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => (onAddNew ? onAddNew() : setShowAddModal(true))}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add New</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Table or Empty State ── */}
        <div className="overflow-x-auto">
          {paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="rounded-full bg-muted/60 p-4 mb-4">
                <FileX className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No records found</h3>
              {searchTerm ? (
                <p className="text-sm text-muted-foreground mb-4">
                  No results for{" "}
                  <span className="font-medium text-foreground">"{searchTerm}"</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  There are no records yet. Add your first one.
                </p>
              )}
              <div className="flex gap-2">
                {searchTerm && (
                  <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                    Clear search
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowAddModal(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add New
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 text-center text-xs font-semibold text-muted-foreground">#</TableHead>
                  {viewHeaders.map((h) => (
                    <TableHead
                      key={h.field}
                      className={cn(
                        "text-xs font-semibold text-muted-foreground whitespace-nowrap",
                        sortable && "cursor-pointer select-none hover:text-foreground"
                      )}
                      onClick={() => sortable && handleSort(h.field)}
                    >
                      <div className="flex items-center gap-1">
                        {h.label}
                        {sortConfig.key === h.field && (
                          <span className="text-primary text-[10px]">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-xs font-semibold text-muted-foreground w-20 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, idx) => (
                  <TableRow
                    key={row.id ?? row.Sno ?? idx}
                    className={cn(
                      striped && idx % 2 !== 0 && "bg-muted/20",
                      hoverable && "hover:bg-muted/40 transition-colors"
                    )}
                  >
                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                      {startIndex + idx + 1}
                    </TableCell>
                    {viewHeaders.map((h) => (
                      <TableCell key={h.field} className="text-sm text-foreground py-2.5 whitespace-nowrap">
                        {row[h.field] ?? <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-right py-2.5">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => { setEditingItem(row); setShowEditModal(true); }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setItemToDelete(row); setShowDeleteModal(true); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && paginatedData.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t px-5 py-3.5">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">{startIndex + 1}</span>
              {" – "}
              <span className="font-medium text-foreground">
                {Math.min(startIndex + itemsPerPage, processedData.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{processedData.length}</span> results
            </p>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>

              {getPageNumbers().map((page, i) =>
                page === "..." ? (
                  <span key={`e-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={`p-${page}`}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setCurrentPage(Number(page))}
                  >
                    {page}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Inline Spreadsheet Grid ── */}
      {showSpreadsheet && (
        <InlineSpreadsheetGrid
          fields={formHeaders}
          master={master}
          apiBase={API_BASE}
          onClose={() => setShowSpreadsheet(false)}
          onSaved={() => {
            // Table refreshes automatically via the socket master:updated broadcast
          }}
        />
      )}

      {/* ── Add Modal ── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New — {title}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {formHeaders.map((h) => (
              <CustomInputField
                key={h.field}
                field={h.field}
                label={h.label}
                type={h.type || "text"}
                require={h.require || false}
                options={h.options || []}
                value={formState[h.field] || ""}
                onChange={(value) => handleFieldChange(h.field, value)}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAddSave(formState)} >
              {isAdding ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ── */}
      <Dialog
        open={showEditModal}
        onOpenChange={(open) => { setShowEditModal(open); if (!open) setEditingItem(null); }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit — {title}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {formHeaders.map((h) => (
              <CustomInputField
                key={h.field}
                field={h.field}
                label={h.label}
                type={h.type || "text"}
                require={h.require || false}
                options={h.options || []}
                value={formState[h.field] || ""}
                onChange={(value) => handleFieldChange(h.field, value)}
              />
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowEditModal(false); setEditingItem(null); }}
            >
              Cancel
            </Button>
            <Button onClick={() => handleEditSave(formState)} disabled={isUpdating}>
              {isUpdating ? "Updating…" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <Dialog
        open={showDeleteModal}
        onOpenChange={(open) => { setShowDeleteModal(open); if (!open) setItemToDelete(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2 leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">
              {String(itemToDelete?.name ?? itemToDelete?.title ?? itemToDelete?.id ?? "this item")}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DynamicTable;
