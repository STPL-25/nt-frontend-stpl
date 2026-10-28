import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Download, Loader2, MapPin, Package, ScrollText, Truck, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Callout, DetailHero, Fact, FactGrid, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import {
  supplierAxios,
  supplierGetPODetail,
  supplierAcceptPO,
  parseSupplierPOItems,
  type SupplierPODetail as SupplierPODetailType,
} from '@/Services/SupplierService';
import { formatDate } from './helpers';
import { addressToLines, buildSupplierPOPdf } from './supplierPOPdf';

interface Props {
  po_basic_sno: number;
  /** Omit when embedded in a master-detail layout (e.g. SupplierPOWorkspace) that has no separate "back" step. */
  onBack?: () => void;
  onDispatch: (po_basic_sno: number) => void;
  /** Called after the order changed (accepted) so a list showing it can refresh. */
  onChanged?: () => void;
}

const th = 'h-9 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const fmt = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One purchase order, in the same hero + panels layout as the staff detail screens. */
const SupplierPODetail: React.FC<Props> = ({ po_basic_sno, onBack, onDispatch, onChanged }) => {
  const [po, setPO] = useState<SupplierPODetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierAxios.get(supplierGetPODetail(po_basic_sno));
      setPO(res.data?.data ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load PO');
    } finally {
      setLoading(false);
    }
  }, [po_basic_sno]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await supplierAxios.post(supplierAcceptPO(po_basic_sno));
      toast.success('PO accepted');
      await fetchDetail();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not accept PO');
    } finally {
      setAccepting(false);
    }
  };

  const back = onBack && (
    <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
      <ArrowLeft className="h-4 w-4" /> Back to purchase orders
    </Button>
  );

  if (!po) {
    return (
      <div className="space-y-3 px-3 py-4 sm:px-5">
        {back}
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Callout tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>This purchase order could not be loaded.</span>
              <Button size="sm" variant="outline" onClick={fetchDetail}>Try again</Button>
            </div>
          </Callout>
        )}
      </div>
    );
  }

  const items = parseSupplierPOItems(po.items);
  const isAccepted = po.supplier_ack_status === 'Accepted';
  const grandTotal = items.reduce((sum, it) => sum + Number(it.total_amount ?? 0), 0);
  // One term per line; strip any leading "1." / "2)" / "-" so the list numbering isn't doubled.
  const termLines = (po.terms_conditions ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);
  // Delivery address: one line per comma/newline segment so long addresses wrap tidily.
  const addrLines = addressToLines(po.delivery_address);

  const downloadPo = () => {
    if (po.po_pdf_url) window.open(po.po_pdf_url as string, '_blank');
    else buildSupplierPOPdf(po, items).save(`${po.po_no}.pdf`);
  };

  return (
    <div className="@container">
      <div className="space-y-4 px-3 py-4 sm:px-5">
        {back}

        <DetailHero
          icon={Package}
          eyebrow="Purchase order"
          title={po.po_no}
          subtitle={po.com_name ?? '—'}
          badges={isAccepted ? <StatusPill tone="success">Accepted</StatusPill> : <StatusPill tone="warning">Awaiting your acceptance</StatusPill>}
          metrics={[
            { label: 'Required by', value: formatDate(po.required_date), valueClassName: 'text-base @md:text-lg whitespace-nowrap' },
            { label: 'Items', value: items.length, valueClassName: 'text-base @md:text-lg' },
            { label: 'Order value', value: `₹${fmt(grandTotal)}`, valueClassName: 'text-base @md:text-lg whitespace-nowrap' },
          ]}
        />

        {isAccepted ? (
          <Callout tone="success" icon={CheckCircle2}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>You accepted this order{po.supplier_ack_date ? ` on ${formatDate(po.supplier_ack_date)}` : ''}. Record each shipment as you send the goods.</span>
              <Button size="sm" onClick={() => onDispatch(po_basic_sno)}><Truck className="mr-1.5 h-4 w-4" />Dispatch</Button>
            </div>
          </Callout>
        ) : (
          <Callout tone="warning" icon={ListChecks}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Review the items and terms below, then accept the order to confirm it and start dispatching.</span>
              <Button size="sm" onClick={handleAccept} disabled={accepting}>
                {accepting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                {accepting ? 'Accepting…' : 'Accept PO'}
              </Button>
            </div>
          </Callout>
        )}

        <Panel
          icon={Package}
          title="Order details"
          action={<Button variant="outline" size="sm" className="h-8" onClick={downloadPo}><Download className="mr-1.5 h-3.5 w-3.5" />Download PO</Button>}
        >
          <FactGrid>
            <Fact label="Supplier">{po.vendor_name ?? '—'}</Fact>
            <Fact label="Purpose">{po.purpose || '—'}</Fact>
            <Fact label="Ordered by">{po.com_name ?? '—'}</Fact>
            <Fact label="Order date">{formatDate(po.po_date)}</Fact>
            <Fact label="Required by">{formatDate(po.required_date)}</Fact>
            <Fact label="Accepted on">{isAccepted ? formatDate(po.supplier_ack_date) : '—'}</Fact>
          </FactGrid>
        </Panel>

        <div className="grid gap-4 @3xl:grid-cols-2">
          <Panel icon={MapPin} title="Delivery address">
            {addrLines.length > 0 ? (
              <address className="space-y-0.5 text-sm not-italic">
                {addrLines.map((l, i) => (
                  <p key={i} className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>{l}</p>
                ))}
              </address>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </Panel>
          <Panel icon={ScrollText} title="Terms & conditions">
            {termLines.length > 0 ? (
              <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:font-semibold marker:text-muted-foreground">
                {termLines.map((line, i) => <li key={i}>{line}</li>)}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </Panel>
        </div>

        <Panel icon={ListChecks} title={`Item details (${items.length})`} description="What was ordered, at what rate" bodyClassName="p-0 sm:p-0">
          {/* Narrow pane: cards */}
          <div className="flex flex-col divide-y @xl:hidden">
            {items.map((item, idx) => (
              <div key={item.po_item_sno} className="p-3">
                <p className="text-sm font-semibold">{idx + 1}. {item.prod_name}</p>
                {item.specification && <p className="text-xs text-muted-foreground">{item.specification}</p>}
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Qty</p><p className="font-medium">{item.ordered_qty} {item.unit_name ?? ''}</p></div>
                  <div><p className="text-muted-foreground">Rate</p><p className="font-medium">₹{fmt(item.unit_price)}</p></div>
                  <div className="text-right"><p className="text-muted-foreground">Amount</p><p className="font-semibold">₹{fmt(item.total_amount)}</p></div>
                </div>
              </div>
            ))}
          </div>

          {/* Wider pane: table */}
          <div className="hidden overflow-x-auto @xl:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className={`w-10 ${th}`}>#</TableHead>
                  <TableHead className={th}>Product</TableHead>
                  <TableHead className={`text-right ${th}`}>Qty</TableHead>
                  <TableHead className={th}>Unit</TableHead>
                  <TableHead className={`text-right ${th}`}>Unit price</TableHead>
                  <TableHead className={`text-right ${th}`}>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.po_item_sno}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium">{item.prod_name}</p>
                      {item.specification && <p className="text-xs text-muted-foreground">{item.specification}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.ordered_qty}</TableCell>
                    <TableCell>{item.unit_name || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">₹{fmt(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">₹{fmt(item.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 sm:px-5">
            <span className="text-sm font-medium text-muted-foreground">Grand total</span>
            <span className="text-base font-bold tabular-nums">₹{fmt(grandTotal)}</span>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default SupplierPODetail;
