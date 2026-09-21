import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/CustomComponent/PageComponents";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Gauge, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useApprovalFlowHierarchy } from "@/FieldDatas/ApprovalWorkFlow";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";
import useFetch from "@/hooks/useFetchHook";
import usePost from "@/hooks/usePostHook";
import useUpdate from "@/hooks/useUpdateHook";
import useDelete from "@/hooks/useDeleteHook";
import {
  apiGetProductStockLevels,
  apiCreateProductStockLevel,
  apiUpdateProductStockLevel,
  apiDeleteProductStockLevel,
} from "@/Services/Api";

type ScopeType = "ORG" | "LOCATION";

interface StockLevelRow {
  stock_level_sno: number;
  prod_sno: number; prod_name: string; prod_code: string;
  scope_type: ScopeType;
  com_sno: number | null; com_name: string | null;
  div_sno: number | null; div_name: string | null;
  brn_sno: number | null; brn_name: string | null;
  location_sno: number | null; location_name: string | null; location_code: string | null;
  scope_label: string;
  min_qty: number; max_qty: number; reorder_level: number;
  is_active: "Y" | "N";
}

interface FormState {
  stock_level_sno?: number;
  prod_sno: string;
  scope_type: ScopeType;
  com_sno: string;
  div_sno: string;
  brn_sno: string;
  location_sno: string;
  min_qty: string;
  max_qty: string;
  reorder_level: string;
  is_active: boolean;
}

const emptyForm = (): FormState => ({
  prod_sno: "", scope_type: "ORG", com_sno: "", div_sno: "", brn_sno: "", location_sno: "",
  min_qty: "", max_qty: "", reorder_level: "", is_active: true,
});

const ProductStockLevelMaster: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: listResponse, loading: listLoading } = useFetch<{ success: boolean; data: StockLevelRow[] }>(
    apiGetProductStockLevels, "", null, refreshKey
  );
  const rows = listResponse?.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pendingDelete, setPendingDelete] = useState<StockLevelRow | null>(null);

  const { postData, loading: creating } = usePost();
  const { updateData, loading: updating } = useUpdate();
  const { deleteData, loading: deleting } = useDelete();
  const saving = creating || updating;

  const { options: masterOptions } = useMasterOptions(["ProductMaster", "WarehouseLocationMaster"]);
  const { companyOptions, divisionOptions, branchOptions } = useApprovalFlowHierarchy(
    form.com_sno ? [Number(form.com_sno)] : [],
    form.div_sno ? [Number(form.div_sno)] : [],
    form.brn_sno ? [Number(form.brn_sno)] : []
  );

  const productOptions = useMemo(
    () => (masterOptions?.ProductMaster ?? []).map((p: any) => ({
      value: p.value,
      label: p.prod_code ? `${p.label} (${p.prod_code})` : p.label,
    })),
    [masterOptions?.ProductMaster]
  );

  const locationOptions = useMemo(
    () => (masterOptions?.WarehouseLocationMaster ?? []).map((l: any) => ({
      value: l.value,
      label: l.location_code ? `${l.label} (${l.location_code})` : l.label,
    })),
    [masterOptions?.WarehouseLocationMaster]
  );

  const isEdit = form.stock_level_sno != null;

  const openCreate = () => { setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (row: StockLevelRow) => {
    setForm({
      stock_level_sno: row.stock_level_sno,
      prod_sno: String(row.prod_sno),
      scope_type: row.scope_type,
      com_sno: row.com_sno != null ? String(row.com_sno) : "",
      div_sno: row.div_sno != null ? String(row.div_sno) : "",
      brn_sno: row.brn_sno != null ? String(row.brn_sno) : "",
      location_sno: row.location_sno != null ? String(row.location_sno) : "",
      min_qty: String(row.min_qty),
      max_qty: String(row.max_qty),
      reorder_level: String(row.reorder_level),
      is_active: row.is_active === "Y",
    });
    setDialogOpen(true);
  };

  const handleScopeChange = (field: "com_sno" | "div_sno" | "brn_sno", value: string) => {
    setForm((f) => {
      if (field === "com_sno") return { ...f, com_sno: value, div_sno: "", brn_sno: "" };
      if (field === "div_sno") return { ...f, div_sno: value, brn_sno: "" };
      return { ...f, brn_sno: value };
    });
  };

  const handleSave = async () => {
    if (!form.prod_sno) {
      toast.error("Please select a product.");
      return;
    }
    if (form.scope_type === "ORG" && !form.com_sno) {
      toast.error("Please select a company for a Company/Division/Branch scoped entry.");
      return;
    }
    if (form.scope_type === "LOCATION" && !form.location_sno) {
      toast.error("Please select a warehouse location.");
      return;
    }
    const minQty = Number(form.min_qty);
    const maxQty = Number(form.max_qty);
    const reorderLevel = Number(form.reorder_level);
    if (form.min_qty === "" || form.max_qty === "" || form.reorder_level === "") {
      toast.error("Min Qty, Max Qty and Reorder Level are all required.");
      return;
    }
    if (minQty < 0 || maxQty < 0 || reorderLevel < 0) {
      toast.error("Quantities cannot be negative.");
      return;
    }
    if (minQty > maxQty) {
      toast.error("Min Qty cannot be greater than Max Qty.");
      return;
    }
    if (reorderLevel < minQty || reorderLevel > maxQty) {
      toast.error("Reorder Level must be between Min Qty and Max Qty.");
      return;
    }

    const payload = {
      prod_sno: Number(form.prod_sno),
      scope_type: form.scope_type,
      com_sno: form.scope_type === "ORG" ? Number(form.com_sno) : null,
      div_sno: form.scope_type === "ORG" && form.div_sno ? Number(form.div_sno) : null,
      brn_sno: form.scope_type === "ORG" && form.brn_sno ? Number(form.brn_sno) : null,
      location_sno: form.scope_type === "LOCATION" ? Number(form.location_sno) : null,
      min_qty: minQty,
      max_qty: maxQty,
      reorder_level: reorderLevel,
      is_active: form.is_active ? "Y" : "N",
    };

    try {
      if (isEdit) {
        await updateData(apiUpdateProductStockLevel, null, { stock_level_sno: form.stock_level_sno, ...payload });
        toast.success("Stock level configuration updated");
      } else {
        await postData(apiCreateProductStockLevel, payload);
        toast.success("Stock level configuration saved");
      }
      setDialogOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save stock level configuration");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteData(apiDeleteProductStockLevel, { stock_level_sno: pendingDelete.stock_level_sno });
      toast.success("Stock level configuration deleted");
      setPendingDelete(null);
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error("Failed to delete stock level configuration");
    }
  };

  return (
    <div className="flex flex-col min-h-full lg:h-full bg-muted/30">
      <PageHeader
        icon={Gauge}
        title="Product Stock Level Master"
        description="Set Min Qty / Max Qty / Reorder Level per product, scoped by Company / Division / Branch or by a Warehouse Location. Optional per product — leave rare/untracked products unconfigured."
      />

      <div className="flex-1 lg:overflow-y-auto p-5 space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90">
            <Plus size={16} className="mr-1" /> Add Stock Level
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Min Qty</TableHead>
                  <TableHead className="text-right">Max Qty</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="animate-spin inline mr-2" size={16} /> Loading…
                  </TableCell></TableRow>
                )}
                {!listLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No stock level configurations yet — every product is currently untracked.
                  </TableCell></TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.stock_level_sno}>
                    <TableCell className="align-top">
                      <p className="font-medium">{row.prod_name}</p>
                      <p className="text-xs text-muted-foreground">{row.prod_code}</p>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      <Badge variant="secondary" className="mr-1.5 text-[10px]">
                        {row.scope_type === "LOCATION" ? "Location" : "Org"}
                      </Badge>
                      {row.scope_label}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">{row.min_qty}</TableCell>
                    <TableCell className="text-right align-top tabular-nums">{row.max_qty}</TableCell>
                    <TableCell className="text-right align-top tabular-nums">{row.reorder_level}</TableCell>
                    <TableCell className="text-right align-top">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setPendingDelete(row)}>
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Stock Level" : "Add Stock Level"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <CustomInputField
              field="prod_sno" label="Product" type="select" require
              options={productOptions} disabled={isEdit}
              placeholder="Select product"
              value={form.prod_sno} onChange={(v) => setForm((f) => ({ ...f, prod_sno: v }))}
            />

            <CustomInputField
              field="scope_type" label="Scope Type" type="select" require
              options={[
                { value: "ORG", label: "Company / Division / Branch" },
                { value: "LOCATION", label: "Warehouse Location" },
              ]}
              disabled={isEdit}
              value={form.scope_type}
              onChange={(v) => setForm((f) => ({ ...f, scope_type: v as ScopeType, com_sno: "", div_sno: "", brn_sno: "", location_sno: "" }))}
            />

            {form.scope_type === "ORG" ? (
              <div className="grid grid-cols-3 gap-3">
                <CustomInputField
                  field="com_sno" label="Company" type="select" require
                  options={companyOptions} disabled={isEdit}
                  placeholder="Select company"
                  value={form.com_sno} onChange={(v) => handleScopeChange("com_sno", v)}
                />
                <CustomInputField
                  field="div_sno" label="Division (optional)" type="select"
                  options={divisionOptions} disabled={isEdit || !form.com_sno}
                  placeholder="All divisions"
                  value={form.div_sno} onChange={(v) => handleScopeChange("div_sno", v)}
                />
                <CustomInputField
                  field="brn_sno" label="Branch (optional)" type="select"
                  options={branchOptions} disabled={isEdit || !form.div_sno}
                  placeholder="All branches"
                  value={form.brn_sno} onChange={(v) => handleScopeChange("brn_sno", v)}
                />
              </div>
            ) : (
              <CustomInputField
                field="location_sno" label="Warehouse Location" type="select" require
                options={locationOptions} disabled={isEdit}
                placeholder="Select warehouse location"
                value={form.location_sno} onChange={(v) => setForm((f) => ({ ...f, location_sno: v }))}
              />
            )}

            {isEdit && (
              <p className="text-xs text-muted-foreground -mt-2">
                Product and scope can't be changed after creation — add a new entry instead.
              </p>
            )}
            {form.scope_type === "ORG" && !isEdit && (
              <p className="text-xs text-muted-foreground -mt-2">
                Leaving Division/Branch blank applies this to every division/branch under the
                selected level — a more specific entry for the same product always wins.
              </p>
            )}

            <div className="grid grid-cols-3 gap-3">
              <CustomInputField
                field="min_qty" label="Min Qty" type="number" require
                value={form.min_qty} onChange={(v) => setForm((f) => ({ ...f, min_qty: v }))}
              />
              <CustomInputField
                field="max_qty" label="Max Qty" type="number" require
                value={form.max_qty} onChange={(v) => setForm((f) => ({ ...f, max_qty: v }))}
              />
              <CustomInputField
                field="reorder_level" label="Reorder Level" type="number" require
                value={form.reorder_level} onChange={(v) => setForm((f) => ({ ...f, reorder_level: v }))}
              />
            </div>

            {isEdit && (
              <CustomInputField
                field="is_active" label="Active" type="switch"
                value={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 size={14} className="animate-spin mr-1" />}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Stock Level Configuration?</DialogTitle>
            <DialogDescription>
              The configuration for "{pendingDelete?.prod_name}" ({pendingDelete?.scope_label}) will be
              removed. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className="animate-spin mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductStockLevelMaster;
