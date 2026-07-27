import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Package, Send, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { usePOFormFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import usePost from '@/hooks/usePostHook';
import { purchaseTeamSendPOEmail } from '@/Services/Api';
import type { PRRecord, Quotation, POFormState } from './types';
import { formatINR, getQuotationTotal, getPRDisplayNo, today } from './helpers';
import { buildPOPdfBlob } from './generatePOPdfBlob';

/** createPOFromQuotation's response is either a single `{data:[row]}` payload
 * or (split-group case) an array of such payloads — pull the first result row. */
function extractPOResultRow(response: unknown): { po_no?: string; vendor_sno?: number } | null {
  const payload = Array.isArray(response) ? response[0] : response;
  const row = (payload as any)?.data?.[0] ?? (payload as any)?.decrypted?.data?.[0];
  return row ?? null;
}

interface CreatePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPR: PRRecord | null;
  selectedQuotation: Quotation | null;
  onCreatePO: (form: POFormState) => Promise<unknown>;
}

const CreatePODialog: React.FC<CreatePODialogProps> = ({
  open, onOpenChange, selectedPR, selectedQuotation, onCreatePO,
}) => {
  const poFormFields = usePOFormFields();
  const inputFields = poFormFields.filter(f => f.input);
  const gridFields = inputFields.filter(f => f.type !== 'textarea');
  const textareaFields = inputFields.filter(f => f.type === 'textarea');

  const [form, setForm] = useState<POFormState>({
    po_date: today(),
    required_date: selectedPR?.required_date ?? selectedPR?.req_by_date ?? '',
    purpose: selectedPR?.purpose ?? '',
    terms_conditions: selectedQuotation?.payment_terms ?? '',
    delivery_address: '',
  });
  const [creating, setCreating] = useState(false);
  const [poCreated, setPOCreated] = useState(false);
  const { postData: postSendPOEmail } = usePost();

  React.useEffect(() => {
    if (open) {
      setForm({
        po_date: today(),
        required_date: selectedPR?.required_date ?? selectedPR?.req_by_date ?? '',
        purpose: selectedPR?.purpose ?? '',
        terms_conditions: selectedQuotation?.payment_terms ?? '',
        delivery_address: '',
      });
      setPOCreated(false);
    }
  }, [open, selectedPR, selectedQuotation]);

  const handleCreate = async () => {
    if (!selectedPR || !selectedQuotation) return;

    const poForm = { ...form };

    setCreating(true);
    try {
      const poResponse = await onCreatePO(poForm);
      setPOCreated(true);
      await emailPOPdf(poForm, poResponse);
    } catch {
      // error already shown via toast in parent
    } finally {
      setCreating(false);
    }
  };

  // Generates the PO as a PDF in the browser and uploads it so the backend
  // can email it to the supplier — the PDF is never downloaded locally.
  const emailPOPdf = async (poForm: POFormState, poResponse: unknown) => {
    if (!selectedPR || !selectedQuotation) return;

    const resultRow = extractPOResultRow(poResponse);
    const poNo = resultRow?.po_no;
    const vendorSno = resultRow?.vendor_sno ?? selectedQuotation.vendor_sno;
    if (!poNo || !vendorSno) return;

    try {
      const pdfBlob = buildPOPdfBlob({ pr: selectedPR, quotation: selectedQuotation, form: poForm, poNo });

      const fd = new FormData();
      fd.append('vendor_sno', String(vendorSno));
      fd.append('po_no', poNo);
      fd.append('po_date', poForm.po_date);
      fd.append('required_date', poForm.required_date);
      fd.append('terms_conditions', poForm.terms_conditions ?? '');
      fd.append('delivery_address', poForm.delivery_address ?? '');
      fd.append('items', JSON.stringify(selectedQuotation.items));
      fd.append('po_pdf', pdfBlob, `${poNo}.pdf`);

      await postSendPOEmail(purchaseTeamSendPOEmail, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
    } catch {
      toast.warning('PO created, but emailing the PDF to the supplier failed.');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!selectedPR || !selectedQuotation) return null;

  const total = getQuotationTotal(selectedQuotation.items);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={18} className="text-primary" />
            Create Purchase Order
          </DialogTitle>
        </DialogHeader>

        {poCreated ? (
          /* ── Success state ── */
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Purchase Order Created!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PO for <span className="font-medium">{selectedQuotation.vendor_name ?? selectedQuotation.company_name}</span> has been saved successfully.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">PR</span>
                <span className="font-medium">{getPRDisplayNo(selectedPR)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{selectedQuotation.vendor_name ?? selectedQuotation.company_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quotation</span>
                <span className="font-medium">{selectedQuotation.quotation_ref_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-semibold text-green-700">{formatINR(total)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm flex items-start gap-2">
              <Mail size={15} className="text-primary mt-0.5 shrink-0" />
              <p className="text-primary">
                The Purchase Order PDF has been emailed to the supplier.
              </p>
            </div>
          </div>
        ) : (
          /* ── Form state ── */
          <div className="space-y-4">
            {/* PO Summary info */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
              <p><span className="font-medium">PR:</span> {getPRDisplayNo(selectedPR)}</p>
              <p><span className="font-medium">Vendor:</span> {selectedQuotation.vendor_name ?? selectedQuotation.company_name}</p>
              <p><span className="font-medium">Quotation:</span> {selectedQuotation.quotation_ref_no}</p>
              <p><span className="font-medium">Items:</span> {selectedQuotation.items.length}</p>
              <p><span className="font-medium">Total:</span> {formatINR(total)}</p>
            </div>

            {/* PO form fields */}
            <div className="grid grid-cols-2 gap-4">
              {gridFields.map(field => (
                <CustomInputField
                  key={field.field}
                  field={field.field}
                  label={field.label}
                  type={field.type}
                  require={field.require}
                  placeholder={field.placeholder}
                  value={(form as any)[field.field] ?? ''}
                  onChange={(value) => setForm(f => ({ ...f, [field.field]: value }))}
                />
              ))}
            </div>

            {textareaFields.map(field => (
              <CustomInputField
                key={field.field}
                field={field.field}
                label={field.label}
                type={field.type}
                placeholder={field.placeholder}
                value={(form as any)[field.field] ?? ''}
                onChange={(value) => setForm(f => ({ ...f, [field.field]: value }))}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          {poCreated ? (
            <Button onClick={handleClose} className="bg-primary hover:bg-primary/90">Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-primary hover:bg-primary/90">
                {creating ? <Loader2 size={16} className="animate-spin mr-1" /> : <Send size={16} className="mr-1" />}
                Create PO
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePODialog;
