import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Package, CheckCircle2 } from 'lucide-react';
import { usePRSummaryFields, usePRItemFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, PRItem } from './types';
import { formatDate, formatINR, getPRDisplayNo, getPRItems, prToFieldRecord } from './helpers';

interface PRDetailsTabProps {
  selectedPR: PRRecord;
  onSaveQtyChange: (item: PRItem, newQty: number) => Promise<void>;
}

const PRDetailsTab: React.FC<PRDetailsTabProps> = ({ selectedPR, onSaveQtyChange }) => {
  const summaryFields = usePRSummaryFields();
  const itemFields = usePRItemFields();
  const [editingQty, setEditingQty] = useState<{ idx: number; value: number } | null>(null);

  const viewSummaryFields = summaryFields.filter(f => f.view);
  const viewItemFields = itemFields.filter(f => f.view);
  const prRecord = prToFieldRecord(selectedPR);
  const items = getPRItems(selectedPR);

  const renderFieldValue = (field: typeof viewSummaryFields[0], value: any) => {
    if (field.type === 'date') return formatDate(value);
    return value ?? '—';
  };

  return (
    <div className="space-y-4">
      {/* PR Summary - dynamic field rendering */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText size={16} className="text-indigo-600" />
            PR Reference — {getPRDisplayNo(selectedPR)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {viewSummaryFields.map((field) => (
              <div key={field.field}>
                <p className="text-xs text-gray-500 font-medium">{field.label}</p>
                <p className="font-medium">{renderFieldValue(field, prRecord[field.field])}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PR Items - dynamic column rendering */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package size={16} className="text-orange-600" />
            PR Items
            <span className="text-xs font-normal text-gray-400">(click qty to edit)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-8">#</TableHead>
                {viewItemFields.map((field) => (
                  <TableHead
                    key={field.field}
                    className={`text-xs ${field.type === 'number' ? 'text-right' : ''} ${field.field === 'qty' ? 'text-center w-28' : ''}`}
                  >
                    {field.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                  {viewItemFields.map((field) => {
                    const rawValue = (item as any)[field.field] ?? (item as any)[field.field === 'prod_name' ? 'item_name' : ''];

                    // Editable qty column
                    if (field.field === 'qty' && field.input) {
                      return (
                        <TableCell key={field.field} className="text-center">
                          {editingQty?.idx === idx ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                value={editingQty.value}
                                onChange={(e) => setEditingQty({ idx, value: Number(e.target.value) })}
                                className="h-7 w-20 text-sm text-center"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { onSaveQtyChange(item, editingQty.value); setEditingQty(null); }
                                  if (e.key === 'Escape') setEditingQty(null);
                                }}
                              />
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => { onSaveQtyChange(item, editingQty.value); setEditingQty(null); }}>
                                <CheckCircle2 size={14} className="text-green-600" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingQty({ idx, value: Number(item.qty ?? item.quantity ?? 0) })}
                              className="text-sm font-medium text-indigo-600 hover:underline cursor-pointer"
                            >
                              {item.qty ?? item.quantity ?? 0}
                            </button>
                          )}
                        </TableCell>
                      );
                    }

                    // Currency column
                    if (field.field === 'est_cost') {
                      const cost = item.est_cost ?? item.estimated_price;
                      return (
                        <TableCell key={field.field} className="text-sm text-right font-medium">
                          {cost ? formatINR(Number(cost)) : '—'}
                        </TableCell>
                      );
                    }

                    // Default text column
                    return (
                      <TableCell key={field.field} className={`text-sm ${field.type === 'number' ? 'text-right' : ''}`}>
                        {rawValue ?? '—'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
};

export default PRDetailsTab;
