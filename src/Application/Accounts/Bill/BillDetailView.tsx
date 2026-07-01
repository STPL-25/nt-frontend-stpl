import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReceiptText, CheckCircle2, CheckCheck } from 'lucide-react';
import type { Bill } from './types';
import { formatDate, formatINR, outstanding } from './helpers';

interface BillDetailViewProps {
  bill: Bill;
  onApprove?: (bill: Bill) => void;
}

const statusBadge: Record<string, string> = {
  'Draft':            'bg-muted text-muted-foreground border-border',
  'Pending Approval': 'bg-amber-100 text-amber-700 border-amber-200',
  'Approved':         'bg-blue-100  text-blue-700  border-blue-200',
  'Partially Paid':   'bg-amber-100 text-amber-700 border-amber-200',
  'Paid':             'bg-green-100 text-green-700 border-green-200',
  'Rejected':         'bg-red-100   text-red-700   border-red-200',
};

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="text-sm font-medium text-foreground">{value ?? '—'}</p>
  </div>
);

const amtRow = (label: string, value: number, strong = false) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={strong ? 'font-semibold text-foreground text-sm' : 'text-foreground'}>{formatINR(value)}</span>
  </div>
);

const BillDetailView: React.FC<BillDetailViewProps> = ({ bill, onApprove }) => {
  const due = outstanding(bill);
  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ReceiptText size={16} className="text-primary" />
            {bill.bill_no ?? `Bill #${bill.bill_sno}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${bill.match_status === 'Matched' ? 'bg-green-100 text-green-700 border-green-200' : bill.match_status === 'Mismatch' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-muted text-muted-foreground'}`}>
              {bill.match_status}
            </Badge>
            <Badge className={`text-xs ${statusBadge[bill.status]}`}>{bill.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Supplier Invoice" value={bill.supplier_invoice_no} />
          <Field label="Invoice Date" value={formatDate(bill.invoice_date)} />
          <Field label="Vendor" value={bill.vendor_name} />
          <Field label="PO Number" value={bill.po_no} />
          <Field label="GRN Number" value={bill.grn_no} />
          <Field label="Due Date" value={formatDate(bill.due_date)} />
        </div>

        <div className="border rounded-md p-3 bg-muted/30 space-y-1.5 max-w-sm">
          {amtRow('Basic Amount', bill.basic_amount)}
          {bill.discount > 0 && amtRow('(-) Discount', -bill.discount)}
          {amtRow('Taxable Amount', bill.taxable_amount)}
          {bill.cgst > 0 && amtRow('CGST', bill.cgst)}
          {bill.sgst > 0 && amtRow('SGST', bill.sgst)}
          {bill.igst > 0 && amtRow('IGST', bill.igst)}
          {bill.tds > 0 && amtRow('(-) TDS', -bill.tds)}
          {bill.other_charges > 0 && amtRow('Other Charges', bill.other_charges)}
          <div className="border-t pt-1.5">{amtRow('Net Payable', bill.net_payable, true)}</div>
          {(bill.paid_amount ?? 0) > 0 && (
            <>
              {amtRow('Paid', bill.paid_amount ?? 0)}
              {amtRow('Outstanding', due, true)}
            </>
          )}
        </div>

        {bill.remarks && <Field label="Remarks" value={bill.remarks} />}

        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground/70">
            Booked by {bill.created_by_name ?? '—'}
          </p>
          {onApprove && bill.status === 'Pending Approval' && (
            <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700" onClick={() => onApprove(bill)}>
              <CheckCircle2 size={13} className="mr-1" /> Approve Bill
            </Button>
          )}
          {bill.status === 'Approved' && due > 0 && (
            <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1">
              <CheckCheck size={12} /> Ready for payment
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BillDetailView;
