import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FileCheck2, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { FormSection, PageHeader } from '@/CustomComponent/PageComponents';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import useFetch from '@/hooks/useFetchHook';
import axios from 'axios';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getPendingServiceGrnPOs, getServiceGrns, createServiceGrn } from '@/Services/Api';

// Minimal Unfixed-agreement receipt record — PO reference + invoice number +
// invoice file + received date. Deliberately no stock/qty/FIFO tracking (see
// sql/81_service_agreement_dispatch_grn.sql header) — Fixed agreements never
// appear here, sp_nt_GetPendingServiceGrnPOs already filters to Unfixed only.

interface PendingPoRow {
  po_basic_sno: number; po_no: string; po_date?: string;
  agreement_sno: number; agreement_no: string;
  vendor_sno?: number; vendor_name?: string; service_name: string;
  qty?: number; unit_name?: string; agreed_unit_price?: number; net_cost?: number;
}

interface GrnRow {
  grn_sno: number; grn_no: string; po_basic_sno: number; po_no: string;
  agreement_no: string; service_name: string; vendor_name?: string;
  invoice_no: string; invoice_doc_url: string; received_date: string; remarks?: string;
  entered_by: string; created_at: string;
}

const dateOnly = (v?: string) => (v ? v.slice(0, 10) : '');

const FileGrnDialog: React.FC<{ po: PendingPoRow; onClose: () => void; onSaved: () => void }> = ({ po, onClose, onSaved }) => {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!invoiceNo.trim() || !receivedDate || !invoiceFile) {
      setError('Invoice number, received date and the invoice file are all required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('po_basic_sno', String(po.po_basic_sno));
      fd.append('invoice_no', invoiceNo.trim());
      fd.append('received_date', receivedDate);
      if (remarks.trim()) fd.append('remarks', remarks.trim());
      fd.append('invoice_document', invoiceFile);

      await axios.post(createServiceGrn, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`GRN filed for ${po.po_no}`);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to file GRN');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>File GRN — {po.po_no}</DialogTitle>
          <DialogDescription>{po.service_name} · Agreement {po.agreement_no} · {po.vendor_name ?? '—'}</DialogDescription>
        </DialogHeader>

        <FormSection icon={FileCheck2} title="Invoice Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
            <CustomInputField
              field="invoice_no" label="Invoice No" require type="text"
              value={invoiceNo} onChange={setInvoiceNo}
              placeholder="Supplier's invoice number" className="h-10"
            />
            <CustomInputField
              field="received_date" label="Received Date" require type="date"
              value={receivedDate} onChange={setReceivedDate} className="h-10"
            />
          </div>
          <div className="max-w-xs">
            <CustomInputField
              field="invoice_document" label="Invoice Document" require type="file"
              value={invoiceFile} onChange={setInvoiceFile}
            />
          </div>
          <CustomInputField
            field="remarks" label="Remarks" type="textarea"
            value={remarks} onChange={setRemarks} rows={2} className="resize-none"
          />
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

const ServiceGrnPage: React.FC = () => {
  const { canEdit } = usePermissions();
  const canFile = canEdit('ServiceGrnPage');

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  const [filingPo, setFilingPo] = useState<PendingPoRow | null>(null);

  const { data: pendingRes, loading: loadingPending } = useFetch<{ success: boolean; data: PendingPoRow[] }>(
    getPendingServiceGrnPOs, '', null, refreshKey
  );
  const { data: completedRes, loading: loadingCompleted } = useFetch<{ success: boolean; data: GrnRow[] }>(
    getServiceGrns, '', null, refreshKey
  );
  const pending = pendingRes?.data ?? [];
  const completed = completedRes?.data ?? [];

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={PackageCheck}
        title="Service GRN"
        description="Receipt records for Unfixed service agreement POs — invoice reference only, no stock tracking"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" /> Pending GRN ({pending.length})
              </h3>
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw size={14} className="mr-1" /> Refresh
              </Button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO No</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPending ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 size={16} className="inline animate-spin mr-2" />Loading…
                    </TableCell></TableRow>
                  ) : pending.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No POs waiting on a GRN</TableCell></TableRow>
                  ) : pending.map((po) => (
                    <TableRow key={po.po_basic_sno}>
                      <TableCell className="font-medium">{po.po_no}</TableCell>
                      <TableCell>{po.agreement_no}</TableCell>
                      <TableCell>{po.service_name}</TableCell>
                      <TableCell>{po.vendor_name ?? '—'}</TableCell>
                      <TableCell className="text-right">{po.net_cost != null ? Number(po.net_cost).toLocaleString('en-IN') : '—'}</TableCell>
                      <TableCell>
                        {canFile && (
                          <Button size="sm" variant="outline" onClick={() => setFilingPo(po)}>File GRN</Button>
                        )}
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
              <PackageCheck className="h-4 w-4" /> Completed ({completed.length})
            </h3>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRN No</TableHead>
                    <TableHead>PO No</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCompleted ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 size={16} className="inline animate-spin mr-2" />Loading…
                    </TableCell></TableRow>
                  ) : completed.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No GRNs filed yet</TableCell></TableRow>
                  ) : completed.map((g) => (
                    <TableRow key={g.grn_sno}>
                      <TableCell className="font-medium">{g.grn_no}</TableCell>
                      <TableCell>{g.po_no}</TableCell>
                      <TableCell>{g.agreement_no}</TableCell>
                      <TableCell>{g.invoice_no}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dateOnly(g.received_date)}</TableCell>
                      <TableCell>
                        <a href={g.invoice_doc_url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs">View</a>
                      </TableCell>
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
    </div>
  );
};

export default ServiceGrnPage;
