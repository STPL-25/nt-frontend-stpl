import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileText, Package, Scissors, CheckCircle2,
  Building2, Calendar, Loader2, Info, CheckSquare, X,
} from 'lucide-react';
import { useAppSelector } from '@/globalState/hooks/useAppState';
import { selectCompanyHierarchy } from '@/globalState/features/hierarchyCompanyDetailsSlice';
import type { Company, Division, Branch } from '@/globalState/features/hierarchyCompanyDetailsSlice';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import type { PRRecord, POConfirmItem, POConfirmationData } from './types';
import { getPRDisplayNo, getPRItems, formatDate, formatINR, today } from './helpers';
import { Provider } from 'react-redux';

interface POConfirmStepProps {
  selectedPR: PRRecord;
  onConfirmed: (data: POConfirmationData) => void;
  onSplitGroupCreated?: (groupNo: number, items: POConfirmItem[]) => Promise<void>;
  saving: boolean;
  confirmedData?: POConfirmationData | null;
  onEditConfirm?: () => void;
}

// ── Row id counter ────────────────────────────────────────────────────────────
let rowCounter = 0;
const nextRowId = () => `row-${++rowCounter}`;

// ── Split group colour palette ────────────────────────────────────────────────
const GROUP_COLORS = [
  { bg: 'bg-primary/10',  text: 'text-primary',  border: 'border-primary/20',  badge: 'bg-primary'  },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  badge: 'bg-orange-500'  },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  badge: 'bg-purple-600'  },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    badge: 'bg-pink-500'    },
];
const gc = (g: number) => GROUP_COLORS[(g - 1) % GROUP_COLORS.length];

// ── Component ─────────────────────────────────────────────────────────────────
const POConfirmStep: React.FC<POConfirmStepProps> = ({
  selectedPR,
  onConfirmed,
  onSplitGroupCreated,
  saving,
  confirmedData,
  onEditConfirm,
}) => {
  const hierarchy = useAppSelector(selectCompanyHierarchy);
  const companies = useMemo<Company[]>(() => hierarchy?.companies ?? [], [hierarchy]);
  const { options: masterOptions } = useMasterOptions(['DeptMaster']);

  // ── Billing org (optional override) + required date ───────────────────────
  const [globalComSno, setGlobalComSno] = useState<string>(String(selectedPR.com_sno ?? ''));
  const [globalDivSno, setGlobalDivSno] = useState<string>(String(selectedPR.div_sno ?? ''));
  const [globalBrnSno, setGlobalBrnSno] = useState<string>(String(selectedPR.brn_sno ?? ''));
  const [globalDeptSno, setGlobalDeptSno] = useState<string>(String(selectedPR.dept_sno ?? ''));
  const [requiredDate, setRequiredDate] = useState<string>(
    selectedPR.required_date ?? selectedPR.req_by_date ?? today()
  );

  const globalDivisions = useMemo<Division[]>(() => {
    if (!globalComSno) return companies.flatMap((c: Company) => c.divisions ?? []);
    return companies.find((c: Company) => String(c.com_sno) === globalComSno)?.divisions ?? [];
  }, [companies, globalComSno]);

  const globalBranches = useMemo<Branch[]>(() => {
    if (!globalDivSno) return globalDivisions.flatMap((d: Division) => d.branches ?? []);
    return globalDivisions.find((d: Division) => String(d.div_sno) === globalDivSno)?.branches ?? [];
  }, [globalDivisions, globalDivSno]);

  const deptOptions = useMemo(() => {
    if (!masterOptions?.DeptMaster || !globalBrnSno) return [];
    return (masterOptions.DeptMaster as any[]).filter(
      (d: any) => d.brn_sno != null && String(d.brn_sno) === String(globalBrnSno)
    );
  }, [masterOptions?.DeptMaster, globalBrnSno]);

  // ── Item rows ─────────────────────────────────────────────────────────────
  const prItems = getPRItems(selectedPR);
  const [rows, setRows] = useState<POConfirmItem[]>(() =>
    prItems.map(item => ({
      id: nextRowId(),
      pr_item_sno: item.pr_item_sno,
      prod_sno: item.prod_sno,
      prod_code:item.prod_code ?? '',
      prod_name: item.prod_name ?? item.item_name ?? '',
      specification: item.specification ?? '',
      originalQty: Number(item.qty ?? item.quantity ?? 0) || 1,
      qty: Number(item.qty ?? item.quantity ?? 0) || 1,
      unit: item.unit ?? (item as any).uom_sno ?? 0,
      unit_name: item.unit_name ?? item.uom_name ?? item.uom_code ?? '',
      est_cost: item.est_cost ?? item.estimated_price,
      isSplit: false,
      split_group: undefined,
      pr_no: getPRDisplayNo(selectedPR),
    }))
  );

  // ── Multi-select + split groups ───────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [splitGroupCount, setSplitGroupCount] = useState(0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectable = rows.filter(r => !r.split_group);
    setSelectedIds(prev =>
      prev.size === selectable.length ? new Set() : new Set(selectable.map(r => r.id))
    );
  };

  const createSplitGroup = () => {
    if (selectedIds.size === 0) return;
    const newGroup = splitGroupCount + 1;
    setSplitGroupCount(newGroup);

    const groupItems = rows
      .filter(r => selectedIds.has(r.id))
      .map(r => ({ ...r, split_group: newGroup }));

    setRows(prev => prev.map(r =>
      selectedIds.has(r.id) ? { ...r, split_group: newGroup } : r
    ));
    setSelectedIds(new Set());

    onSplitGroupCreated?.(newGroup, groupItems);
  };

  const removeFromGroups = () => {
    setRows(prev => prev.map(r =>
      selectedIds.has(r.id) ? { ...r, split_group: undefined } : r
    ));
    setSelectedIds(new Set());
  };

  const removeItemFromGroup = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, split_group: undefined } : r));
  };

  // ── Derived: group numbers that have items ────────────────────────────────
  const groupNums = useMemo(() => {
    const nums = new Set<number>();
    rows.forEach(r => { if (r.split_group) nums.add(r.split_group); });
    return Array.from(nums).sort();
  }, [rows]);

  // Items still available to split (not yet assigned to a group)
  const selectableCount = useMemo(() => rows.filter(r => !r.split_group).length, [rows]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!requiredDate) return;
    const confirmData: POConfirmationData = {
      pr_basic_sno: selectedPR.pr_basic_sno!,
      required_date: requiredDate,
      billing_com_sno: globalComSno || selectedPR.com_sno,
      billing_div_sno: globalDivSno || selectedPR.div_sno || undefined,
      billing_brn_sno: globalBrnSno || selectedPR.brn_sno || undefined,
      billing_dept_sno: globalDeptSno || selectedPR.dept_sno || undefined,
      items: rows,
    };
    onConfirmed(confirmData);
  };

  const prNo = getPRDisplayNo(selectedPR);
  const canSave = !!requiredDate && !saving;
  const selectedHaveGroup = rows.some(r => selectedIds.has(r.id) && r.split_group);

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIRMED READ-ONLY VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (confirmedData) {
    const comName = confirmedData.billing_com_sno
      ? (companies.find((c: any) => String(c.com_sno) === String(confirmedData.billing_com_sno))?.com_name ?? String(confirmedData.billing_com_sno))
      : (selectedPR.com_name ?? '—');
    const divName = confirmedData.billing_div_sno
      ? (companies.flatMap((c: any) => c.divisions ?? []).find((d: any) => String(d.div_sno) === String(confirmedData.billing_div_sno))?.div_name ?? String(confirmedData.billing_div_sno))
      : (selectedPR.div_name ?? '—');

    const confirmedGroups = Array.from(
      new Set(confirmedData.items.map(i => i.split_group).filter(Boolean))
    ).sort() as number[];

    return (
      <div className="space-y-3">
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-700">
                <CheckCircle2 size={16} />
                PO Details Confirmed — {prNo}
              </CardTitle>
              {onEditConfirm && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEditConfirm}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* PR submitted details */}
            {(selectedPR.com_name || selectedPR.div_name) && (
              <div className="bg-muted/40 border border-border rounded p-2 mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-1.5">PR Submitted Details</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {selectedPR.com_name && <span><span className="text-muted-foreground/70">Company: </span>{selectedPR.com_name}</span>}
                  {selectedPR.div_name && <span><span className="text-muted-foreground/70">Division: </span>{selectedPR.div_name}</span>}
                  {selectedPR.brn_name && <span><span className="text-muted-foreground/70">Branch: </span>{selectedPR.brn_name}</span>}
                  {selectedPR.dept_name && <span><span className="text-muted-foreground/70">Dept: </span>{selectedPR.dept_name}</span>}
                  {(selectedPR.required_date ?? selectedPR.req_by_date) && (
                    <span><span className="text-muted-foreground/70">Req. Date: </span>{formatDate(selectedPR.required_date ?? selectedPR.req_by_date)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Confirmed billing org + date */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
              <div><p className="text-xs text-muted-foreground">Billing Company</p><p className="font-medium">{comName}</p></div>
              <div><p className="text-xs text-muted-foreground">Billing Division</p><p className="font-medium">{divName}</p></div>
              <div><p className="text-xs text-muted-foreground">Required Date</p><p className="font-medium">{formatDate(confirmedData.required_date)}</p></div>
            </div>

            {/* Split groups summary */}
            {confirmedGroups.length > 0 && (
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Split Groups → Separate POs</p>
                {confirmedGroups.map(g => {
                  const col = gc(g);
                  const gItems = confirmedData.items.filter(i => i.split_group === g);
                  return (
                    <div key={g} className={`flex items-center gap-2 rounded px-2.5 py-1.5 border text-xs ${col.bg} ${col.border}`}>
                      <Badge className={`${col.badge} text-white border-none text-[10px] shrink-0`}>
                        {prNo}/Group {g}
                      </Badge>
                      <span className={`${col.text} font-medium truncate flex-1`}>
                        {gItems.map(i => i.prod_name).join(' • ')}
                      </span>
                      <span className="text-muted-foreground shrink-0">{gItems.length} item(s)</span>
                    </div>
                  );
                })}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs w-20 text-center">Qty</TableHead>
                  <TableHead className="text-xs w-16 text-center">UOM</TableHead>
                  {confirmedGroups.length > 0 && <TableHead className="text-xs w-28 text-center">Split Group</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmedData.items.map((row, idx) => {
                  const col = row.split_group ? gc(row.split_group) : null;
                  return (
                    <TableRow key={row.id} className={col ? `${col.bg}/40` : ''}>
                      <TableCell className="text-xs text-muted-foreground/70 pl-3">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{row.prod_name}</div>
                        {/* {row.specification && <div className="text-[11px] text-muted-foreground/70">{row.specification}</div>} */}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">{row.qty}</TableCell>
                      <TableCell className="text-center text-xs">{row.unit_name}</TableCell>
                      {confirmedGroups.length > 0 && (
                        <TableCell className="text-center">
                          {row.split_group && col
                            ? <Badge className={`${col.badge} text-white border-none text-[10px]`}>Group {row.split_group}</Badge>
                            : <span className="text-xs text-muted-foreground/70">—</span>
                          }
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EDIT / ENTRY VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Info banner */}
      {/* <Card>
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded p-3">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-0.5">Step 1 — Confirm PO Details</p>
              <p className="text-muted-foreground">
                Review PR details, adjust quantities, split items into separate POs if needed, then save.
                Supplier selection &amp; quotation unlock after saving.
              </p>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* PR Reference + optional billing org */}
      <Card>
        <CardHeader className="">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            PR Reference — {prNo}
           
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* PR submitted values — read-only */}
          <div className="bg-muted/40 border border-border rounded-lg p-3">
           
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground/70">Company</p>
                <p className="text-xs font-medium text-foreground">{selectedPR.com_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/70">Division</p>
                <p className="text-xs font-medium text-foreground">{selectedPR.div_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/70">Branch</p>
                <p className="text-xs font-medium text-foreground">{selectedPR.brn_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/70">Required Date</p>
                <p className="text-xs font-medium text-foreground">
                  {formatDate(selectedPR.required_date ?? selectedPR.req_by_date)}
                </p>
              </div>
            </div>
            {(selectedPR.dept_name || selectedPR.purpose || selectedPR.priority_name) && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 pt-2 border-t border-border">
                {selectedPR.dept_name && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/70">Department</p>
                    <p className="text-xs font-medium text-foreground">{selectedPR.dept_name}</p>
                  </div>
                )}
                {selectedPR.priority_name && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/70">Priority</p>
                    <p className="text-xs font-medium text-foreground">{selectedPR.priority_name}</p>
                  </div>
                )}
                {selectedPR.purpose && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/70">Purpose</p>
                    <p className="text-xs font-medium text-foreground truncate">{selectedPR.purpose}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Billing org — optional override */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-blue-700">
              <Building2 size={14} />
              Billing Organisation &amp; Required Date
              <span className="text-[10px] font-normal text-blue-400 ml-1">
                (optional — leave as-is to use PR values)
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Company</label>
                <Select
                  value={globalComSno}
                  onValueChange={v => { setGlobalComSno(v); setGlobalDivSno(''); setGlobalBrnSno(''); setGlobalDeptSno(''); }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Same as PR" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.com_sno} value={String(c.com_sno)}>{c.com_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Division</label>
                <Select
                  value={globalDivSno}
                  onValueChange={v => { setGlobalDivSno(v); setGlobalBrnSno(''); setGlobalDeptSno(''); }}
                  disabled={!globalComSno}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Same as PR" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalDivisions.map(d => (
                      <SelectItem key={d.div_sno} value={String(d.div_sno)}>{d.div_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Branch</label>
                <Select
                  value={globalBrnSno}
                  onValueChange={v => { setGlobalBrnSno(v); setGlobalDeptSno(''); }}
                  disabled={!globalDivSno}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Same as PR" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalBranches.map(b => (
                      <SelectItem key={b.brn_sno} value={String(b.brn_sno)}>{b.brn_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Department</label>
                <Select
                  value={globalDeptSno}
                  onValueChange={v => setGlobalDeptSno(v)}
                  disabled={!globalBrnSno}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Same as PR" />
                  </SelectTrigger>
                  <SelectContent>
                    {deptOptions.map((d: any) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">
                  <Calendar size={11} className="inline mr-1" />
                  Required Date *
                </label>
                <Input
                  type="date"
                  value={requiredDate}
                  onChange={e => setRequiredDate(e.target.value)}
                  className="h-8 text-xs"
                  min={today()}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items table with multi-select & split groups */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package size={16} className="text-orange-600" />
                Items — Confirm Quantities
                {groupNums.length > 0 && (
                  <Badge className="text-xs bg-primary/15 text-primary border-primary/20 ml-1">
                    {groupNums.length} split group(s)
                  </Badge>
                )}
              </CardTitle>
             
            </div>

            {/* Bulk split toolbar (visible when items are checked) */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 flex-wrap">
                <CheckSquare size={14} className="text-primary shrink-0" />
                <span className="text-xs font-medium text-primary">
                  {selectedIds.size} item(s) selected
                </span>
                <span className="text-muted-foreground/50">|</span>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-primary hover:bg-primary/90"
                  onClick={createSplitGroup}
                >
                  <Scissors size={12} className="mr-1" />
                  Create Split Group {splitGroupCount + 1}
                </Button>
                {selectedHaveGroup && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
                    onClick={removeFromGroups}
                  >
                    <X size={12} className="mr-1" /> Remove from Group
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Split groups summary (when no selection active) */}
          {groupNums.length > 0 && selectedIds.size === 0 && (
            <div className="mt-3 space-y-1.5">
              {groupNums.map(g => {
                const col = gc(g);
                const gItems = rows.filter(r => r.split_group === g);
                return (
                  <div
                    key={g}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border text-xs ${col.bg} ${col.border}`}
                  >
                    <Badge className={`${col.badge} text-white border-none text-[10px] shrink-0`}>
                      {prNo} / Group {g}
                    </Badge>
                    <span className={`${col.text} font-medium flex-1 truncate`}>
                      {gItems.map(i => i.prod_name).join(' • ')}
                    </span>
                    <span className="text-muted-foreground shrink-0">{gItems.length} item(s) → separate PO</span>
                  </div>
                );
              })}
              {rows.some(r => !r.split_group) && (
                <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border text-xs bg-muted/40 border-border">
                  <Badge className="bg-muted/400 text-white border-none text-[10px] shrink-0">Main PO</Badge>
                  <span className="text-muted-foreground font-medium flex-1 truncate">
                    {rows.filter(r => !r.split_group).map(i => i.prod_name).join(' • ')}
                  </span>
                  <span className="text-muted-foreground/70 shrink-0">{rows.filter(r => !r.split_group).length} item(s)</span>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    checked={selectableCount > 0 && selectedIds.size === selectableCount}
                    disabled={selectableCount === 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all items"
                  />
                </TableHead>
                <TableHead className="text-xs w-8">#</TableHead>
                     <TableHead className="text-xs min-w-[160px]">Product Code</TableHead>

                <TableHead className="text-xs min-w-[160px]">Item</TableHead>
                <TableHead className="text-xs w-28 text-center">Qty</TableHead>
                <TableHead className="text-xs w-16 text-center">UOM</TableHead>
                {groupNums.length > 0 && (
                  <TableHead className="text-xs w-28 text-center">Split Group</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => {
                const isChecked = selectedIds.has(row.id);
                const isGrouped = !!row.split_group;
                const col = row.split_group ? gc(row.split_group) : null;
                return (
                  <TableRow
                    key={row.id}
                    className={`select-none ${isGrouped ? 'cursor-default' : 'cursor-pointer'} ${
                      isChecked ? 'bg-primary/10/70' : col ? `${col.bg}/30` : ''
                    }`}
                    onClick={() => { if (!isGrouped) toggleSelect(row.id); }}
                  >
                    {/* Checkbox — disabled once the item belongs to a split group */}
                    <TableCell className="pl-3 py-2" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        disabled={isGrouped}
                        onCheckedChange={() => { if (!isGrouped) toggleSelect(row.id); }}
                        aria-label={`Select ${row.prod_name}`}
                      />
                    </TableCell>

                    {/* # */}
                      <TableCell className="text-xs text-muted-foreground/70 pl-3">{idx + 1}</TableCell>

                    {/* Item */}
                      <TableCell className="text-sm font-medium leading-tight">{row.prod_code}</TableCell>

                    <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                      <div className="text-sm font-medium leading-tight">{row.prod_name || '—'}</div>
                      {/* {row.specification && (
                        <div className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">
                          {row.specification}
                        </div>
                      )} */}
                      {/* {row.est_cost && (
                        <div className="text-[11px] text-muted-foreground/70">
                          Est: {formatINR(Number(row.est_cost))}
                        </div>
                      )} */}
                    </TableCell>

                    {/* Qty (read-only) */}
                    <TableCell className="text-center py-2">
                      <div className="text-sm font-medium">{row.qty}</div>
                    </TableCell>

                    {/* UOM */}
                    <TableCell className="text-center text-xs py-2">{row.unit_name || '—'}</TableCell>

                    {/* Split group badge */}
                    {groupNums.length > 0 && (
                      <TableCell className="text-center py-2" onClick={e => e.stopPropagation()}>
                        {row.split_group && col ? (
                          <div className="flex items-center justify-center gap-1">
                            <Badge className={`${col.badge} text-white border-none text-[10px]`}>
                              Group {row.split_group}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-red-500"
                              title="Remove from group"
                              onClick={() => removeItemFromGroup(row.id)}
                            >
                              <X size={10} />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/70">Main PO</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Save action */}
      <div className="flex items-center justify-end gap-3">
        {!requiredDate && (
          <p className="text-xs text-amber-600">Required date is mandatory</p>
        )}
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="bg-primary hover:bg-primary/90"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 size={16} className="mr-2" />
              Confirm &amp; Save — Proceed to Quotation
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default POConfirmStep;
