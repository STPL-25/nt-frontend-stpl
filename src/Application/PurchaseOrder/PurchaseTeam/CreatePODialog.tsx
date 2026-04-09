import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Package, Send, Loader2 } from 'lucide-react';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { usePOFormFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, Quotation, POFormState } from './types';
import { formatINR, getQuotationTotal, getPRDisplayNo, today } from './helpers';

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

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setForm({
        po_date: today(),
        required_date: selectedPR?.required_date ?? selectedPR?.req_by_date ?? '',
        purpose: selectedPR?.purpose ?? '',
        terms_conditions: selectedQuotation?.payment_terms ?? '',
        delivery_address: '',
      });
    }
  }, [open, selectedPR, selectedQuotation]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreatePO(form);
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  if (!selectedPR || !selectedQuotation) return null;

  const total = getQuotationTotal(selectedQuotation.items);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={18} className="text-indigo-600" />
            Create Purchase Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* PO Summary info */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
            <p><span className="font-medium">PR:</span> {getPRDisplayNo(selectedPR)}</p>
            <p><span className="font-medium">Vendor:</span> {selectedQuotation.vendor_name ?? selectedQuotation.company_name}</p>
            <p><span className="font-medium">Quotation:</span> {selectedQuotation.quotation_ref_no}</p>
            <p><span className="font-medium">Items:</span> {selectedQuotation.items.length}</p>
            <p><span className="font-medium">Total:</span> {formatINR(total)}</p>
          </div>

          {/* PO form fields - dynamically rendered */}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-700">
            {creating ? <Loader2 size={16} className="animate-spin mr-1" /> : <Send size={16} className="mr-1" />}
            Create PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePODialog;
