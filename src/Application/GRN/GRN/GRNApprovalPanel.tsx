import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { formatDate, formatINR } from './helpers';
import { getAuthFileUrl } from '@/Services/authUrl';

export interface GRNApprovalRow {
  grn_basic_sno: number;
  grn_no: string;
  po_basic_sno: number;
  received_date?: string;
  created_by?: string;
  created_at?: string;
  item_count?: number;
  total_received_qty?: number;
  po_no?: string;
  vendor_name?: string;
  gate_entry_no?: string;
  doc_ref_no?: string;
  invoice_date?: string;
  invoice_amount?: number;
  invoice_doc_url?: string;
  vehicle_no?: string;
  challan_no?: string;
  remarks?: string;
  items?: string | any[];
}

const parseItems = (raw: GRNApprovalRow['items']): any[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  return [];
};

const Field: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) =>
  children ? (
    <div>
      <span className="text-muted-foreground/70">{label}: </span>
      <span className="font-medium">{children}</span>
    </div>
  ) : null;

interface Props {
  rows: GRNApprovalRow[];
  busyId: number | null;
  onDecide: (row: GRNApprovalRow, action: 'approve' | 'reject', comments: string) => void;
}

/** GRNs waiting for the logged-in approver. Stock is posted only on final approval. */
const GRNApprovalPanel: React.FC<Props> = ({ rows, busyId, onDecide }) => {
  const [comments, setComments] = useState<Record<number, string>>({});
  if (rows.length === 0) return null;

  return (
    <Card className="border-blue-300 bg-blue-50/40 dark:bg-blue-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck size={16} className="text-blue-600" />
          GRNs awaiting your approval
          <Badge variant="outline" className="text-xs">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(r => (
          <div key={r.grn_basic_sno} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{r.grn_no}</p>
                <p className="text-xs text-muted-foreground">
                  Received {formatDate(r.received_date)} · {r.item_count ?? 0} item(s) · qty {r.total_received_qty ?? 0}
                  {r.created_by ? ` · by ${r.created_by}` : ''}
                </p>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">Stock posts on final approval</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Field label="PO">{r.po_no}</Field>
              <Field label="Supplier">{r.vendor_name}</Field>
              <Field label="Gate entry">{r.gate_entry_no}</Field>
              <Field label="Challan">{r.challan_no}</Field>
              <Field label="Vehicle">{r.vehicle_no}</Field>
              <Field label="Invoice no">{r.doc_ref_no}</Field>
              <Field label="Invoice date">{r.invoice_date ? formatDate(r.invoice_date) : ''}</Field>
              <Field label="Invoice amount">{r.invoice_amount != null ? formatINR(r.invoice_amount) : ''}</Field>
            </div>
            {r.invoice_doc_url && (
              <a href={getAuthFileUrl(r.invoice_doc_url)} target="_blank" rel="noreferrer"
                 className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline">
                View uploaded invoice
              </a>
            )}
            {r.remarks && <p className="text-xs text-muted-foreground">Note: {r.remarks}</p>}
            {parseItems(r.items).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-1.5">Item</th><th className="p-1.5">HSN</th><th className="p-1.5">Ordered</th>
                      <th className="p-1.5">Invoice qty</th><th className="p-1.5">Received</th><th className="p-1.5">Rejected</th>
                      <th className="p-1.5">Short / Excess</th><th className="p-1.5">Condition</th><th className="p-1.5">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseItems(r.items).map((it: any, i: number) => (
                      <tr key={it.grn_item_sno ?? i} className="border-t">
                        <td className="p-1.5">{it.prod_name}{it.specification ? ` - ${it.specification}` : ''}</td>
                        <td className="p-1.5">{it.hsn_code ?? '-'}</td>
                        <td className="p-1.5">{it.ordered_qty} {it.unit_name}</td>
                        <td className="p-1.5">{it.invoice_qty != null ? `${it.invoice_qty} ${it.invoice_uom ?? ''}` : '-'}</td>
                        <td className="p-1.5">{it.received_qty}</td>
                        <td className="p-1.5">{it.rejected_qty}</td>
                        <td className="p-1.5">{Number(it.shortage_qty) ? `Short ${it.shortage_qty}` : Number(it.excess_qty) ? `Excess ${it.excess_qty}` : '-'}</td>
                        <td className="p-1.5">{it.condition}</td>
                        <td className="p-1.5">{it.warehouse_location_name ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Remarks (required to reject)"
                value={comments[r.grn_basic_sno] ?? ''}
                onChange={e => setComments(p => ({ ...p, [r.grn_basic_sno]: e.target.value }))}
                className="h-8 text-xs max-w-xs"
              />
              <Button
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                disabled={busyId === r.grn_basic_sno}
                onClick={() => onDecide(r, 'approve', comments[r.grn_basic_sno] ?? '')}
              >
                <Check size={13} className="mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
                disabled={busyId === r.grn_basic_sno || !(comments[r.grn_basic_sno] ?? '').trim()}
                onClick={() => onDecide(r, 'reject', comments[r.grn_basic_sno] ?? '')}
              >
                <X size={13} className="mr-1" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default GRNApprovalPanel;
