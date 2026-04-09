import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { GRNRecord } from './types';
import { formatDate, formatINR } from './helpers';

interface GRNListViewProps {
  grns: GRNRecord[];
  loading: boolean;
  onRefresh: () => void;
}

const conditionColor: Record<string, string> = {
  Good:    'bg-green-100 text-green-700 border-green-200',
  Damaged: 'bg-red-100   text-red-700   border-red-200',
  Partial: 'bg-amber-100 text-amber-700 border-amber-200',
};

const GRNCard: React.FC<{ grn: GRNRecord }> = ({ grn }) => {
  const [expanded, setExpanded] = useState(false);
  const totalReceived = grn.items.reduce((s, it) => s + it.received_qty, 0);
  const totalRejected = grn.items.reduce((s, it) => s + it.rejected_qty, 0);

  return (
    <Card className="border-gray-200">
      <CardContent className="pt-4">
        {/* GRN Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                {grn.grn_no ?? `GRN #${grn.grn_basic_sno}`}
              </span>
              <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                Submitted
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
              <div>
                <span className="text-gray-400">Date: </span>
                <span className="font-medium">{formatDate(grn.received_date)}</span>
              </div>
              {grn.doc_ref_no && (
                <div>
                  <span className="text-gray-400">Doc Ref: </span>
                  <span className="font-medium">{grn.doc_ref_no}</span>
                </div>
              )}
              {grn.challan_no && (
                <div>
                  <span className="text-gray-400">Challan: </span>
                  <span>{grn.challan_no}</span>
                </div>
              )}
              {grn.vehicle_no && (
                <div>
                  <span className="text-gray-400">Vehicle: </span>
                  <span>{grn.vehicle_no}</span>
                </div>
              )}
              <div>
                <span className="text-gray-400">Items: </span>
                <span>{grn.items.length}</span>
              </div>
              <div>
                <span className="text-gray-400">Received: </span>
                <span className="font-medium text-green-700">{totalReceived}</span>
              </div>
              {totalRejected > 0 && (
                <div>
                  <span className="text-gray-400">Rejected: </span>
                  <span className="font-medium text-red-600">{totalRejected}</span>
                </div>
              )}
            </div>
            {grn.remarks && (
              <p className="text-xs text-gray-500 mt-1">Note: {grn.remarks}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 shrink-0"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded
              ? <><ChevronUp size={13} className="mr-1" /> Hide Items</>
              : <><ChevronDown size={13} className="mr-1" /> View Items</>
            }
          </Button>
        </div>

        {/* Item details (expandable) */}
        {expanded && grn.items.length > 0 && (
          <div className="mt-3 border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs text-center">Ordered</TableHead>
                  <TableHead className="text-xs text-center">Received</TableHead>
                  <TableHead className="text-xs text-center">Rejected</TableHead>
                  <TableHead className="text-xs">Condition</TableHead>
                  <TableHead className="text-xs">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grn.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{item.prod_name}</p>
                      {item.specification && (
                        <p className="text-xs text-gray-400">{item.specification}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-center text-gray-600">
                      {item.ordered_qty} {item.unit_name}
                    </TableCell>
                    <TableCell className="text-xs text-center font-medium text-green-700">
                      {item.received_qty}
                    </TableCell>
                    <TableCell className="text-xs text-center font-medium text-red-600">
                      {item.rejected_qty || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${conditionColor[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                        {item.condition}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{item.remarks || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const GRNListView: React.FC<GRNListViewProps> = ({ grns, loading, onRefresh }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList size={16} className="text-purple-600" />
            GRN History
            <Badge variant="outline" className="text-xs ml-1">{grns.length}</Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-6 justify-center">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading GRN history...</span>
          </div>
        ) : grns.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-gray-400 gap-2">
            <ClipboardList size={28} />
            <p className="text-sm">No GRNs submitted for this PO yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grns.map(grn => (
              <GRNCard key={grn.grn_basic_sno ?? grn.grn_no} grn={grn} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GRNListView;
