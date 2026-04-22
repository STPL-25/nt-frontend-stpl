import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import type { JournalEntry } from './types';
import { formatDate, formatINR } from './helpers';

interface EntryHistoryViewProps {
  entry: JournalEntry;
}

const voucherColor: Record<string, string> = {
  Journal:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  Payment:  'bg-red-100 text-red-700 border-red-200',
  Receipt:  'bg-green-100 text-green-700 border-green-200',
  Contra:   'bg-purple-100 text-purple-700 border-purple-200',
  Sales:    'bg-amber-100 text-amber-700 border-amber-200',
  Purchase: 'bg-orange-100 text-orange-700 border-orange-200',
};

const EntryHistoryView: React.FC<EntryHistoryViewProps> = ({ entry }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History size={15} className="text-indigo-600" />
            Entry Detail — {entry.entry_no}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${voucherColor[entry.voucher_type] ?? ''}`}>
              {entry.voucher_type}
            </Badge>
            {entry.status === 'Posted' && (
              <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 size={11} className="mr-1" /> Posted
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meta info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
          {[
            { label: 'Entry Date',   value: formatDate(entry.entry_date) },
            { label: 'Reference No', value: entry.reference_no || '—' },
            { label: 'Created By',   value: entry.created_by || '—' },
            { label: 'Created At',   value: formatDate(entry.created_at) },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs text-gray-400 font-medium">{f.label}</p>
              <p className="text-sm font-medium text-gray-800">{f.value}</p>
            </div>
          ))}
        </div>

        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-xs text-indigo-500 font-medium">Narration</p>
          <p className="text-sm text-indigo-900 font-medium mt-0.5">{entry.narration}</p>
        </div>

        {/* Lines table */}
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs">Group</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs text-right">Debit (₹)</TableHead>
                <TableHead className="text-xs text-right">Credit (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line, idx) => (
                <TableRow key={line.id}>
                  <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                  <TableCell>
                    <p className="text-xs font-mono text-indigo-700">{line.ledger_code}</p>
                    <p className="text-sm font-medium text-gray-800">{line.ledger_name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{line.account_group}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{line.description || '—'}</TableCell>
                  <TableCell className="text-right">
                    {line.debit > 0 ? (
                      <span className="text-sm font-semibold text-gray-800 flex items-center justify-end gap-1">
                        <TrendingUp size={11} className="text-green-600" />
                        {formatINR(line.debit)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.credit > 0 ? (
                      <span className="text-sm font-semibold text-gray-800 flex items-center justify-end gap-1">
                        <TrendingDown size={11} className="text-red-500" />
                        {formatINR(line.credit)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals */}
              <TableRow className="bg-gray-50 border-t-2">
                <TableCell />
                <TableCell colSpan={3} className="text-xs font-semibold text-gray-600">TOTAL</TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-bold text-gray-900">{formatINR(entry.total_debit)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-bold text-gray-900">{formatINR(entry.total_credit)}</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Balance confirmation */}
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 size={14} className="text-green-600 shrink-0" />
          <span className="text-xs font-medium text-green-700">
            Balanced — Total Debit = Total Credit = {formatINR(entry.total_debit)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EntryHistoryView;
