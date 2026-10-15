import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Download, MapPin, ScrollText, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/utils/statusUtils';
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
}

const fmt = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SupplierPODetail: React.FC<Props> = ({ po_basic_sno, onBack, onDispatch }) => {
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
      fetchDetail();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not accept PO');
    } finally {
      setAccepting(false);
    }
  };

  if (loading || !po) {
    return (
      <div className="flex flex-col gap-4">
        {onBack && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <p className="text-sm text-muted-foreground">Loading…</p>
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

  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back to purchase orders
        </Button>
      )}

      <Card className="overflow-hidden">
        {/* Header band */}
        <div className="flex flex-col gap-4 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">Purchase Order</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="break-all text-xl font-bold sm:text-2xl">{po.po_no}</h2>
              <StatusBadge status={po.supplier_ack_status ?? 'Pending'} />
            </div>
            <p className="mt-1 text-sm text-white/80">{po.com_name ?? '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (po.po_pdf_url) window.open(po.po_pdf_url as string, '_blank');
                else buildSupplierPOPdf(po, items).save(`${po.po_no}.pdf`);
              }}
            >
              <Download className="h-4 w-4" />
              Download PO
            </Button>
            {!isAccepted && (
              <Button onClick={handleAccept} disabled={accepting} className="bg-white text-indigo-700 hover:bg-white/90">
                <CheckCircle2 className="h-4 w-4" />
                {accepting ? 'Accepting…' : 'Accept PO'}
              </Button>
            )}
            {isAccepted && (
              <Button onClick={() => onDispatch(po_basic_sno)} className="bg-white text-indigo-700 hover:bg-white/90">
                <Truck className="h-4 w-4" />
                Dispatch
              </Button>
            )}
          </div>
        </div>

        <CardContent className="flex flex-col gap-6 p-4 sm:p-6">
          {/* Key facts */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Order date', value: formatDate(po.po_date) },
              { label: 'Required by', value: formatDate(po.required_date) },
              { label: 'Supplier', value: po.vendor_name ?? '—' },
              { label: 'Purpose', value: po.purpose || '—' },
            ].map((f) => (
              <div key={f.label} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                <p className="mt-0.5 break-words text-sm font-semibold">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Delivery address + Terms */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-indigo-600" /> Delivery address
              </h3>
              {addrLines.length > 0 ? (
                <address className="space-y-0.5 text-sm not-italic">
                  {addrLines.map((l, i) => (
                    <p key={i} className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>{l}</p>
                  ))}
                </address>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </section>
            <section className="rounded-lg border p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ScrollText className="h-4 w-4 text-indigo-600" /> Terms &amp; conditions
              </h3>
              {termLines.length > 0 ? (
                <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:font-semibold marker:text-indigo-600">
                  {termLines.map((line, i) => <li key={i}>{line}</li>)}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </section>
          </div>

          {/* Items */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Item details ({items.length})</h3>

            {/* Mobile: cards */}
            <div className="flex flex-col gap-2 sm:hidden">
              {items.map((item, idx) => (
                <div key={item.po_item_sno} className="rounded-lg border p-3">
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

            {/* Tablet/desktop: table */}
            <div className="hidden overflow-x-auto rounded-lg border sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
                      <TableCell className="text-right">{item.ordered_qty}</TableCell>
                      <TableCell>{item.unit_name || '—'}</TableCell>
                      <TableCell className="text-right">₹{fmt(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">₹{fmt(item.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-3 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100 sm:ml-auto sm:w-72">
              <span className="text-sm font-medium">Grand total</span>
              <span className="text-base font-bold">₹{fmt(grandTotal)}</span>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierPODetail;
