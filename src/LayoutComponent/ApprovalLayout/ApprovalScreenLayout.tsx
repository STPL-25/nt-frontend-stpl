import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2, XCircle, Clock,
  FileText, AlertCircle, ChevronRight, Package,
  GitBranch, Layers, History,
} from 'lucide-react';
import type { FieldType } from '@/FieldDatas/fieldType/fieldType';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from '@/globalState/hooks/usePermissions';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';

// ─── SP response mapping ──────────────────────────────────────────────────────
// pr_basic_sno | brn_sno | brn_name | brn_prefix | dept_name | div_prefix
// div_name | com_name | created_by_name | dept_sno | reg_date | required_date
// priority_sno | purpose | is_active | created_by | created_date | modified_by
// modified_date | pr_no | workflow_types_id | current_approver_id | status
// pr_item_details (JSON) | stage_order_json (JSON)
//
// Item JSON: pr_item_sno, pr_basic_sno, prod_sno, qty, unit, uom_name, uom_code,
//            est_cost, total_cost, remarks, created_by, created_date, is_active, pr_no
//
// Stage JSON: approver_ecno, stage, required_approvals, is_mandatory, escalation_hours,
//             approver_condition, next_approver_ecno, can_forward, can_backward, can_edit_data

interface ApprovalScreenLayoutProps {
  approvalName: string;
  prList: any[];
  selectedPR: any;
  handlePRSelect: (pr: any) => void;
  handleAction: (action: string) => void;
  showApprovalDialog: boolean;
  setShowApprovalDialog: (show: boolean) => void;
  action: string;
  comments: string;
  setComments: (comments: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  actionType: 'approve' | 'reject';
  fieldDatas: FieldType[];
  toast?: { message: string; type: 'success' | 'error' } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string | number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };
const STATUS_MAP: Record<string, string> = {
  P: 'Pending', A: 'Approved', R: 'Rejected', D: 'Draft',
};

function getPriorityLabel(sno: any): string {
  return PRIORITY_MAP[sno] ?? (sno ? String(sno) : 'Normal');
}

function getStatusLabel(s: any): string {
  return STATUS_MAP[String(s).toUpperCase()] ?? String(s ?? 'Pending');
}

function formatDate(d: string) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function parsePrItems(pr: any): { parsedItems: any[]; totalCost: number } {
  let parsedItems: any[] = [];
  try {
    const raw = pr.pr_item_details ?? pr.items;
    if (typeof raw === 'string') parsedItems = JSON.parse(raw);
    else if (Array.isArray(raw)) parsedItems = raw;
  } catch { /* ignore */ }
  const totalCost = parsedItems.reduce((s, i) => s + (parseFloat(i.total_cost) || 0), 0);
  return { parsedItems, totalCost };
}

function parseStages(pr: any): any[] {
  try {
    const raw = pr.stage_order_json;
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return []; }
}

function parseHistory(pr: any): any[] {
  try {
    const raw = pr.pr_history_data;
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return []; }
}

function priorityCls(label: string) {
  if (label === 'High')   return 'bg-red-50 dark:bg-red-950/20 border-red-300 text-red-700 dark:text-red-400';
  if (label === 'Medium') return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 text-yellow-700 dark:text-yellow-400';
  return 'bg-green-50 dark:bg-green-950/20 border-green-300 text-green-700 dark:text-green-400';
}

function yesNo(val: string) {
  return String(val).toUpperCase() === 'Y';
}

// ─── PR List Card ─────────────────────────────────────────────────────────────

function PRListCard({ pr, isSelected, onClick }: { pr: any; isSelected: boolean; onClick: () => void }) {
  const { parsedItems, totalCost } = useMemo(() => parsePrItems(pr), [pr]);
  const priorityLabel = getPriorityLabel(pr.priority_sno);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-50 truncate">{pr.pr_no}</p>
            {pr.created_by_name && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{pr.created_by_name}</p>
            )}
          </div>
          <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-xs ${priorityCls(priorityLabel)}`}>
            {priorityLabel} Priority
          </Badge>
          {pr.status && (
            <Badge variant="outline" className="text-xs">
              {getStatusLabel(pr.status)}
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-xs">
          {pr.brn_name && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Branch</span>
              <span className="font-medium truncate text-right">{pr.brn_name}</span>
            </div>
          )}
          {pr.dept_name && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Dept</span>
              <span className="font-medium truncate text-right">{pr.dept_name}</span>
            </div>
          )}
          {pr.reg_date && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Created</span>
              <span className="font-medium">{formatDate(pr.reg_date)}</span>
            </div>
          )}
          {pr.required_date && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Required by</span>
              <span className="font-medium">{formatDate(pr.required_date)}</span>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 flex items-center gap-1">
              <Package className="h-3 w-3" />Items
            </span>
            <span className="font-medium">{parsedItems.length}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 font-medium">Total</span>
            <span className="font-bold text-green-600 dark:text-green-400">
              ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {pr.purpose && (
          <p className="text-xs text-slate-500 line-clamp-2 border-t border-slate-100 dark:border-slate-800 pt-2">
            {pr.purpose}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Approval history ─────────────────────────────────────────────────────────

function PRHistorySection({ history }: { history: any[] }) {
  if (!history.length) return null;
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <History className="h-4 w-4 sm:h-5 sm:w-5" />
          Approval History
          <Badge variant="secondary" className="ml-1 text-xs">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="space-y-2">
          {history.map((entry: any, idx: number) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
            >
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {entry.ename ?? '—'}
                  </p>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{entry.status_by}</span>
                </div>
                {entry.status_date && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(entry.status_date)}
                  </p>
                )}
                {entry.commends && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">"{entry.commends}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Approval stages ──────────────────────────────────────────────────────────

function ApprovalStages({ stages, currentApproverId }: { stages: any[]; currentApproverId?: string }) {
  if (!stages.length) return null;
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <GitBranch className="h-4 w-4 sm:h-5 sm:w-5" />
          Approval Workflow
          <Badge variant="secondary" className="ml-1 text-xs">{stages.length} stage{stages.length !== 1 ? 's' : ''}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="space-y-2">
          {stages.map((stage: any, idx: number) => {
            const isCurrent = stage.approver_ecno === currentApproverId;
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  isCurrent
                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {stage.stage ?? `Stage ${idx + 1}`}
                    </p>
                    {isCurrent && (
                      <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Approver: <span className="font-medium text-slate-700 dark:text-slate-300">{stage.approver_ecno}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {stage.is_mandatory && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        yesNo(stage.is_mandatory)
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {yesNo(stage.is_mandatory) ? 'Mandatory' : 'Optional'}
                      </span>
                    )}
                    {stage.escalation_hours && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Escalate after {stage.escalation_hours}h
                      </span>
                    )}
                    {stage.approver_condition && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        {stage.approver_condition}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {yesNo(stage.can_forward) && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                        Can Forward
                      </span>
                    )}
                    {yesNo(stage.can_backward) && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                        Can Return
                      </span>
                    )}
                    {yesNo(stage.can_edit_data) && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        Can Edit
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function PRDetailPanel({ pr, handleAction, fieldDatas }: { pr: any; handleAction: (a: string) => void; fieldDatas: FieldType[] }) {
  const { canEdit } = usePermissions();
  const { parsedItems, totalCost } = useMemo(() => parsePrItems(pr), [pr]);
  const stages = useMemo(() => parseStages(pr), [pr]);
  const history = useMemo(() => parseHistory(pr), [pr]);
  const priorityLabel = getPriorityLabel(pr.priority_sno);
  const statusLabel = getStatusLabel(pr.status);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
          Purchase Requisition
        </h1>
        <Badge variant="outline" className="text-xs sm:text-sm flex items-center gap-1">
          <Clock className="h-3 w-3" />{statusLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 sm:p-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg sm:text-xl">{pr.pr_no}</CardTitle>
                  <Badge variant="outline" className={`text-xs ${priorityCls(priorityLabel)}`}>
                    <AlertCircle className="mr-1 h-3 w-3" />{priorityLabel} Priority
                  </Badge>
                </div>
                {(pr.com_name || pr.div_name || pr.brn_name) && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                    <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                    {[pr.com_name, pr.div_name, pr.brn_name].filter(Boolean).join(' › ')}
                  </div>
                )}
                {pr.purpose && (
                  <CardDescription className="text-sm sm:text-base">{pr.purpose}</CardDescription>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fieldDatas.filter(f => f.view !== false).map(f => {
                  const rawVal = pr[f.field];
                  if (rawVal == null || rawVal === '') return null;
                  const displayVal = f.type === 'date' ? formatDate(String(rawVal)) : String(rawVal);
                  return (
                    <div key={f.field} className="flex items-start gap-2 sm:gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{f.label}</p>
                        <p className="text-sm sm:text-base font-semibold truncate">{displayVal}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                Requested Items
                <Badge variant="secondary" className="ml-1 text-xs">{parsedItems.length}</Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 pt-0">
              {parsedItems.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No items found</p>
              ) : (
                <>
                  <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="text-left p-2 lg:p-3">#</th>
                          <th className="text-left p-2 lg:p-3">Item (Prod #)</th>
                          <th className="text-right p-2 lg:p-3">Qty</th>
                          <th className="text-right p-2 lg:p-3">Est. Cost</th>
                          <th className="text-right p-2 lg:p-3">Total</th>
                          <th className="text-left p-2 lg:p-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {parsedItems.map((item: any, idx: number) => (
                          <tr key={item.pr_item_sno ?? idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="p-2 lg:p-3 text-slate-400 dark:text-slate-500 text-xs">{idx + 1}</td>
                            <td className="p-2 lg:p-3">
                              <p className="font-medium text-slate-900 dark:text-slate-50">{item.prod_name}</p>
                              <p className="text-xs text-slate-500">{item.pr_no}</p>
                            </td>
                            <td className="p-2 lg:p-3 text-right whitespace-nowrap">
                              <span className="font-medium">{parseFloat(item.qty || 0).toLocaleString('en-IN')}</span>
                              <span className="text-xs text-slate-500 ml-1">{item.uom_name}</span>
                            </td>
                            <td className="p-2 lg:p-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              ₹{parseFloat(item.est_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 lg:p-3 text-right font-semibold whitespace-nowrap">
                              ₹{parseFloat(item.total_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 lg:p-3 text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate">
                              {item.remarks || '—'}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 dark:bg-slate-900 font-semibold border-t-2 border-slate-300 dark:border-slate-700">
                          <td colSpan={4} className="p-2 lg:p-3 text-right text-sm text-slate-600 dark:text-slate-400">
                            Grand Total
                          </td>
                          <td className="p-2 lg:p-3 text-right text-green-600 dark:text-green-400 text-sm">
                            ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="sm:hidden space-y-3">
                    {parsedItems.map((item: any, idx: number) => (
                      <Card key={item.pr_item_sno ?? idx} className="border border-slate-200 dark:border-slate-800">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">Prod #{item.prod_sno}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{item.pr_no}</p>
                            </div>
                            <span className="text-xs text-slate-400">#{idx + 1}</span>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-slate-500">Quantity</p>
                              <p className="font-medium">{parseFloat(item.qty || 0).toLocaleString('en-IN')} {item.uom_name}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Est. Cost</p>
                              <p className="font-medium">₹{parseFloat(item.est_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                          {item.remarks && (
                            <p className="text-xs text-slate-500">Remarks: {item.remarks}</p>
                          )}
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-500">Item Total</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              ₹{parseFloat(item.total_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-semibold text-sm">Grand Total</span>
                      <span className="font-bold text-lg text-green-600 dark:text-green-400">
                        ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <ApprovalStages stages={stages} currentApproverId={pr.current_approver_id} />
          <PRHistorySection history={history} />
        </div>

        <div className="xl:col-span-1">
          <Card className="shadow-sm xl:sticky xl:top-6">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base sm:text-lg">Approval Actions</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Review and take action on this requisition
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4">
              {canEdit("PRApprovalScreen") ? (
                <>
                  <Button
                    onClick={() => handleAction('approve')}
                    className="w-full h-10 sm:h-11 text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    size="lg"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Approve Request
                  </Button>

                  <Button
                    onClick={() => handleAction('reject')}
                    variant="destructive"
                    className="w-full h-10 sm:h-11 text-sm"
                    size="lg"
                  >
                    <XCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Reject Request
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  View only — no approval permission
                </p>
              )}

              <Separator />

              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status</span>
                  <Badge variant="outline" className="text-xs">{statusLabel}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Priority</span>
                  <Badge variant="outline" className={`text-xs ${priorityCls(priorityLabel)}`}>
                    {priorityLabel}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Items</span>
                  <span className="font-semibold">{parsedItems.length}</span>
                </div>
                {pr.dept_name && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 shrink-0">Dept</span>
                    <span className="font-semibold truncate text-right">{pr.dept_name}</span>
                  </div>
                )}
                {pr.brn_name && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 shrink-0">Branch</span>
                    <span className="font-semibold truncate text-right">{pr.brn_name}</span>
                  </div>
                )}
                {pr.com_name && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 shrink-0">Company</span>
                    <span className="font-semibold truncate text-right">{pr.com_name}</span>
                  </div>
                )}
                {pr.current_approver_id && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 shrink-0">Approver</span>
                    <span className="font-semibold truncate text-right">{pr.current_approver_id}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 font-medium">Total Amount</span>
                  <span className="font-bold text-base sm:text-lg text-green-600 dark:text-green-400">
                    ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function PREmptyState({ count, onOpenList }: { count: number; onOpenList: () => void }) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-3">
        <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-slate-300 dark:text-slate-700 mx-auto" />
        <h3 className="text-lg sm:text-xl font-semibold text-slate-600 dark:text-slate-400">No PR Selected</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
          Select a purchase requisition from the list to view details and take action
        </p>
        <Button variant="outline" className="lg:hidden mt-2" onClick={onOpenList}>
          <FileText className="h-4 w-4 mr-2" />View PR List
        </Button>
      </div>
    </div>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function ApprovalScreenLayout({
  approvalName, prList, selectedPR, handlePRSelect, handleAction,
  showApprovalDialog, setShowApprovalDialog, comments, setComments,
  handleSubmit, loading, actionType, fieldDatas, toast,
}: ApprovalScreenLayoutProps) {
  const enrichedSelectedPR = useMemo(() => {
    if (!selectedPR) return null;
    const { parsedItems, totalCost } = parsePrItems(selectedPR);
    return { ...selectedPR, parsedItems, totalCost };
  }, [selectedPR]);

  return (
    <>
      <SidebarDetailLayout
        sidebarTitle={approvalName}
        sidebarCount={prList.length}
        toast={toast}
        listItems={(closeSheet) =>
          prList.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No pending requisitions</p>
          ) : (
            prList.map((pr: any) => (
              <PRListCard
                key={pr.pr_no}
                pr={pr}
                isSelected={selectedPR?.pr_no === pr.pr_no}
                onClick={() => { handlePRSelect(pr); closeSheet(); }}
              />
            ))
          )
        }
        hasSelection={!!enrichedSelectedPR}
        detailContent={
          enrichedSelectedPR
            ? <PRDetailPanel pr={enrichedSelectedPR} handleAction={handleAction} fieldDatas={fieldDatas} />
            : null
        }
        emptyContent={<PREmptyState count={prList.length} onOpenList={() => {}} />}
        mobileListLabel="PR List"
        mobileSelectionTitle={selectedPR?.pr_no}
      />

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {actionType === 'approve'
                ? <><CheckCircle2 className="h-5 w-5 text-green-600" /> Approve Requisition</>
                : <><XCircle className="h-5 w-5 text-red-600" /> Reject Requisition</>}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {actionType === 'approve'
                ? 'Optionally add a comment before approving.'
                : 'Please provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {actionType === 'approve' && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-100">Confirming Approval</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  This requisition will proceed to the next stage.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pr-comments" className="text-xs sm:text-sm">
                Comments {actionType === 'reject' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="pr-comments"
                placeholder={actionType === 'approve' ? 'Any additional notes…' : 'Reason for rejection…'}
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {enrichedSelectedPR && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">PR Number</span>
                  <span className="font-semibold">{enrichedSelectedPR.pr_no}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Requestor</span>
                  <span className="font-semibold truncate ml-2">{enrichedSelectedPR.created_by_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Total Amount</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    ₹{enrichedSelectedPR.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline" onClick={() => setShowApprovalDialog(false)}
              disabled={loading} className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || (actionType === 'reject' && !comments.trim())}
              className={`w-full sm:w-auto text-sm ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {loading ? (
                <><Clock className="mr-2 h-4 w-4 animate-spin" />Processing…</>
              ) : actionType === 'approve' ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm Approval</>
              ) : (
                <><XCircle className="mr-2 h-4 w-4" />Confirm Rejection</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
