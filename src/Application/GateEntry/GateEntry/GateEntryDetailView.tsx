import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DoorOpen, FileText, Truck, Scale } from 'lucide-react';
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

const GateEntryDetailView: React.FC<{ entry: GateEntryRecord }> = ({ entry }) => (
  <Card>
    <CardHeader className="pb-3 border-b">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DoorOpen size={16} className="text-primary" />
          {entry.gate_entry_no ?? `Gate Entry #${entry.gate_entry_sno}`}
        </CardTitle>
        <Badge className={`text-xs ${statusBadge[entry.status ?? 'In']}`}>{entry.status ?? 'In'}</Badge>
      </div>
    </CardHeader>
    <CardContent className="pt-4 space-y-4">

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <FileText size={13} /> Document Details
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Entry Date / Time" value={`${formatDate(entry.entry_date)} ${entry.entry_time ?? ''}`} />
          <Field label="PO Number" value={entry.po_no} />
          <Field label="Vendor" value={entry.vendor_name} />
          <Field label="Invoice No" value={entry.invoice_no} />
          <Field label="Invoice Date" value={formatDate(entry.invoice_date)} />
          <Field label="Challan / DC No" value={entry.challan_no} />
          <Field label="LR / Consignment" value={entry.lr_no} />
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Truck size={13} /> Vehicle &amp; Transport
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Vehicle No" value={entry.vehicle_no} />
          <Field label="Driver" value={entry.driver_name} />
          <Field label="Driver Mobile" value={entry.driver_mobile} />
          <Field label="Transporter" value={entry.transporter_name} />
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Scale size={13} /> Weighment
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Gross (kg)" value={entry.gross_weight} />
          <Field label="Tare (kg)" value={entry.tare_weight} />
          <Field label="Net (kg)" value={entry.net_weight} />
          <Field label="Packages" value={entry.no_of_packages} />
        </div>
      </div>

      {(entry.material_desc || entry.remarks) && (
        <div className="pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Material Description" value={entry.material_desc} />
          <Field label="Security Remarks" value={entry.remarks} />
        </div>
      )}

      <p className="text-xs text-muted-foreground/70 pt-2 border-t">
        Recorded by {entry.created_by_name ?? '—'}
      </p>
    </CardContent>
  </Card>
);

export default GateEntryDetailView;
