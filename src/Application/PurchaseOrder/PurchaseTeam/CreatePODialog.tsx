import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Package, Send, Loader2, Download, CheckCircle2, FileText } from 'lucide-react';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { usePOFormFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, Quotation, POFormState } from './types';
import { formatINR, getQuotationTotal, getPRDisplayNo, today } from './helpers';
import { generatePOPDF, openPOPDFWindow } from './generatePOPDF';

interface CreatePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPR: PRRecord | null;
  selectedQuotation: Quotation | null;
  onCreatePO: (form: POFormState) => Promise<void>;
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
  const [savedForm, setSavedForm] = useState<POFormState | null>(null);

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
      setSavedForm(null);
    }
  }, [open, selectedPR, selectedQuotation]);

  const handleCreate = async () => {
    if (!selectedPR || !selectedQuotation) return;

    const poForm = { ...form };
    const pdfWindow = openPOPDFWindow();

    setCreating(true);
    try {
      await onCreatePO(poForm);
      setSavedForm(poForm);
      setPOCreated(true);
      if (pdfWindow) {
        generatePOPDF({ pr: selectedPR, quotation: selectedQuotation, form: poForm, targetWindow: pdfWindow });
      }
    } catch {
      pdfWindow?.close();
      // error already shown via toast in parent
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedPR || !selectedQuotation || !savedForm) return;
    generatePOPDF({ pr: selectedPR, quotation: selectedQuotation, form: savedForm });
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
              <FileText size={15} className="text-primary mt-0.5 shrink-0" />
              <p className="text-primary">
                Download the Purchase Order as a PDF to share with your supplier or for record-keeping.
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
            <>
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <Button
                onClick={handleDownloadPDF}
                className="bg-primary hover:bg-primary/90"
              >
                <Download size={16} className="mr-1" />
                Download PO as PDF
              </Button>
            </>
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
