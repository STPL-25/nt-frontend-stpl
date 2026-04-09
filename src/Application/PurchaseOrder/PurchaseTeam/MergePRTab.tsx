import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Merge, Package, AlertCircle, Info, ArrowRight, Search, Loader2 } from 'lucide-react';
import { useMergePRFields, usePRItemFields, useVendorFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, PRItem, Vendor, POGroup, POGroupItem } from './types';
import { formatDate, formatINR, getPRDisplayNo, getPRItems, getPRItemCount } from './helpers';

interface MergePRTabProps {
  prList: PRRecord[];
  mergeSelected: Set<number>;
  onToggleMerge: (prBasicSno: number) => void;
  vendors: Vendor[];
  loadingVendors: boolean;
  /** Callback: user finalized the merge group, ready for quotations */
  onMergeConfirmed: (group: POGroup) => void;
}

const MergePRTab: React.FC<MergePRTabProps> = ({
  prList, mergeSelected, onToggleMerge, vendors, loadingVendors, onMergeConfirmed,
}) => {
  const mergePRFields = useMergePRFields();
  const itemFields = usePRItemFields();
  const vendorFields = useVendorFields();
  const viewPRFields = mergePRFields.filter(f => f.view);
  const viewItemFields = itemFields.filter(f => f.view);
  const viewVendorFields = vendorFields.filter(f => f.view);

  const [itemSelection, setItemSelection] = useState<Set<string>>(new Set()); // "prBasicSno:itemIdx"
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [searchVendor, setSearchVendor] = useState('');

  // Selected PRs
  const selectedPRs = useMemo(() =>
    prList.filter(pr => pr.pr_basic_sno && mergeSelected.has(pr.pr_basic_sno)),
    [prList, mergeSelected]
  );

  // All items from selected PRs, flattened with origin
  const allMergeItems = useMemo(() => {
    const result: { prBasicSno: number; prNo: string; item: PRItem; key: string }[] = [];
    selectedPRs.forEach(pr => {
      const items = getPRItems(pr);
      items.forEach((item, idx) => {
        const key = `${pr.pr_basic_sno}:${idx}`;
        result.push({ prBasicSno: pr.pr_basic_sno!, prNo: getPRDisplayNo(pr), item, key });
      });
    });
    return result;
  }, [selectedPRs]);

  // Auto-select all items when PRs change
  React.useEffect(() => {
    setItemSelection(new Set(allMergeItems.map(m => m.key)));
  }, [allMergeItems]);

  const filteredVendors = useMemo(() => {
    const q = searchVendor.toLowerCase();
    return vendors.filter(v =>
      !q ||
      (v.company_name ?? v.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.contact_person ?? '').toLowerCase().includes(q) ||
      (v.gst_no ?? '').toLowerCase().includes(q)
    );
  }, [vendors, searchVendor]);

  const toggleItem = (key: string) => {
    setItemSelection(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAllItems = (checked: boolean) => {
    setItemSelection(checked ? new Set(allMergeItems.map(m => m.key)) : new Set());
  };

  const assignVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setShowVendorPicker(false);
    setSearchVendor('');
  };

  const handleConfirm = () => {
    if (!selectedVendor || itemSelection.size === 0 || selectedPRs.length < 2) return;

    const groupItems: POGroupItem[] = allMergeItems
      .filter(m => itemSelection.has(m.key))
      .map(m => ({
        pr_basic_sno: m.prBasicSno,
        pr_no: m.prNo,
        pr_item_sno: m.item.pr_item_sno,
        prod_sno: m.item.prod_sno,
        prod_name: m.item.prod_name ?? m.item.item_name ?? '',
        specification: m.item.specification ?? '',
        qty: Number(m.item.qty ?? m.item.quantity ?? 1),
        originalQty: Number(m.item.qty ?? m.item.quantity ?? 1),
        unit: m.item.unit ?? 0,
        unit_name: m.item.unit_name ?? 'pcs',
        est_cost: m.item.est_cost ?? m.item.estimated_price,
      }));

    const mergedPrNos = selectedPRs.map(p => getPRDisplayNo(p)).join('+');

    const group: POGroup = {
      id: `merge-${Date.now()}`,
      label: `Merged: ${mergedPrNos}`,
      vendorSno: selectedVendor.kyc_basic_info_sno ?? selectedVendor.vendor_sno,
      vendorName: selectedVendor.company_name ?? selectedVendor.vendor_name,
      items: groupItems,
      sourcePRs: selectedPRs.map(p => p.pr_basic_sno!),
    };

    onMergeConfirmed(group);
  };

  const getPRFieldValue = (pr: PRRecord, field: string): any => {
    if (field === 'item_count') return getPRItemCount(pr);
    if (field === 'request_date') return formatDate(pr.reg_date ?? pr.request_date ?? pr.req_date);
    if (field === 'pr_no') return getPRDisplayNo(pr);
    return (pr as any)[field] ?? '—';
  };

  const getVendorFieldValue = (vendor: Vendor, field: string): string => {
    if (field === 'company_name') return vendor.company_name ?? vendor.vendor_name ?? '—';
    if (field === 'mobile_number') return vendor.mobile_number ?? vendor.mobile ?? vendor.phone ?? vendor.email ?? '—';
    return (vendor as any)[field] ?? '—';
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* Info banner */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-3">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Merge Multiple PRs into a Single PO</p>
              <p className="text-gray-600">
                1. Select 2+ PRs from the sidebar (checkboxes appear in merge mode)
                &nbsp;2. Choose which items to include
                &nbsp;3. Assign a vendor
                &nbsp;4. Confirm to proceed to quotations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected PRs table */}
      {selectedPRs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Merge size={16} className="text-purple-600" />
              Selected PRs for Merge
              <Badge variant="outline" className="text-xs ml-1">{selectedPRs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  {viewPRFields.map(f => (
                    <TableHead key={f.field} className={`text-xs ${f.type === 'number' ? 'text-center' : ''}`}>
                      {f.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs w-16">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPRs.map(pr => (
                  <TableRow key={pr.pr_basic_sno}>
                    {viewPRFields.map(f => (
                      <TableCell key={f.field} className={`text-xs ${f.field === 'pr_no' ? 'font-semibold text-indigo-700' : ''} ${f.type === 'number' ? 'text-center' : ''}`}>
                        {getPRFieldValue(pr, f.field)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500"
                        onClick={() => onToggleMerge(pr.pr_basic_sno!)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Combined items selection */}
      {selectedPRs.length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package size={16} className="text-orange-600" />
              Combined Items
              <Badge variant="outline" className="text-xs ml-1">{itemSelection.size} / {allMergeItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs w-8">
                    <Checkbox
                      checked={itemSelection.size === allMergeItems.length}
                      onCheckedChange={(checked) => toggleAllItems(!!checked)}
                    />
                  </TableHead>
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs">Source PR</TableHead>
                  {viewItemFields.map(f => (
                    <TableHead key={f.field} className={`text-xs ${f.type === 'number' ? 'text-right' : ''} ${f.field === 'qty' ? 'text-center' : ''}`}>
                      {f.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allMergeItems.map((m, idx) => (
                  <TableRow key={m.key} className={!itemSelection.has(m.key) ? 'opacity-40' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={itemSelection.has(m.key)}
                        onCheckedChange={() => toggleItem(m.key)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{m.prNo}</Badge>
                    </TableCell>
                    {viewItemFields.map(f => {
                      const val = (m.item as any)[f.field] ?? (f.field === 'prod_name' ? m.item.item_name : undefined);
                      if (f.field === 'est_cost') {
                        const cost = m.item.est_cost ?? m.item.estimated_price;
                        return <TableCell key={f.field} className="text-xs text-right">{cost ? formatINR(Number(cost)) : '—'}</TableCell>;
                      }
                      if (f.field === 'qty') {
                        return <TableCell key={f.field} className="text-xs text-center">{m.item.qty ?? m.item.quantity ?? 0}</TableCell>;
                      }
                      return <TableCell key={f.field} className={`text-xs ${f.type === 'number' ? 'text-right' : ''}`}>{val ?? '—'}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Vendor assignment */}
      {selectedPRs.length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Merge size={16} className="text-green-600" />
              Assign Vendor for Merged PO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedVendor ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded p-3">
                <Badge className="bg-green-600 text-white border-none">{selectedVendor.company_name ?? selectedVendor.vendor_name}</Badge>
                <span className="text-xs text-gray-600">{selectedVendor.contact_person ?? ''}</span>
                <span className="text-xs text-gray-400">{selectedVendor.gst_no ?? ''}</span>
                <Button size="sm" variant="ghost" className="ml-auto text-xs h-6" onClick={() => setSelectedVendor(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Button size="sm" variant="outline" className="text-xs"
                  onClick={() => setShowVendorPicker(!showVendorPicker)}>
                  {showVendorPicker ? 'Hide Vendors' : 'Select Vendor'}
                </Button>
                {showVendorPicker && (
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
                      <div className="max-h-48 overflow-y-auto">
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
                            {filteredVendors.slice(0, 15).map(v => (
                              <TableRow key={v.kyc_basic_info_sno ?? v.vendor_sno}
                                className="hover:bg-indigo-50 cursor-pointer"
                                onClick={() => assignVendor(v)}>
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
              </>
            )}

            {/* Confirm */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleConfirm}
                disabled={!selectedVendor || itemSelection.size === 0 || selectedPRs.length < 2}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <ArrowRight size={16} className="mr-1" />
                Confirm Merge &amp; Proceed to Quotations ({itemSelection.size} items)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPRs.length < 2 && (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center text-gray-400 gap-3">
              <AlertCircle size={32} />
              <p className="text-sm text-center">
                Select <strong>2 or more PRs</strong> from the sidebar to merge them.
                <br />Use the checkboxes on the left panel.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MergePRTab;
