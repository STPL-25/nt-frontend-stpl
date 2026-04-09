import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Scissors, Plus, Trash2, Package, ArrowRight, Info, Search, Loader2 } from 'lucide-react';
import { useSplitItemFields, useVendorFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, Vendor, POGroup, POGroupItem } from './types';
import { getPRDisplayNo, getPRItems, formatINR } from './helpers';

interface SplitPRTabProps {
  selectedPR: PRRecord;
  vendors: Vendor[];
  loadingVendors: boolean;
  /** Callback: user finalized the split groups, ready for quotations */
  onSplitConfirmed: (groups: POGroup[]) => void;
}

let groupCounter = 0;
const nextGroupId = () => `split-${++groupCounter}`;

const SplitPRTab: React.FC<SplitPRTabProps> = ({
  selectedPR, vendors, loadingVendors, onSplitConfirmed,
}) => {
  const splitItemFields = useSplitItemFields();
  const vendorFields = useVendorFields();
  const viewFields = splitItemFields.filter(f => f.view);
  const viewVendorFields = vendorFields.filter(f => f.view);

  const items = getPRItems(selectedPR);
  const prNo = getPRDisplayNo(selectedPR);

  // Groups: each group gets a subset of items and an assigned vendor
  const [groups, setGroups] = useState<POGroup[]>([]);
  // item index → { groupId, qty }
  const [itemAssignment, setItemAssignment] = useState<Record<number, { groupId: string; qty: number }>>({});
  const [searchVendor, setSearchVendor] = useState('');
  const [assigningVendorGroup, setAssigningVendorGroup] = useState<string | null>(null);

  const filteredVendors = useMemo(() => {
    const q = searchVendor.toLowerCase();
    return vendors.filter(v =>
      !q ||
      (v.company_name ?? v.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.contact_person ?? '').toLowerCase().includes(q) ||
      (v.gst_no ?? '').toLowerCase().includes(q)
    );
  }, [vendors, searchVendor]);

  // ── Group CRUD ─────────────────────────────────────────────────────────────

  const addGroup = () => {
    const id = nextGroupId();
    const label = `Split ${groups.length + 1}`;
    setGroups(prev => [...prev, {
      id, label, items: [],
      sourcePRs: [selectedPR.pr_basic_sno!],
    }]);
  };

  const removeGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    // unassign any items in this group
    setItemAssignment(prev => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(next)) {
        if (val.groupId === groupId) delete next[Number(key)];
      }
      return next;
    });
  };

  const assignVendorToGroup = (groupId: string, vendor: Vendor) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, vendorSno: vendor.kyc_basic_info_sno ?? vendor.vendor_sno, vendorName: vendor.company_name ?? vendor.vendor_name }
        : g
    ));
    setAssigningVendorGroup(null);
    setSearchVendor('');
  };

  const assignItem = (itemIdx: number, groupId: string | null, qty?: number) => {
    setItemAssignment(prev => {
      const next = { ...prev };
      if (!groupId) {
        delete next[itemIdx];
      } else {
        const item = items[itemIdx];
        const originalQty = Number(
          item?.qty ?? item?.quantity ?? (item as any)?.req_qty ?? 0
        ) || 1; // default to 1 if qty is 0 or missing
        next[itemIdx] = { groupId, qty: qty ?? next[itemIdx]?.qty ?? originalQty };
      }
      return next;
    });
  };

  const updateAssignedQty = (itemIdx: number, qty: number) => {
    setItemAssignment(prev => {
      if (!prev[itemIdx]) return prev;
      return { ...prev, [itemIdx]: { ...prev[itemIdx], qty } };
    });
  };

  // ── Build final groups for confirmation ────────────────────────────────────

  const builtGroups = useMemo((): POGroup[] => {
    return groups.map(g => {
      const groupItems: POGroupItem[] = [];
      items.forEach((item, idx) => {
        const assignment = itemAssignment[idx];
        if (assignment?.groupId !== g.id) return;
        groupItems.push({
          pr_basic_sno: selectedPR.pr_basic_sno!,
          pr_no: prNo,
          pr_item_sno: item.pr_item_sno,
          prod_sno: item.prod_sno,
          prod_name: item.prod_name ?? item.item_name ?? '',
          specification: item.specification ?? '',
          qty: assignment.qty,
          originalQty: Number(item.qty ?? item.quantity ?? (item as any).req_qty ?? 0) || 1,
          unit: item.unit ?? (item as any).uom_sno ?? (item as any).unit_sno ?? 0,
          unit_name: item.unit_name ?? item.uom_name ?? item.uom_code ?? '',
          est_cost: item.est_cost ?? item.estimated_price,
        });
      });
      return { ...g, items: groupItems };
    });
  }, [groups, itemAssignment, items, selectedPR, prNo]);

  const allItemsAssigned = items.every((_, idx) => itemAssignment[idx]);
  const anyGroupHasVendor = builtGroups.some(g => g.vendorSno && g.items.length > 0);

  const handleConfirm = () => {
    const validGroups = builtGroups.filter(g => g.items.length > 0);
    if (validGroups.length === 0) return;
    onSplitConfirmed(validGroups);
  };

  // ── Helper: get vendor field display value ─────────────────────────────────
  const getVendorFieldValue = (vendor: Vendor, field: string): string => {
    if (field === 'company_name') return vendor.company_name ?? vendor.vendor_name ?? '—';
    if (field === 'mobile_number') return vendor.mobile_number ?? vendor.mobile ?? vendor.phone ?? vendor.email ?? '—';
    return (vendor as any)[field] ?? '—';
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-3">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Split PR into Multiple POs</p>
              <p className="text-gray-600">
                1. Create split groups below &nbsp;2. Assign items to each group &nbsp;3. Assign a vendor to each group
                &nbsp;4. Confirm to proceed to quotations.
                Each group will become a separate PO: <strong>{prNo}/1</strong>, <strong>{prNo}/2</strong>, etc.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Scissors size={16} className="text-indigo-600" />
              Split Groups
              <Badge variant="outline" className="text-xs ml-1">{groups.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="outline" className="text-xs" onClick={addGroup}>
              <Plus size={12} className="mr-1" /> Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No groups yet. Click <strong>"Add Group"</strong> to create split groups, then assign items and vendors.
            </p>
          ) : (
            groups.map((group, gIdx) => {
              const built = builtGroups.find(bg => bg.id === group.id);
              const itemCount = built?.items.length ?? 0;
              return (
                <div key={group.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-600 text-white border-none">{prNo}/{gIdx + 1}</Badge>
                      <span className="text-sm font-medium text-gray-800">{group.label}</span>
                      <span className="text-xs text-gray-400">({itemCount} items)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.vendorSno ? (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                          {group.vendorName}
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="text-xs h-6"
                          onClick={() => setAssigningVendorGroup(assigningVendorGroup === group.id ? null : group.id)}>
                          Assign Vendor
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                        onClick={() => removeGroup(group.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Vendor assignment picker */}
                  {assigningVendorGroup === group.id && (
                    <div className="border rounded p-2 bg-gray-50 space-y-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                          placeholder="Search vendors..."
                          value={searchVendor}
                          onChange={(e) => setSearchVendor(e.target.value)}
                          className="pl-8 h-7 text-xs"
                          autoFocus
                        />
                      </div>
                      {loadingVendors ? (
                        <div className="flex items-center gap-2 text-gray-400 py-2 justify-center">
                          <Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading...</span>
                        </div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-100">
                                {viewVendorFields.map(f => (
                                  <TableHead key={f.field} className="text-[10px] py-1">{f.label}</TableHead>
                                ))}
                                <TableHead className="text-[10px] py-1 w-16"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredVendors.slice(0, 10).map(v => (
                                <TableRow key={v.kyc_basic_info_sno ?? v.vendor_sno} className="hover:bg-indigo-50 cursor-pointer"
                                  onClick={() => assignVendorToGroup(group.id, v)}>
                                  {viewVendorFields.map(f => (
                                    <TableCell key={f.field} className="text-[11px] py-1">
                                      {getVendorFieldValue(v, f.field)}
                                    </TableCell>
                                  ))}
                                  <TableCell className="py-1">
                                    <Button size="sm" variant="ghost" className="h-5 text-[10px] text-indigo-600">Select</Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Item assignment table (only show when groups exist) */}
      {groups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package size={16} className="text-orange-600" />
              Assign Items to Groups
              {allItemsAssigned && (
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200 ml-2">All assigned</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs w-8">#</TableHead>
                  {viewFields.map(f => (
                    <TableHead key={f.field} className={`text-xs ${f.field === 'qty' ? 'text-center w-28' : ''}`}>
                      {f.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const assignment = itemAssignment[idx];
                  const originalQty = Number(item.qty ?? item.quantity ?? (item as any).req_qty ?? 0) || 1;

                  return (
                    <TableRow key={idx} className={assignment ? '' : 'bg-amber-50/40'}>
                      <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                      {viewFields.map(f => {
                        if (f.field === 'prod_name') {
                          return (
                            <TableCell key={f.field} className="text-sm font-medium">
                              {item.prod_name ?? item.item_name ?? '—'}
                            </TableCell>
                          );
                        }
                        if (f.field === 'qty') {
                          return (
                            <TableCell key={f.field} className="text-center">
                              <div className="flex flex-col items-center">
                                <Input
                                  type="number"
                                  min={1}
                                  max={originalQty}
                                  value={assignment?.qty ?? originalQty}
                                  onChange={(e) => {
                                    if (assignment) updateAssignedQty(idx, Number(e.target.value));
                                  }}
                                  disabled={!assignment}
                                  className="h-7 w-20 text-sm text-center"
                                />
                                <span className="text-[10px] text-gray-400">of {originalQty}</span>
                              </div>
                            </TableCell>
                          );
                        }
                        if (f.field === 'unit_name') {
                          return <TableCell key={f.field} className="text-sm text-center">{item.unit_name ?? '—'}</TableCell>;
                        }
                        if (f.field === 'assign_to') {
                          return (
                            <TableCell key={f.field}>
                              <Select
                                value={assignment?.groupId ?? 'unassigned'}
                                onValueChange={(val) => assignItem(idx, val === 'unassigned' ? null : val)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="— Unassigned —" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">— Unassigned —</SelectItem>
                                  {groups.map((g, gIdx) => (
                                    <SelectItem key={g.id} value={g.id}>
                                      {prNo}/{gIdx + 1} {g.vendorName ? `(${g.vendorName})` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          );
                        }
                        return <TableCell key={f.field} className="text-sm">{(item as any)[f.field] ?? '—'}</TableCell>;
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Split preview & confirm */}
      {builtGroups.some(g => g.items.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Split Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {builtGroups.filter(g => g.items.length > 0).map((g, gIdx) => (
              <div key={g.id} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded p-2 text-xs">
                <Badge className="bg-indigo-600 text-white border-none shrink-0">
                  {prNo}/{gIdx + 1}
                </Badge>
                <span className="font-medium text-gray-800">
                  {g.vendorName || <span className="text-amber-600 italic">No vendor assigned</span>}
                </span>
                <span className="text-gray-500">{g.items.length} item(s)</span>
                <span className="text-gray-500 ml-auto">
                  Est: {formatINR(g.items.reduce((s, it) => s + (it.est_cost ?? 0) * it.qty, 0))}
                </span>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleConfirm}
                disabled={!anyGroupHasVendor}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <ArrowRight size={16} className="mr-1" />
                Confirm Split &amp; Proceed to Quotations
              </Button>
            </div>
            {!anyGroupHasVendor && (
              <p className="text-[11px] text-amber-600 text-right">Assign a vendor to at least one group to proceed.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SplitPRTab;
