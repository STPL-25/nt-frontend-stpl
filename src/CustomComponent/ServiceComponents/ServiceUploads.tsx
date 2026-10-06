import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Upload, ExternalLink, FileText, ReceiptText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { Callout } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { formatDate, formatINR } from '@/CustomComponent/ServiceComponents/serviceUtils';
import { getAuthFileUrl } from '@/Services/authUrl';
import { uploadSignedAgreement, uploadServicePoInvoice } from '@/Services/Api';
import { getErrorMessage } from '@/lib/errors';

// ── Shared bits ─────────────────────────────────────────────────────────────
const MAX_FILE_MB = 10;

export function FilePicker({ file, onChange, accept }: { file: File | null; onChange: (f: File | null) => void; accept?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-card p-3 text-sm hover:bg-muted/50">
      <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        {file ? <><b>{file.name}</b> <span className="text-muted-foreground">· {Math.max(1, Math.round(file.size / 1024))} KB</span></> : 'Choose a file (PDF or image, up to 10 MB)'}
      </span>
      <input
        type="file"
        className="sr-only"
        accept={accept ?? '.pdf,.png,.jpg,.jpeg'}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function validateFile(file: File | null): string | null {
  if (!file) return 'Please choose a file to upload';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `File is larger than ${MAX_FILE_MB} MB`;
  return null;
}

export const DocLink: React.FC<{ url?: string | null; label: string; className?: string }> = ({ url, label, className }) =>
  url ? (
    <a href={getAuthFileUrl(url)} target="_blank" rel="noopener noreferrer" className={className ?? 'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'}>
      <ExternalLink className="h-3 w-3" />{label}
    </a>
  ) : null;

// ── Signed agreement ────────────────────────────────────────────────────────
export const SignedAgreementDialog: React.FC<{
  agreement: { agreement_sno: number; agreement_no: string };
  onClose: () => void;
  onSaved: () => void;
}> = ({ agreement, onClose, onSaved }) => {
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const fileError = validateFile(file);
    if (fileError) { setError(fileError); return; }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('agreement_sno', String(agreement.agreement_sno));
      fd.append('signed_document', file as File);
      if (remarks.trim()) fd.append('remarks', remarks.trim());
      await axios.post(uploadSignedAgreement, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Signed copy uploaded for ${agreement.agreement_no}`);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Upload signed agreement — {agreement.agreement_no}</DialogTitle>
          <DialogDescription>The signed / scanned copy. Uploading again keeps the earlier copy and shows the newest as current.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
          <FilePicker file={file} onChange={setFile} />
          <CustomInputField field="remarks" label="Remarks (optional)" type="textarea" value={remarks} onChange={setRemarks} rows={2} className="resize-none" />
          {error && <Callout tone="danger" icon={AlertCircle}>{error}</Callout>}
        </div>
        <DialogFooter className="border-t bg-card px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><FileText size={15} /> Upload</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Supplier invoice ────────────────────────────────────────────────────────
export interface InvoiceTargetPo {
  po_basic_sno: number;
  po_no?: string | null;
  vendor_name?: string | null;
  amount?: number | null;
}

export const PoInvoiceDialog: React.FC<{
  agreementNo: string;
  pos: InvoiceTargetPo[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ agreementNo, pos, onClose, onSaved }) => {
  const [poSno, setPoSno] = useState<number>(pos[0]?.po_basic_sno ?? 0);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = pos.find((p) => p.po_basic_sno === poSno);
  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    if (!poSno) { setError('Select the PO this invoice is for'); return; }
    if (!invoiceNo.trim()) { setError('Invoice number is required'); return; }
    if (!invoiceDate) { setError('Invoice date is required'); return; }
    if (invoiceDate > today) { setError('Invoice date cannot be in the future'); return; }
    if (!(Number(amount) > 0)) { setError('Invoice amount must be greater than zero'); return; }
    const fileError = validateFile(file);
    if (fileError) { setError(fileError); return; }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('po_basic_sno', String(poSno));
      fd.append('invoice_no', invoiceNo.trim());
      fd.append('invoice_date', invoiceDate);
      fd.append('invoice_amount', String(Number(amount)));
      fd.append('invoice_document', file as File);
      if (remarks.trim()) fd.append('remarks', remarks.trim());
      await axios.post(uploadServicePoInvoice, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Invoice ${invoiceNo.trim()} uploaded${selected?.po_no ? ` against ${selected.po_no}` : ''}`);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-xl">
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Upload supplier invoice — {agreementNo}</DialogTitle>
          <DialogDescription>Attach the supplier's invoice to the approved PO.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
          {pos.length > 1 ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="invoice-po">PO / supplier</label>
              <select
                id="invoice-po"
                value={poSno}
                onChange={(e) => setPoSno(Number(e.target.value))}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              >
                {pos.map((p) => (
                  <option key={p.po_basic_sno} value={p.po_basic_sno}>
                    {p.po_no ?? `PO ${p.po_basic_sno}`} · {p.vendor_name ?? 'Supplier'}{p.amount != null ? ` · ${formatINR(p.amount)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="rounded-lg border bg-card p-3 text-sm">
              <b>{selected?.po_no ?? `PO ${poSno}`}</b>{selected?.vendor_name && <> · {selected.vendor_name}</>}
              {selected?.amount != null && <span className="text-muted-foreground"> · PO value {formatINR(selected.amount)}</span>}
            </p>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
            <CustomInputField field="invoice_no" label="Invoice no" require value={invoiceNo} onChange={setInvoiceNo} className="h-10" />
            <CustomInputField field="invoice_date" label="Invoice date" require type="date" value={invoiceDate} onChange={setInvoiceDate} className="h-10" />
            <CustomInputField field="invoice_amount" label="Invoice amount" require type="number" value={amount} onChange={setAmount} placeholder="0.00" className="h-10" />
          </div>
          <FilePicker file={file} onChange={setFile} />
          <CustomInputField field="remarks" label="Remarks (optional)" type="textarea" value={remarks} onChange={setRemarks} rows={2} className="resize-none" />
          {error && <Callout tone="danger" icon={AlertCircle}>{error}</Callout>}
        </div>
        <DialogFooter className="border-t bg-card px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><ReceiptText size={15} /> Upload invoice</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const InvoiceList: React.FC<{
  invoices?: { invoice_sno: number; invoice_no: string; invoice_date: string; invoice_amount: number; invoice_doc_url: string; po_no?: string | null }[];
  showPo?: boolean;
}> = ({ invoices, showPo }) =>
  invoices?.length ? (
    <ul className="space-y-0.5 text-xs">
      {invoices.map((i) => (
        <li key={i.invoice_sno} className="flex flex-wrap items-center gap-x-2">
          <DocLink url={i.invoice_doc_url} label={i.invoice_no} />
          <span className="text-muted-foreground">{formatDate(i.invoice_date)} · {formatINR(i.invoice_amount)}{showPo && i.po_no ? ` · ${i.po_no}` : ''}</span>
        </li>
      ))}
    </ul>
  ) : null;
