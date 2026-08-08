import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DoorOpen, FileText, Truck, Pencil } from 'lucide-react';
import type { GateEntryRecord } from './types';
import { formatDate } from './helpers';

const statusBadge: Record<string, string> = {
  'In':       'bg-blue-100   text-blue-700   border-blue-200',
  'Verified': 'bg-amber-100  text-amber-700  border-amber-200',
  'GRN Done': 'bg-green-100  text-green-700  border-green-200',
  'Out':      'bg-muted      text-muted-foreground border-border',
};

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="text-sm font-medium text-foreground">{value ?? '—'}</p>
  </div>
);

interface GateEntryDetailViewProps {
  entry: GateEntryRecord;
  canEdit?: boolean;
  onEdit?: () => void;
}

const GateEntryDetailView: React.FC<GateEntryDetailViewProps> = ({ entry, canEdit, onEdit }) => (
  <Card>
    <CardHeader className="pb-3 border-b">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DoorOpen size={16} className="text-primary" />
          {entry.gate_entry_no ?? `Gate Entry #${entry.gate_entry_sno}`}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${statusBadge[entry.status ?? 'In']}`}>{entry.status ?? 'In'}</Badge>
          {canEdit && entry.status !== 'GRN Done' && onEdit && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEdit}>
              <Pencil size={13} className="mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-4 space-y-4">

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <FileText size={13} /> Document Details
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="PO Number" value={entry.po_no} />
          <Field label="Vendor" value={entry.vendor_name} />
          <Field label="Invoice No" value={entry.invoice_no} />
          <Field label="Invoice Date" value={formatDate(entry.invoice_date)} />
          <Field label="Received Qty" value={entry.received_qty} />
          <Field label="Received Date" value={formatDate(entry.received_date)} />
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Truck size={13} /> Transport
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Bundles" value={entry.bundles} />
          <Field label="Transport" value={entry.transport_name} />
          <Field label="LR No" value={entry.lr_no} />
          <Field label="Receiver Ecno" value={entry.receiver_ecno} />
        </div>
      </div>

      {entry.photo_url && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Photo of Product</p>
          <img src={entry.photo_url} alt="Product" className="h-32 w-32 object-cover rounded border" />
        </div>
      )}

      <p className="text-xs text-muted-foreground/70 pt-2 border-t">
        Recorded by {entry.created_by_name ?? '—'}
      </p>
    </CardContent>
  </Card>
);

export default GateEntryDetailView;
