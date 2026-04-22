import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  BookOpen, Plus, Trash2, Send, RotateCcw, CheckCircle2, AlertCircle,
  ChevronsUpDown, Pencil, FileText,
} from 'lucide-react';
import type { JournalEntry, EntryLine, DoubleEntryFormState } from './types';
import { VOUCHER_TYPES, makeBlankLine } from './types';
import {
  MOCK_LEDGERS, formatINR, formatDate, today, generateEntryNo,
  isBalanced, getDifference,
} from './helpers';

interface DoubleEntryFormProps {
  selectedEntry: JournalEntry | null;
  isNewEntry: boolean;
  onSave: (form: DoubleEntryFormState, lines: EntryLine[], status: 'Draft' | 'Posted') => void;
  onCancel: () => void;
  saving: boolean;
}

// ── Account Selector Combobox ─────────────────────────────────────────────────

const AccountSelector: React.FC<{
  value: string;
  onChange: (ledgerCode: string, ledgerName: string, accountGroup: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_LEDGERS.filter(
      l => !q || l.ledger_code.toLowerCase().includes(q) || l.ledger_name.toLowerCase().includes(q) || l.account_group.toLowerCase().includes(q)
    );
  }, [search]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof MOCK_LEDGERS>();
    filtered.forEach(l => {
      if (!map.has(l.account_group)) map.set(l.account_group, []);
      map.get(l.account_group)!.push(l);
    });
    return map;
  }, [filtered]);

  const selected = MOCK_LEDGERS.find(l => l.ledger_code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between h-8 text-xs font-normal"
        >
          <span className="truncate">
            {selected ? `${selected.ledger_code} — ${selected.ledger_name}` : 'Select account...'}
          </span>
          <ChevronsUpDown size={12} className="ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search by code or name..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-56">
            <CommandEmpty>No accounts found.</CommandEmpty>
            {Array.from(groups.entries()).map(([group, ledgers]) => (
              <CommandGroup key={group} heading={group}>
                {ledgers.map(l => (
                  <CommandItem
                    key={l.ledger_code}
                    value={`${l.ledger_code} ${l.ledger_name}`}
                    onSelect={() => {
                      onChange(l.ledger_code, l.ledger_name, l.account_group);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="text-xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <span className="font-mono text-indigo-700 mr-1.5">{l.ledger_code}</span>
                        <span>{l.ledger_name}</span>
                      </div>
                      <span className={`text-xs ${l.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatINR(l.current_balance)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ── Main Form ─────────────────────────────────────────────────────────────────

const DoubleEntryForm: React.FC<DoubleEntryFormProps> = ({
  selectedEntry, isNewEntry, onSave, onCancel, saving,
}) => {
  const [form, setForm] = useState<DoubleEntryFormState>({
    entry_date: today(),
    voucher_type: 'Journal',
    reference_no: '',
    narration: '',
  });
  const [lines, setLines] = useState<EntryLine[]>([makeBlankLine(), makeBlankLine()]);
  const [entryNo, setEntryNo] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const setFormField = (field: keyof DoubleEntryFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // Populate from selected entry or reset for new
  useEffect(() => {
    if (isNewEntry) {
      const vt = 'Journal';
      setForm({ entry_date: today(), voucher_type: vt, reference_no: '', narration: '' });
      setLines([makeBlankLine(), makeBlankLine()]);
      setEntryNo(generateEntryNo(vt));
      setIsEditing(true);
    } else if (selectedEntry) {
      setForm({
        entry_date: selectedEntry.entry_date,
        voucher_type: selectedEntry.voucher_type,
        reference_no: selectedEntry.reference_no ?? '',
        narration: selectedEntry.narration,
      });
      setLines(selectedEntry.lines.map(l => ({ ...l })));
      setEntryNo(selectedEntry.entry_no);
      setIsEditing(false);
    }
  }, [selectedEntry, isNewEntry]);

  // Regenerate entry no when voucher type changes (only for new entries)
  useEffect(() => {
    if (isNewEntry) setEntryNo(generateEntryNo(form.voucher_type));
  }, [form.voucher_type, isNewEntry]);

  // ── Line operations ──────────────────────────────────────────────────────────

  const addLine = () => setLines(prev => [...prev, makeBlankLine()]);

  const removeLine = useCallback((id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  }, []);

  const updateLine = useCallback((id: string, patch: Partial<EntryLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const setDebit = useCallback((id: string, value: number) => {
    setLines(prev => prev.map(l =>
      l.id === id ? { ...l, debit: value, credit: value > 0 ? 0 : l.credit } : l
    ));
  }, []);

  const setCredit = useCallback((id: string, value: number) => {
    setLines(prev => prev.map(l =>
      l.id === id ? { ...l, credit: value, debit: value > 0 ? 0 : l.debit } : l
    ));
  }, []);

  // ── Derived totals ──────────────────────────────────────────────────────────

  const totalDebit  = useMemo(() => lines.reduce((s, l) => s + (l.debit || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (l.credit || 0), 0), [lines]);
  const balanced = isBalanced(totalDebit, totalCredit);
  const difference = getDifference(totalDebit, totalCredit);
  const canEdit = isEditing || isNewEntry;

  const handleSave = (status: 'Draft' | 'Posted') => {
    onSave(form, lines, status);
  };

  const voucherBadgeColor: Record<string, string> = {
    Journal:  'bg-indigo-100 text-indigo-700',
    Payment:  'bg-red-100 text-red-700',
    Receipt:  'bg-green-100 text-green-700',
    Contra:   'bg-purple-100 text-purple-700',
    Sales:    'bg-amber-100 text-amber-700',
    Purchase: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-4">
      {/* Entry Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen size={15} className="text-indigo-600" />
              {isNewEntry ? 'New Journal Entry' : `Entry — ${entryNo}`}
              {!isNewEntry && selectedEntry && (
                <Badge className={`text-xs ml-1 ${voucherBadgeColor[selectedEntry.voucher_type] ?? ''}`}>
                  {selectedEntry.voucher_type}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isNewEntry && selectedEntry && !isEditing && selectedEntry.status !== 'Posted' && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(true)}>
                  <Pencil size={12} className="mr-1" /> Edit
                </Button>
              )}
              {selectedEntry?.status === 'Posted' && (
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 size={11} className="mr-1" /> Posted
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entry number display */}
          <div className="flex items-center gap-3 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
            <FileText size={14} className="text-indigo-600 shrink-0" />
            <div>
              <p className="text-xs text-indigo-500 font-medium">Entry Number</p>
              <p className="text-sm font-bold text-indigo-800 font-mono">{entryNo || '—'}</p>
            </div>
            {!isNewEntry && selectedEntry && (
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400">Posted on</p>
                <p className="text-xs font-medium text-gray-700">{formatDate(selectedEntry.posted_at)}</p>
              </div>
            )}
          </div>

          {/* Header Fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Entry Date *</Label>
              <Input
                type="date"
                value={form.entry_date}
                onChange={e => setFormField('entry_date', e.target.value)}
                className="h-8 text-sm"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Voucher Type *</Label>
              <Select value={form.voucher_type} onValueChange={v => setFormField('voucher_type', v)} disabled={!canEdit}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOUCHER_TYPES.map(vt => (
                    <SelectItem key={vt} value={vt} className="text-sm">{vt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-gray-600">Reference No.</Label>
              <Input
                value={form.reference_no}
                onChange={e => setFormField('reference_no', e.target.value)}
                placeholder="Invoice / Cheque / PO reference"
                className="h-8 text-sm"
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Narration *</Label>
            <Textarea
              rows={2}
              value={form.narration}
              onChange={e => setFormField('narration', e.target.value)}
              placeholder="Brief description of the transaction..."
              className="text-sm"
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Entry Lines Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen size={14} className="text-indigo-600" />
              Debit / Credit Lines
              <Badge variant="outline" className="text-xs ml-1">{lines.length} lines</Badge>
            </CardTitle>
            {canEdit && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addLine}>
                <Plus size={12} className="mr-1" /> Add Line
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs min-w-[260px]">Account</TableHead>
                  <TableHead className="text-xs">Group</TableHead>
                  <TableHead className="text-xs min-w-[160px]">Description</TableHead>
                  <TableHead className="text-xs text-right w-32">Debit (₹)</TableHead>
                  <TableHead className="text-xs text-right w-32">Credit (₹)</TableHead>
                  {canEdit && <TableHead className="text-xs w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={line.id} className="align-middle">
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>

                    {/* Account selector */}
                    <TableCell>
                      {canEdit ? (
                        <AccountSelector
                          value={line.ledger_code}
                          disabled={!canEdit}
                          onChange={(code, name, group) =>
                            updateLine(line.id, { ledger_code: code, ledger_name: name, account_group: group })
                          }
                        />
                      ) : (
                        <div>
                          <p className="text-xs font-mono text-indigo-700">{line.ledger_code}</p>
                          <p className="text-sm font-medium text-gray-800">{line.ledger_name}</p>
                        </div>
                      )}
                    </TableCell>

                    {/* Group */}
                    <TableCell>
                      {line.account_group ? (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">{line.account_group}</Badge>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>

                    {/* Description */}
                    <TableCell>
                      {canEdit ? (
                        <Input
                          value={line.description}
                          onChange={e => updateLine(line.id, { description: e.target.value })}
                          placeholder="Line narration"
                          className="h-7 text-xs"
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{line.description || '—'}</span>
                      )}
                    </TableCell>

                    {/* Debit */}
                    <TableCell className="text-right">
                      {canEdit ? (
                        <Input
                          type="number" min={0} step={0.01}
                          value={line.debit || ''}
                          onChange={e => setDebit(line.id, Number(e.target.value))}
                          placeholder="0.00"
                          className="h-7 text-sm text-right w-28 ml-auto"
                        />
                      ) : (
                        <span className={`text-sm font-semibold ${line.debit > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                          {line.debit > 0 ? formatINR(line.debit) : '—'}
                        </span>
                      )}
                    </TableCell>

                    {/* Credit */}
                    <TableCell className="text-right">
                      {canEdit ? (
                        <Input
                          type="number" min={0} step={0.01}
                          value={line.credit || ''}
                          onChange={e => setCredit(line.id, Number(e.target.value))}
                          placeholder="0.00"
                          className="h-7 text-sm text-right w-28 ml-auto"
                        />
                      ) : (
                        <span className={`text-sm font-semibold ${line.credit > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                          {line.credit > 0 ? formatINR(line.credit) : '—'}
                        </span>
                      )}
                    </TableCell>

                    {/* Delete */}
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-red-500"
                          disabled={lines.length <= 2}
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {/* Totals Row */}
                <TableRow className="bg-gray-50 font-semibold border-t-2">
                  <TableCell />
                  <TableCell className="text-xs text-gray-600 font-semibold" colSpan={3}>
                    TOTAL
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-bold text-gray-900">{formatINR(totalDebit)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-bold text-gray-900">{formatINR(totalCredit)}</span>
                  </TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Balance indicator */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            balanced
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {balanced ? (
                <>
                  <CheckCircle2 size={15} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-700">Entry is balanced</span>
                  <span className="text-xs text-green-600">Debit = Credit = {formatINR(totalDebit)}</span>
                </>
              ) : (
                <>
                  <AlertCircle size={15} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-700">Entry is not balanced</span>
                  <span className="text-xs text-red-600">
                    Difference: {formatINR(difference)} &nbsp;
                    ({totalDebit > totalCredit ? 'Debit exceeds Credit' : 'Credit exceeds Debit'})
                  </span>
                </>
              )}
            </div>

            {/* Action buttons */}
            {canEdit && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={onCancel}>
                  <RotateCcw size={12} className="mr-1" /> Cancel
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  disabled={saving || lines.every(l => !l.ledger_code) || !form.narration}
                  onClick={() => handleSave('Draft')}
                >
                  Save as Draft
                </Button>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs"
                  disabled={saving || !balanced || !form.entry_date || !form.narration || totalDebit === 0}
                  onClick={() => handleSave('Posted')}
                >
                  <Send size={12} className="mr-1" />
                  {saving ? 'Posting…' : 'Post Entry'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DoubleEntryForm;
