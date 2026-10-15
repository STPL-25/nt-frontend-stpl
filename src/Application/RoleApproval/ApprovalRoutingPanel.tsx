import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { GitBranch, Loader2, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import {
  apiCreateApprovalVariantEntity, apiGetApprovalRoutes, apiSaveApprovalModule, apiSaveApprovalRoute, apiSaveApprovalVariant,
} from "@/Services/Api";
import { Input } from "@/components/ui/input";

interface EligibleEntity { entity_code: string; entity_name: string }
export interface ApprovalRouteRow {
  module_code: string;
  module_label: string;
  variants_called: string;
  can_add_variants: boolean;
  variant_code: string;
  variant_label: string;
  entity_code: string;
  entity_name: string | null;
  shared_with: number;
  workflows_configured: number;
  eligible_entities: EligibleEntity[];
}

interface PendingConfirm { row: ApprovalRouteRow; entityCode: string; scopesMissing: number }

interface Props {
  /** Start creating a workflow of this approval type (opens the create form with it pre-chosen). */
  onCreateWorkflow?: (entityCode: string) => void;
}

/**
 * Which approval type (entity_type) each kind of request takes its workflow from. Edited here instead of
 * in stored procedures: a new service type shows up as a row on its own, and giving Fixed its own
 * approvers is "create a dedicated approval type, point Fixed at it, create its workflow".
 */
export function ApprovalRoutingPanel({ onCreateWorkflow }: Props) {
  const [rows, setRows] = useState<ApprovalRouteRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  // "New request type" / "Add variant" dialog: kind = new module, or the module the variant is added to
  const [adding, setAdding] = useState<{ moduleCode: string | null; moduleLabel?: string } | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [variantNoun, setVariantNoun] = useState("");
  const [variantsInput, setVariantsInput] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(apiGetApprovalRoutes);
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Could not load approval routing"));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (row: ApprovalRouteRow, entityCode: string, force: boolean) => {
    const key = `${row.module_code}|${row.variant_code}`;
    setBusyKey(key);
    try {
      const res = await axios.post(apiSaveApprovalRoute, {
        module_code: row.module_code, variant_code: row.variant_code, entity_code: entityCode, force,
      });
      const out = res.data?.data;
      if (out?.status === "NEEDS_CONFIRM") {
        setConfirm({ row, entityCode, scopesMissing: Number(out.scopes_missing) || 0 });
        return;
      }
      setConfirm(null);
      if (out?.status === "SUCCESS") toast.success(`${row.variant_label} now uses ${entityCode}`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save routing"));
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  const splitOff = useCallback(async (row: ApprovalRouteRow) => {
    const key = `${row.module_code}|${row.variant_code}`;
    setBusyKey(key);
    try {
      const res = await axios.post(apiCreateApprovalVariantEntity, {
        module_code: row.module_code, variant_code: row.variant_code,
      });
      const code: string | undefined = res.data?.data?.entity_code;
      if (!code) throw new Error("No approval type returned");
      await load();
      setBusyKey(null);
      await save(row, code, false);
    } catch (err) {
      setBusyKey(null);
      toast.error(getErrorMessage(err, "Could not create the approval type"));
    }
  }, [load, save]);

  const openAdd = (moduleCode: string | null, moduleLabel?: string) => {
    setNameInput(""); setVariantNoun(""); setVariantsInput(""); setAdding({ moduleCode, moduleLabel });
  };

  const submitAdd = async () => {
    if (!adding || !nameInput.trim()) return;
    setAddBusy(true);
    try {
      if (adding.moduleCode) {
        await axios.post(apiSaveApprovalVariant, { module_code: adding.moduleCode, variant_label: nameInput });
        toast.success(`Added ${nameInput.trim()}`);
      } else {
        const variants = variantsInput.split(",").map((v) => v.trim()).filter(Boolean).map((variant_label) => ({ variant_label }));
        await axios.post(apiSaveApprovalModule, { module_label: nameInput, variant_label: variantNoun, variants });
        toast.success(`${nameInput.trim()} added — create its workflow on Approval Workflows`);
      }
      setAdding(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save"));
    } finally {
      setAddBusy(false);
    }
  };

  const modules = rows ? [...new Set(rows.map((r) => r.module_code))] : [];

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><GitBranch className="h-4 w-4" /></div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Approval routing</h2>
          <p className="text-xs text-muted-foreground">
            Pick which approval type each kind of request uses. Requests that share an approval type share its
            workflows; give one its own type to set approvers and amount conditions for it alone.
          </p>
        </div>
        <Button size="sm" onClick={() => openAdd(null)}><Plus className="h-3.5 w-3.5 mr-1" /> New request type</Button>
      </div>

      {rows === null && !loadError && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading routing…
        </div>
      )}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {modules.map((mod) => {
        const list = rows!.filter((r) => r.module_code === mod);
        return (
          <div key={mod} className="rounded-lg border bg-card">
            <div className="px-4 py-2.5 border-b flex items-center justify-between">
              <p className="text-sm font-medium">{list[0].module_label}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{list[0].variants_called}</p>
                {list[0].can_add_variants && (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openAdd(mod, list[0].module_label)}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                )}
              </div>
            </div>
            <div className="divide-y">
              {list.map((r) => {
                const key = `${r.module_code}|${r.variant_code}`;
                const busy = busyKey === key;
                return (
                  <div key={key} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="sm:w-40 shrink-0">
                      <p className="text-sm font-medium">{r.variant_label}</p>
                      {r.shared_with > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Same approval as {r.shared_with} other{r.shared_with > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Select value={r.entity_code} disabled={busy} onValueChange={(v) => save(r, v, false)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {r.eligible_entities.map((e) => (
                            <SelectItem key={e.entity_code} value={e.entity_code}>{e.entity_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end sm:w-56 shrink-0">
                      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {r.workflows_configured === 0 ? (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                          <TriangleAlert className="h-3 w-3" /> No workflow yet
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{r.workflows_configured} workflow{r.workflows_configured > 1 ? "s" : ""}</Badge>
                      )}
                      {r.shared_with > 0 ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => splitOff(r)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Own approval
                        </Button>
                      ) : (
                        r.workflows_configured === 0 && onCreateWorkflow && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCreateWorkflow(r.entity_code)}>
                            New workflow
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={!!adding} onOpenChange={(open) => { if (!open) setAdding(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adding?.moduleCode ? `Add to ${adding.moduleLabel}` : "New request type"}</DialogTitle>
            <DialogDescription>
              {adding?.moduleCode
                ? "A new variant starts on the request's shared approval type; give it its own approval afterwards if needed."
                : "e.g. Payment. Create it here, then build its workflow on Approval Workflows — no code changes needed on this side."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input autoFocus placeholder={adding?.moduleCode ? "Variant name" : "Request name"} value={nameInput}
              onChange={(e) => setNameInput(e.target.value)} />
            {!adding?.moduleCode && (
              <>
                <Input placeholder="What are the variants called? (e.g. Payment kind) — optional" value={variantNoun}
                  onChange={(e) => setVariantNoun(e.target.value)} />
                <Input placeholder="Variants, comma separated (e.g. Advance, Final) — optional" value={variantsInput}
                  onChange={(e) => setVariantsInput(e.target.value)} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
            <Button disabled={addBusy || !nameInput.trim()} onClick={submitAdd}>
              {addBusy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch approval type?</DialogTitle>
            <DialogDescription>
              {confirm && (
                <>
                  <b>{confirm.row.variant_label}</b> ({confirm.row.module_label}) will use <b>{confirm.entityCode}</b>.{" "}
                  {confirm.scopesMissing} company/branch/department scope{confirm.scopesMissing === 1 ? "" : "s"} that
                  have a workflow today have none for the new type, so raising this request there will fail until you
                  create the workflow (use <i>Entity Type = {confirm.entityCode}</i>).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button onClick={() => confirm && save(confirm.row, confirm.entityCode, true)}>Switch anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
