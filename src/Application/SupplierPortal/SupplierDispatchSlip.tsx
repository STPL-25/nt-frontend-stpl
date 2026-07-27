import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  supplierAxios,
  supplierGetDispatchDelivery,
  formatFromAddress,
  type SupplierDispatchDelivery,
} from '@/Services/SupplierService';
import { formatDate } from './helpers';

interface Props {
  delivery_sno: number;
  onBack: () => void;
}

const SupplierDispatchSlip: React.FC<Props> = ({ delivery_sno, onBack }) => {
  const [delivery, setDelivery] = useState<SupplierDispatchDelivery | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await supplierAxios.get(supplierGetDispatchDelivery(delivery_sno));
        const data: SupplierDispatchDelivery = res.data?.data;
        setDelivery(data);
        if (data?.lr_no) {
          const url = await QRCode.toDataURL(data.lr_no, {
            margin: 0,
            width: 256,
            color: { dark: '#1E3A5F', light: '#FFFFFF' },
          });
          setQrDataUrl(url);
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? 'Failed to load delivery slip');
      } finally {
        setLoading(false);
      }
    })();
  }, [delivery_sno]);

  if (loading || !delivery) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print slip
        </Button>
      </div>

      <div
        id="dispatch-slip-print-area"
        className="mx-auto w-full max-w-lg rounded-md border-2 border-foreground bg-card p-5 print:border print:shadow-none"
      >
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <span className="text-sm font-semibold uppercase tracking-wide">Delivery Slip</span>
          <span className="font-mono text-sm">{delivery.dispatch_slip_no}</span>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From</p>
              <p className="text-sm font-medium">{delivery.supplier_name}</p>
              <p className="text-sm">{formatFromAddress(delivery) || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To</p>
              <p className="text-sm">{delivery.to_address || '—'}</p>
            </div>
          </div>

          <div className="flex w-28 shrink-0 flex-col items-center gap-1">
            {qrDataUrl && <img src={qrDataUrl} alt="LR QR code" className="h-24 w-24" />}
            <span className="text-center text-[10px] text-muted-foreground">LR: {delivery.lr_no}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-xs">
          <span className="text-muted-foreground">PO No.</span>
          <span className="text-right font-medium">{delivery.po_no}</span>
          <span className="text-muted-foreground">LR No.</span>
          <span className="text-right font-medium">{delivery.lr_no}</span>
          <span className="text-muted-foreground">Invoice No.</span>
          <span className="text-right font-medium">{delivery.invoice_no}</span>
          <span className="text-muted-foreground">Invoice Date</span>
          <span className="text-right font-medium">{formatDate(delivery.invoice_date)}</span>
          <span className="text-muted-foreground">Qty (How Many)</span>
          <span className="text-right font-medium">{delivery.qty ?? '—'}</span>
          <span className="text-muted-foreground">Pieces</span>
          <span className="text-right font-medium">{delivery.pieces ?? '—'}</span>
          <span className="text-muted-foreground">Bundles</span>
          <span className="text-right font-medium">{delivery.bundles ?? '—'}</span>
          <span className="text-muted-foreground">Transport</span>
          <span className="text-right font-medium">{delivery.transport_name || '—'}</span>
        </div>
      </div>
    </div>
  );
};

export default SupplierDispatchSlip;
