import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Download, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

interface Props {
  po_basic_sno: number;
  /** Omit when embedded in a master-detail layout (e.g. SupplierPOWorkspace) that has no separate "back" step. */
  onBack?: () => void;
  onDispatch: (po_basic_sno: number) => void;
}

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

  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back to purchase orders
        </Button>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {po.po_no}
              <StatusBadge status={po.supplier_ack_status ?? 'Pending'} />
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {po.com_name ?? '—'} · Order date {formatDate(po.po_date)} · Required by {formatDate(po.required_date)}
            </p>
          </div>
          <div className="flex gap-2">
            {po.po_pdf_url && (
              <Button variant="outline" onClick={() => window.open(po.po_pdf_url as string, '_blank')}>
                <Download className="h-4 w-4" />
                Download PO
              </Button>
            )}
            {!isAccepted && (
              <Button onClick={handleAccept} disabled={accepting}>
                <CheckCircle2 className="h-4 w-4" />
                {accepting ? 'Accepting…' : 'Accept PO'}
              </Button>
            )}
            {isAccepted && (
              <Button onClick={() => onDispatch(po_basic_sno)}>
                <Truck className="h-4 w-4" />
                Dispatch
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Delivery address</p>
              <p className="text-sm">{po.delivery_address || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Terms &amp; conditions</p>
              <p className="text-sm">{po.terms_conditions || '—'}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  {/* <TableHead>Specification</TableHead> */}
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.po_item_sno}>
                    <TableCell>{item.prod_name}</TableCell>
                    {/* <TableCell className="text-muted-foreground">{item.specification || '—'}</TableCell> */}
                    <TableCell className="text-right">{item.ordered_qty}</TableCell>
                    <TableCell>{item.unit_name || '—'}</TableCell>
                    <TableCell className="text-right">{item.unit_price?.toFixed?.(2) ?? item.unit_price}</TableCell>
                    <TableCell className="text-right">{item.total_amount?.toFixed?.(2) ?? item.total_amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierPODetail;
