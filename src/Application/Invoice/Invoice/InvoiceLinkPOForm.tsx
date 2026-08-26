import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link2, ShieldCheck } from 'lucide-react';
import type { Invoice } from './types';

interface InvoiceLinkPOFormProps {
  invoice: Invoice;
  saving: boolean;
  verifying: boolean;
  onSubmit: (po_basic_sno: number) => void;
  onVerify: (remarks: string) => void;
}

const InvoiceLinkPOForm: React.FC<InvoiceLinkPOFormProps> = ({ invoice, saving, verifying, onSubmit, onVerify }) => {
  const [poBasicSno, setPoBasicSno] = useState('');
  const [remarks, setRemarks] = useState('');
  const isRetrospective = invoice.source_type === 'RETROSPECTIVE';
  const isVerified = invoice.verification_status === 'Verified';

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Link2 size={16} className="text-amber-700" />
          Link to PO
          {isRetrospective && (
            <Badge className={`text-xs ml-1 ${isVerified ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
              {isVerified ? 'Delivery Verified' : 'Delivery Not Verified'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {isRetrospective
            ? 'Retrospective invoice — link it to the call-off PO once the vendor-bill-driven requisition is approved.'
            : 'This invoice has no PO linked yet.'}
        </p>

        {isRetrospective && !isVerified && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-foreground font-medium">
              Step 1 — Verify this bill against the delivery register / acknowledgement log
            </p>
            <div className="flex items-end gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-muted-foreground">Verification Remarks</Label>
                <Input value={remarks} onChange={e => setRemarks(e.target.value)} className="h-8 text-sm" placeholder="e.g. Matches delivery log entries #45-52" />
              </div>
              <Button size="sm" variant="outline" className="text-xs" disabled={verifying} onClick={() => onVerify(remarks)}>
                <ShieldCheck size={13} className="mr-1" />
                {verifying ? 'Verifying…' : 'Verify Delivery'}
              </Button>
            </div>
          </div>
        )}

        <div className={`space-y-2 ${isRetrospective && !isVerified ? 'border-t pt-3 opacity-50 pointer-events-none' : ''}`}>
          {isRetrospective && (
            <p className="text-xs text-foreground font-medium">
              Step 2 — Raise a retrospective requisition referencing this invoice (invoice_sno {invoice.invoice_sno}),
              then paste the resulting call-off PO's basic no. here
            </p>
          )}
          <div className="flex items-end gap-2">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">PO Basic No *</Label>
              <Input type="number" value={poBasicSno} onChange={e => setPoBasicSno(e.target.value)} className="h-8 text-sm" />
            </div>
            <Button
              size="sm" className="text-xs"
              disabled={!poBasicSno || saving}
              onClick={() => onSubmit(Number(poBasicSno))}
            >
              {saving ? 'Linking…' : 'Link PO'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceLinkPOForm;
