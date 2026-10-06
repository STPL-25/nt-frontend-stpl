import React from 'react';
import { Button } from '@/components/ui/button';
import { DoorOpen, FileText, Pencil, Truck } from 'lucide-react';
import { DetailHero, Fact, FactGrid, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import type { GateEntryRecord } from './types';
import { formatDate } from './helpers';
import { GATE_STATUS_TONE } from './GateEntrySidebar';

interface GateEntryDetailViewProps {
  entry: GateEntryRecord;
  canEdit?: boolean;
  onEdit?: () => void;
}

const GateEntryDetailView: React.FC<GateEntryDetailViewProps> = ({ entry, canEdit, onEdit }) => {
  const status = entry.status ?? 'In';
  return (
    <div className="@container space-y-4 sm:space-y-5">
      <DetailHero
        icon={DoorOpen}
        eyebrow="Gate entry"
        title={entry.gate_entry_no ?? `Gate Entry #${entry.gate_entry_sno}`}
        subtitle={entry.vendor_name}
        badges={<StatusPill tone={GATE_STATUS_TONE[status] ?? 'neutral'}>{status}</StatusPill>}
        metrics={[
          { label: 'Received qty', value: entry.received_qty ?? '—', accent: true },
          { label: 'Bundles', value: entry.bundles ?? '—' },
          { label: 'Received on', value: formatDate(entry.received_date), valueClassName: 'text-base @md:text-base' },
        ]}
      />

      {canEdit && status !== 'GRN Done' && onEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">Details wrong? Correct them before the GRN is raised.</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-4 w-4" />Edit entry
          </Button>
        </div>
      )}

      <Panel icon={FileText} title="Document details">
        <FactGrid>
          <Fact label="PO number">{entry.po_no ?? '—'}</Fact>
          <Fact label="Vendor">{entry.vendor_name ?? '—'}</Fact>
          <Fact label="Invoice no.">{entry.invoice_no ?? '—'}</Fact>
          <Fact label="Invoice date">{formatDate(entry.invoice_date)}</Fact>
          <Fact label="Received qty">{entry.received_qty ?? '—'}</Fact>
          <Fact label="Received date">{formatDate(entry.received_date)}</Fact>
        </FactGrid>
      </Panel>

      <Panel icon={Truck} title="Transport">
        <FactGrid>
          <Fact label="Bundles">{entry.bundles ?? '—'}</Fact>
          <Fact label="Transport">{entry.transport_name ?? '—'}</Fact>
          <Fact label="LR no.">{entry.lr_no ?? '—'}</Fact>
          <Fact label="Receiver ecno">{entry.receiver_ecno ?? '—'}</Fact>
        </FactGrid>
        {entry.photo_url && (
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Photo of product</p>
            <img src={entry.photo_url} alt="Product" className="h-32 w-32 rounded-lg border object-cover" />
          </div>
        )}
      </Panel>

      <p className="px-1 text-xs text-muted-foreground">Recorded by {entry.created_by_name ?? '—'}</p>
    </div>
  );
};

export default GateEntryDetailView;
