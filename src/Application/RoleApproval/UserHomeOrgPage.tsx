import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Check, Loader2, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/CustomComponent/PageComponents";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import useFetch from "@/hooks/useFetchHook";
import useUpdate from "@/hooks/useUpdateHook";
import { apiUserHomeOrg } from "@/Services/Api";

interface HomeOrgUser {
  ecno: string;
  ename: string | null;
  hr_dept: string | null;
  hr_branch: string | null;
  com_name: string | null;
  div_name: string | null;
  brn_name: string | null;
  dept_sno: number | null;
  dept_name: string | null;
  sug_dept_sno: number | null;
}

interface HomeOrgDept {
  dept_sno: number;
  dept_name: string;
  com_name: string;
  div_name: string;
  brn_name: string;
}

interface HomeOrgResponse {
  data?: HomeOrgUser[];
  departments?: HomeOrgDept[];
}

const deptLabel = (d: HomeOrgDept) => `${d.dept_name} · ${d.brn_name} · ${d.div_name} · ${d.com_name}`;

/**
 * Each user's FIXED home company / division / branch / department.
 *
 * Separate from Role Approval: that screen decides what a user may see and act on; this one records who the user is.
 * HR (ECNO API) only has free-text department / branch names that differ from this application's masters, so the HR
 * text is shown beside the mapping and a name-match suggestion is offered, but an admin confirms every mapping.
 */
export default function UserHomeOrgPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useFetch<HomeOrgResponse>(apiUserHomeOrg, "", null, refreshKey);
  const { updateData } = useUpdate();

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);

  const users = data?.data ?? [];
  const departments = data?.departments ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (unmappedOnly && u.dept_sno != null) return false;
      if (!q) return true;
      return [u.ecno, u.ename, u.hr_dept, u.hr_branch, u.dept_name, u.brn_name]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [users, search, unmappedOnly]);

  const unmappedCount = users.filter((u) => u.dept_sno == null).length;

  const save = async (u: HomeOrgUser) => {
    const deptSno = draft[u.ecno];
    if (!deptSno) return;
    setSaving(u.ecno);
    try {
      const res: any = await updateData(apiUserHomeOrg, null, { ecno: u.ecno, dept_sno: Number(deptSno) });
      toast.success(res?.message ?? "Home organisation saved.");
      setDraft((p) => {
        const { [u.ecno]: _gone, ...rest } = p;
        return rest;
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the home organisation."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-muted/30">
      <PageHeader
        icon={Building2}
        title="User Home Org"
        description="Fix each user's own company, division, branch and department. Role Approval only controls what they may access."
      />

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ECNO, name, department, branch"
              className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant={unmappedOnly ? "default" : "outline"}
            onClick={() => setUnmappedOnly((v) => !v)}
          >
            Not mapped yet ({unmappedCount})
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">HR department / branch</th>
                <th className="px-3 py-2">Home organisation</th>
                <th className="px-3 py-2 min-w-[18rem]">Set department</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No users to show.</td>
                </tr>
              )}
              {rows.map((u) => {
                const picked = draft[u.ecno] ?? "";
                const suggestion = u.sug_dept_sno != null && u.sug_dept_sno !== u.dept_sno
                  ? departments.find((d) => d.dept_sno === u.sug_dept_sno)
                  : undefined;
                return (
                  <tr key={u.ecno} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.ename ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.ecno}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{u.hr_dept || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.hr_branch || "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      {u.dept_sno == null ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">Not mapped</Badge>
                      ) : (
                        <>
                          <div className="font-medium">{u.dept_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.brn_name} · {u.div_name} · {u.com_name}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={picked}
                        onChange={(e) => setDraft((p) => ({ ...p, [u.ecno]: e.target.value }))}
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="">Select department…</option>
                        {departments.map((d) => (
                          <option key={d.dept_sno} value={d.dept_sno}>{deptLabel(d)}</option>
                        ))}
                      </select>
                      {suggestion && (
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() => setDraft((p) => ({ ...p, [u.ecno]: String(suggestion.dept_sno) }))}
                        >
                          <Sparkles className="h-3 w-3" /> Suggested: {deptLabel(suggestion)}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!picked || saving === u.ecno}
                        onClick={() => save(u)}
                        className={cn(!picked && "opacity-60")}
                      >
                        {saving === u.ecno ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        <span className="ml-1">Save</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Company, division and branch follow the chosen department. A user must log in again to pick up a change.
        </p>
      </div>
    </div>
  );
}
