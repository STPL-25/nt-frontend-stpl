import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AssetRequest } from '@/Services/GrnService/assetApi';
import { StatusBadge, TypeBadge, fmtDate } from './helpers';

interface Props {
  rows: AssetRequest[];
  loading: boolean;
  emptyText: string;
  onOpen: (r: AssetRequest) => void;
}

const RequestsTable: React.FC<Props> = ({ rows, loading, emptyText, onOpen }) => {
  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Request</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium">Department</th>
            <th className="px-3 py-2 font-medium">Raised by</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Waiting on</th>
            <th className="px-3 py-2 font-medium">Raised</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.asset_req_sno} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2 font-medium whitespace-nowrap">{r.request_no}</td>
              <td className="px-3 py-2"><TypeBadge type={r.request_type} mode={r.service_mode} /></td>
              <td className="px-3 py-2">
                {r.item_name} <span className="text-muted-foreground">× {r.qty}</span>
              </td>
              <td className="px-3 py-2">{r.dept_name ?? '—'}</td>
              <td className="px-3 py-2">
                {r.raised_by_name ?? r.raised_by}
                {r.raised_role === 'STORE' && <span className="ml-1 text-xs text-muted-foreground">(Store)</span>}
              </td>
              <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
              <td className="px-3 py-2">{r.current_approver_name ?? r.current_approver_ecno ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
              <td className="px-3 py-2 text-right">
                <Button size="sm" variant="outline" onClick={() => onOpen(r)}>View</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RequestsTable;
