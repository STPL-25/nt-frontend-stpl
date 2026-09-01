import React, { useEffect, useMemo, useState } from "react";
import { Route, PackageSearch, Search } from "lucide-react";
import { PageHeader, LoadingState, EmptyState } from "@/CustomComponent/PageComponents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/utils/statusUtils";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetchHook";
import { useMasterOptions } from "@/hooks/ReUsableHook/useMasterOptions";
import {
  prTrackingGetMine, prTrackingCanViewOrg, prTrackingGetOrg, prTrackingGetTimeline,
} from "@/Services/Api";
import {
  socket, SOCKET_JOIN_PR_TRACK, SOCKET_LEAVE_PR_TRACK, SOCKET_PR_TRACK_UPDATED,
} from "@/Services/Socket";
import PRTimelineStepper, { PRTrackingTimelineData } from "./PRTimelineStepper";

// Same shape as ServiceAgreementPage.tsx's CascadeOption — master rows carry
// com_sno/div_sno/brn_sno for client-side cascade filtering.
interface CascadeOption {
  value: string | number;
  label: string;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
}

interface PRTrackRow {
  pr_basic_sno: number;
  pr_no: string;
  pr_status: string;
  purpose: string | null;
  required_date: string | null;
  created_date: string | null;
  created_by_name?: string;
  current_approver_id?: string | null;
  current_approver_name?: string | null;
  com_name?: string;
  div_name?: string;
  brn_name?: string;
  dept_name?: string;
  current_stage: string;
}

function PRRow({ row, onOpen }: { row: PRTrackRow; onOpen: (pr_no: string) => void }) {
  const pendingWith = row.current_approver_name || row.current_approver_id;
  return (
    <button
      onClick={() => onOpen(row.pr_no)}
      className="w-full text-left flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">
          {row.pr_no}
          {row.created_by_name ? ` · ${row.created_by_name}` : ""}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {[row.com_name, row.div_name, row.brn_name, row.dept_name].filter(Boolean).join(" › ")}
          {row.purpose ? ` — ${row.purpose}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right space-y-1">
        <p className="text-xs font-medium">{row.current_stage}</p>
        {pendingWith && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">with {pendingWith}</p>
        )}
        <StatusBadge status={row.pr_status} />
      </div>
    </button>
  );
}

const PRTrackingPage: React.FC = () => {
  const [selectedPrNo, setSelectedPrNo] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  // ── My Requests ────────────────────────────────────────────────────────
  const { data: mineData, loading: mineLoading } = useFetch<{ success: boolean; data: PRTrackRow[] }>(
    prTrackingGetMine
  );
  const myRows = mineData?.data ?? [];

  // ── Team / Org View gate ──────────────────────────────────────────────
  const { data: canViewOrgData } = useFetch<{ success: boolean; data: { allowed: boolean } }>(
    prTrackingCanViewOrg
  );
  const canViewOrg = !!canViewOrgData?.data?.allowed;

  const { options } = useMasterOptions(["CompanyMaster", "DivisionMaster", "BranchMaster", "DeptMaster"]);
  const { CompanyMaster, DivisionMaster, BranchMaster, DeptMaster } = options || {};

  const [comSno, setComSno] = useState("");
  const [divSno, setDivSno] = useState("");
  const [brnSno, setBrnSno] = useState("");
  const [deptSno, setDeptSno] = useState("");
  const [orgSearchKey, setOrgSearchKey] = useState(0);

  const divisionOptions = useMemo(() => {
    if (!DivisionMaster) return [];
    if (!comSno) return DivisionMaster;
    return DivisionMaster.filter((d: CascadeOption) => String(d.com_sno) === String(comSno));
  }, [DivisionMaster, comSno]);

  const branchOptions = useMemo(() => {
    if (!BranchMaster) return [];
    return BranchMaster.filter((b: CascadeOption) => {
      const matchCompany = !comSno || String(b.com_sno) === String(comSno);
      const matchDivision = !divSno || String(b.div_sno) === String(divSno);
      return matchCompany && matchDivision;
    });
  }, [BranchMaster, comSno, divSno]);

  const deptOptions = useMemo(() => {
    if (!DeptMaster) return [];
    return DeptMaster.filter((d: CascadeOption) => {
      const matchCompany = !comSno || String(d.com_sno) === String(comSno);
      const matchDivision = !divSno || String(d.div_sno) === String(divSno);
      const matchBranch = !brnSno || String(d.brn_sno) === String(brnSno);
      return matchCompany && matchDivision && matchBranch;
    });
  }, [DeptMaster, comSno, divSno, brnSno]);

  const { data: orgData, loading: orgLoading } = useFetch<{ success: boolean; data: PRTrackRow[] }>(
    canViewOrg && comSno ? prTrackingGetOrg : null,
    "",
    { com_sno: comSno, div_sno: divSno || undefined, brn_sno: brnSno || undefined, dept_sno: deptSno || undefined },
    orgSearchKey
  );
  const orgRows = orgData?.data ?? [];

  // ── Timeline detail (sheet) ───────────────────────────────────────────
  const { data: timelineData, loading: timelineLoading } = useFetch<{
    success: boolean; data: PRTrackingTimelineData;
  }>(selectedPrNo ? prTrackingGetTimeline(selectedPrNo) : null, "", null, timelineRefreshKey);

  useEffect(() => {
    if (!selectedPrNo) return;
    socket.emit(SOCKET_JOIN_PR_TRACK, selectedPrNo);

    const onUpdate = (payload: { pr_no?: string; stage?: string; status?: string }) => {
      if (payload?.pr_no !== selectedPrNo) return;
      setTimelineRefreshKey((k) => k + 1);
      toast.info(`${selectedPrNo}: ${payload.stage ?? "updated"}${payload.status ? ` — ${payload.status}` : ""}`);
    };
    socket.on(SOCKET_PR_TRACK_UPDATED, onUpdate);

    return () => {
      socket.emit(SOCKET_LEAVE_PR_TRACK, selectedPrNo);
      socket.off(SOCKET_PR_TRACK_UPDATED, onUpdate);
    };
  }, [selectedPrNo]);

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={Route}
        title="PR Tracking"
        description="Real-time status of purchase requisitions — from submission through to received stock"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">My Requests</TabsTrigger>
            {canViewOrg && <TabsTrigger value="org">Team / Org View</TabsTrigger>}
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            <Card className="shadow-md">
              <CardContent className="pt-6">
                {mineLoading ? (
                  <LoadingState message="Loading your requests…" />
                ) : myRows.length === 0 ? (
                  <EmptyState icon={PackageSearch} message="No purchase requisitions yet" />
                ) : (
                  <div className="space-y-2">
                    {myRows.map((row) => (
                      <PRRow key={row.pr_basic_sno} row={row} onOpen={setSelectedPrNo} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canViewOrg && (
            <TabsContent value="org" className="mt-4 space-y-4">
              <Card className="shadow-md">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div>
                      <Label>Company</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={comSno}
                        onChange={(e) => { setComSno(e.target.value); setDivSno(""); setBrnSno(""); setDeptSno(""); }}
                      >
                        <option value="">Select company…</option>
                        {(CompanyMaster ?? []).map((c: CascadeOption) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Division</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={divSno}
                        onChange={(e) => { setDivSno(e.target.value); setBrnSno(""); setDeptSno(""); }}
                      >
                        <option value="">All divisions</option>
                        {divisionOptions.map((d: CascadeOption) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Branch</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={brnSno}
                        onChange={(e) => { setBrnSno(e.target.value); setDeptSno(""); }}
                      >
                        <option value="">All branches</option>
                        {branchOptions.map((b: CascadeOption) => (
                          <option key={b.value} value={b.value}>{b.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Department</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={deptSno}
                        onChange={(e) => setDeptSno(e.target.value)}
                      >
                        <option value="">All departments</option>
                        {deptOptions.map((d: CascadeOption) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      disabled={!comSno}
                      onClick={() => setOrgSearchKey((k) => k + 1)}
                      className="h-10"
                    >
                      <Search className="h-4 w-4 mr-2" /> Search
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardContent className="pt-6">
                  {!comSno ? (
                    <EmptyState icon={PackageSearch} message="Select a company to see pending & active PRs" />
                  ) : orgLoading ? (
                    <LoadingState message="Loading…" />
                  ) : orgRows.length === 0 ? (
                    <EmptyState icon={PackageSearch} message="No pending or active PRs in this scope" />
                  ) : (
                    <div className="space-y-2">
                      {orgRows.map((row) => (
                        <PRRow key={row.pr_basic_sno} row={row} onOpen={setSelectedPrNo} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Sheet open={!!selectedPrNo} onOpenChange={(open) => !open && setSelectedPrNo(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedPrNo}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {timelineLoading ? (
              <LoadingState message="Loading timeline…" />
            ) : timelineData?.data ? (
              <PRTimelineStepper data={timelineData.data} />
            ) : (
              <EmptyState icon={PackageSearch} message="No data" />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PRTrackingPage;
