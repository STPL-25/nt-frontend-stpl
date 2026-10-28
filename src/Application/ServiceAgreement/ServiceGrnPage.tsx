import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, FileCheck2, Loader2, PackageCheck, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { FormSection, PageHeader } from '@/CustomComponent/PageComponents';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import useFetch from '@/hooks/useFetchHook';
import axios from 'axios';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getErrorMessage } from '@/lib/errors';
import { getPendingServiceGrnPOs, getServiceGrns, createServiceGrn, approveServiceGrn } from '@/Services/Api';
import { socket, SOCKET_JOIN_SERVICE_GRN, SOCKET_LEAVE_SERVICE_GRN, SOCKET_SERVICE_GRN_UPDATED } from '@/Services/Socket';

// Service GRN, filed by the department the Service PO belongs to (Fixed and Unfixed alike).
//   1. a generated Service PO shows under "Waiting for GRN"
//   2. the department files the GRN (service received) -> it goes to that department's ServiceGRN approval workflow
//   3. once approved, the supplier's invoice for that PO is released to the Payment screen as a payable bill
// The GRN carries no invoice and no stock: the supplier invoice is uploaded on the Service PO screen as before.

interface PendingPoRow {
  po_basic_sno: number; po_no: string; po_date?: string; dept_sno?: number; dept_name?: string;
  agreement_no: string; service_name: string; service_type_code: string;
  vendor_name?: string; net_cost?: number; invoice_count: number;
}

interface GrnRow {
  grn_sno: number; grn_no: string; po_no: string; dept_sno?: number; dept_name?: string;
  agreement_no: string; service_name: string; service_type_code: string; vendor_name?: string; net_cost?: number;
  received_date: string; remarks?: string; status: 'Pending Approval' | 'Approved' | 'Rejected';
  current_approver_id?: string | null; entered_by: string; approved_by?: string | null; approved_at?: string | null;
  can_act: boolean; last_comment?: string | null; last_comment_by?: string | null;
  invoice_count: number; payable_count: number;
}

const dateOnly = (v?: string | null) => (v ? v.slice(0, 10) : '');
const money = (v?: number) => (v != null ? Number(v).toLocaleString('en-IN') : '—');
const typeLabel = (code: string) => (code === 'FIXED_RECURRING' ? 'Fixed' : 'Unfixed');

const STATUS_CLASS: Record<GrnRow['status'], string> = {
  'Pending Approval': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

const Pill: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>{children}</span>
);

// What happens to the supplier's invoice, in words a department user understands.
const paymentState = (g: GrnRow) => {
  if (g.status === 'Rejected') return 'Re-file the GRN';
  if (g.status === 'Pending Approval') return 'Held until GRN is approved';
  if (g.payable_count > 0) return `${g.payable_count} bill${g.payable_count > 1 ? 's' : ''} on Payment`;
  return g.invoice_count > 0 ? 'Invoice releasing…' : 'Awaiting supplier invoice';
};

const FileGrnDialog: React.FC<{ po: PendingPoRow; onClose: () => void; onSaved: () => void }> = ({ po, onClose, onSaved }) => {
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!receivedDate) { setError('Received date is required'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(createServiceGrn, {
        po_basic_sno: po.po_basic_sno, received_date: receivedDate, remarks: remarks.trim() || undefined,
      });
      toast.success(`GRN filed for ${po.po_no} — sent for approval`);
      onSaved();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to file GRN'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>File GRN — {po.po_no}</DialogTitle>
          <DialogDescription>
            {po.service_name} · {typeLabel(po.service_type_code)} · {po.dept_name ?? '—'} · {po.vendor_name ?? '—'}
          </DialogDescription>
        </DialogHeader>

        <FormSection icon={FileCheck2} title="Service received">
          <div className="max-w-xs">
            <CustomInputField
              field="received_date" label="Received Date" require type="date"
              value={receivedDate} onChange={setReceivedDate} className="h-10"
            />
          </div>
          <CustomInputField
            field="remarks" label="Remarks" type="textarea"
            value={remarks} onChange={setRemarks} rows={2} className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            This goes to {po.dept_name ?? 'the department'}&apos;s Service GRN approver. The supplier&apos;s invoice reaches Payment only after it is approved.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 size={15} className="animate-spin mr-1" /> Saving…</> : 'File GRN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DecisionDialog: React.FC<{ grn: GrnRow; action: 'approve' | 'reject'; onClose: () => void; onDone: () => void }> = ({ grn, action, onClose, onDone }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reject = action === 'reject';

  const handleSubmit = async () => {
    if (reject && !comments.trim()) { setError('Give a reason for rejecting'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post(approveServiceGrn, { grn_sno: grn.grn_sno, action, comments: comments.trim() || undefined });
      const result = res.data?.data?.result;
      toast.success(
        result === 'REJECTED' ? `${grn.grn_no} rejected`
          : result === 'FINAL' ? `${grn.grn_no} approved — the supplier invoice can now go to Payment`
            : `${grn.grn_no} approved — sent to the next approver`
      );
      onDone();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Could not save the decision'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{reject ? 'Reject' : 'Approve'} {grn.grn_no}</DialogTitle>
          <DialogDescription>{grn.po_no} · {grn.service_name} · {grn.dept_name ?? '—'} · {money(grn.net_cost)}</DialogDescription>
        </DialogHeader>
        <CustomInputField
          field="comments" label={reject ? 'Reason' : 'Comments (optional)'} require={reject} type="textarea"
          value={comments} onChange={setComments} rows={3} className="resize-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant={reject ? 'destructive' : 'default'} onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 size={15} className="animate-spin mr-1" /> Saving…</> : reject ? 'Reject' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LoadingRow: React.FC<{ cols: number }> = ({ cols }) => (
  <TableRow><TableCell colSpan={cols} className="text-center py-8 text-muted-foreground">
    <Loader2 size={16} className="inline animate-spin mr-2" />Loading…
  </TableCell></TableRow>
);
const EmptyRow: React.FC<{ cols: number; text: string }> = ({ cols, text }) => (
  <TableRow><TableCell colSpan={cols} className="text-center py-8 text-muted-foreground">{text}</TableCell></TableRow>
);

const ServiceGrnPage: React.FC = () => {
  const { canEdit } = usePermissions();
  const canFile = canEdit('ServiceGrnPage');

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  const [filingPo, setFilingPo] = useState<PendingPoRow | null>(null);
  const [deciding, setDeciding] = useState<{ grn: GrnRow; action: 'approve' | 'reject' } | null>(null);
  const [dept, setDept] = useState('');

  const { data: pendingRes, loading: loadingPending } = useFetch<{ success: boolean; data: PendingPoRow[] }>(
    getPendingServiceGrnPOs, '', null, refreshKey
  );
  const { data: grnRes, loading: loadingGrns } = useFetch<{ success: boolean; data: GrnRow[] }>(
    getServiceGrns, '', null, refreshKey
  );

  // live: someone filed / approved a GRN
  useEffect(() => {
    socket.emit(SOCKET_JOIN_SERVICE_GRN);
    const onUpdated = () => setRefreshKey((k) => k + 1);
    socket.on(SOCKET_SERVICE_GRN_UPDATED, onUpdated);
    return () => {
      socket.emit(SOCKET_LEAVE_SERVICE_GRN);
      socket.off(SOCKET_SERVICE_GRN_UPDATED, onUpdated);
    };
  }, []);

  const pendingAll = pendingRes?.data ?? [];
  const grnsAll = grnRes?.data ?? [];

  const departments = useMemo(() => {
    const names = new Set<string>();
    [...pendingAll, ...grnsAll].forEach((r) => { if (r.dept_name) names.add(r.dept_name); });
    return [...names].sort();
  }, [pendingAll, grnsAll]);

  const inDept = <T extends { dept_name?: string }>(r: T) => !dept || r.dept_name === dept;
  const pending = pendingAll.filter(inDept);
  const grns = grnsAll.filter(inDept);
  const mine = grns.filter((g) => g.can_act);

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={PackageCheck}
        title="Service GRN"
        description="Each department confirms its Service POs were received; after approval the supplier invoice goes to Payment"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Department
            <select
              value={dept} onChange={(e) => setDept(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            >
              <option value="">All my departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        </div>

        {mine.length > 0 && (
          <Card className="shadow-md border-amber-300 dark:border-amber-700">
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Waiting for your approval ({mine.length})
              </h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GRN</TableHead><TableHead>Department</TableHead><TableHead>PO</TableHead>
                      <TableHead>Service</TableHead><TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead>Received</TableHead>
                      <TableHead>Filed by</TableHead><TableHead className="w-48" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mine.map((g) => (
                      <TableRow key={g.grn_sno}>
                        <TableCell className="font-medium">{g.grn_no}</TableCell>
                        <TableCell>{g.dept_name ?? '—'}</TableCell>
                        <TableCell>{g.po_no}</TableCell>
                        <TableCell>{g.service_name} <span className="text-xs text-muted-foreground">({typeLabel(g.service_type_code)})</span></TableCell>
                        <TableCell>{g.vendor_name ?? '—'}</TableCell>
                        <TableCell className="text-right">{money(g.net_cost)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{dateOnly(g.received_date)}</TableCell>
                        <TableCell className="text-xs">{g.entered_by}</TableCell>
                        <TableCell className="space-x-2 whitespace-nowrap">
                          <Button size="sm" onClick={() => setDeciding({ grn: g, action: 'approve' })}>
                            <CheckCircle2 size={14} className="mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeciding({ grn: g, action: 'reject' })}>
                            <XCircle size={14} className="mr-1" /> Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileCheck2 className="h-4 w-4" /> Waiting for GRN ({pending.length})
            </h3>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO No</TableHead><TableHead>Department</TableHead><TableHead>Agreement</TableHead>
                    <TableHead>Service</TableHead><TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Amount</TableHead><TableHead>Supplier invoice</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPending ? <LoadingRow cols={8} />
                    : pending.length === 0 ? <EmptyRow cols={8} text="No Service POs waiting on a GRN" />
                      : pending.map((po) => (
                        <TableRow key={po.po_basic_sno}>
                          <TableCell className="font-medium">{po.po_no}</TableCell>
                          <TableCell>{po.dept_name ?? '—'}</TableCell>
                          <TableCell>{po.agreement_no} <span className="text-xs text-muted-foreground">({typeLabel(po.service_type_code)})</span></TableCell>
                          <TableCell>{po.service_name}</TableCell>
                          <TableCell>{po.vendor_name ?? '—'}</TableCell>
                          <TableCell className="text-right">{money(po.net_cost)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{po.invoice_count > 0 ? 'Uploaded — held for GRN' : 'Not uploaded'}</TableCell>
                          <TableCell>
                            {canFile && <Button size="sm" variant="outline" onClick={() => setFilingPo(po)}>File GRN</Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <PackageCheck className="h-4 w-4" /> GRNs ({grns.length})
            </h3>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRN No</TableHead><TableHead>Department</TableHead><TableHead>PO No</TableHead>
                    <TableHead>Service</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead>
                    <TableHead>Approver</TableHead><TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingGrns ? <LoadingRow cols={8} />
                    : grns.length === 0 ? <EmptyRow cols={8} text="No GRNs filed yet" />
                      : grns.map((g) => (
                        <TableRow key={g.grn_sno}>
                          <TableCell className="font-medium">{g.grn_no}</TableCell>
                          <TableCell>{g.dept_name ?? '—'}</TableCell>
                          <TableCell>{g.po_no}</TableCell>
                          <TableCell>{g.service_name} <span className="text-xs text-muted-foreground">({typeLabel(g.service_type_code)})</span></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{dateOnly(g.received_date)}</TableCell>
                          <TableCell>
                            <Pill className={STATUS_CLASS[g.status]}>{g.status}</Pill>
                            {g.status === 'Rejected' && g.last_comment && (
                              <div className="text-xs text-muted-foreground mt-1 max-w-[16rem] whitespace-normal">“{g.last_comment}”</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {g.status === 'Pending Approval' ? g.current_approver_id
                              : g.status === 'Approved' ? `${g.approved_by} · ${dateOnly(g.approved_at)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{paymentState(g)}</TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {filingPo && (
        <FileGrnDialog po={filingPo} onClose={() => setFilingPo(null)} onSaved={() => { setFilingPo(null); refresh(); }} />
      )}
      {deciding && (
        <DecisionDialog grn={deciding.grn} action={deciding.action} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); refresh(); }} />
      )}
    </div>
  );
};

export default ServiceGrnPage;
