import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search, Users, Plus, Loader2, ClipboardCheck, RefreshCw,
  Eye, CheckCircle2, Package, Award, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useVendorFields, useQuotationItemFields } from '@/FieldDatas/PurchaseTeamFieldDatas';
import type { PRRecord, Vendor, Quotation, POGroup, POConfirmItem } from './types';
import { formatDate, formatINR, getPRDisplayNo, getQuotationTotal } from './helpers';

// ── Colour palette (mirrors POConfirmStep) ───────────────────────────────────
const GROUP_COLORS = [
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  badge: 'bg-indigo-600'  },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  badge: 'bg-orange-500'  },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  badge: 'bg-purple-600'  },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    badge: 'bg-pink-500'    },
];
const gc = (g: number) => GROUP_COLORS[(g - 1) % GROUP_COLORS.length];

interface QuotationsTabProps {
  selectedPR: PRRecord | null;
  vendors: Vendor[];
  loadingVendors: boolean;
  existingQuotations: Quotation[];
  loadingQuotations: boolean;
  onOpenQuotation: (vendor: Vendor, splitGroup?: number) => void;
  onSelectQuotation: (q: Quotation) => void;
  onCreatePO: (q: Quotation) => void;
  onCompare: () => void;
  onRefreshQuotations: () => void;
  poGroups?: POGroup[];
  /** Groups derived from POConfirmStep split selections */
  confirmedSplitGroups?: Array<{ groupNum: number; items: POConfirmItem[] }>;
}

// ── Quotation card (shared) ───────────────────────────────────────────────────
const QuotationCard: React.FC<{
  q: Quotation;
  viewQuotItemFields: any[];
  onSelect: (q: Quotation) => void;
  onCreatePO: (q: Quotation) => void;
}> = ({ q, viewQuotItemFields, onSelect, onCreatePO }) => {
  const total = getQuotationTotal(q.items);
  const isSelected = q.is_selected === 'Y';

  return (
    <Card className={`border ${isSelected ? 'border-green-400 bg-green-50/30' : ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">{q.vendor_name || q.company_name}</span>
              {isSelected && (
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                  <Award size={10} className="mr-1" /> Selected
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
              <div><span className="text-gray-400">Ref: </span><span className="font-medium">{q.quotation_ref_no || '—'}</span></div>
              <div><span className="text-gray-400">Date: </span><span>{formatDate(q.quotation_date)}</span></div>
              <div><span className="text-gray-400">Valid: </span><span>{formatDate(q.valid_upto)}</span></div>
              <div><span className="text-gray-400">Delivery: </span><span>{q.delivery_days} days</span></div>
            </div>
            <div className="mt-1 text-xs">
              <span className="text-gray-400">Items: {q.items.length} </span>
              <span className="font-semibold text-gray-800">Total: {formatINR(total)}</span>
            </div>
            {q.payment_terms && <p className="text-xs text-gray-500 mt-1">Terms: {q.payment_terms}</p>}
          </div>
          <div className="flex flex-col gap-1">
            {!isSelected && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onSelect(q)}>
                <CheckCircle2 size={12} className="mr-1" /> Select
              </Button>
            )}
            {isSelected && (
              <Button size="sm" className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700" onClick={() => onCreatePO(q)}>
                <Package size={12} className="mr-1" /> Create PO
              </Button>
            )}
          </div>
        </div>

        {q.items.length > 0 && (
          <div className="mt-3 border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  {viewQuotItemFields.map((f: any) => (
                    <TableHead key={f.field} className={`text-xs ${f.type === 'number' ? 'text-right' : f.field === 'qty' ? 'text-center' : ''}`}>
                      {f.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.items.map((it, iIdx) => (
                  <TableRow key={iIdx}>
                    {viewQuotItemFields.map((f: any) => {
                      const val = (it as any)[f.field];
                      if (f.field === 'qty') return <TableCell key={f.field} className="text-xs text-center">{it.qty} {it.unit_name}</TableCell>;
                      if (f.field === 'unit_name') return null;
                      if (f.field === 'unit_price' || f.field === 'total_amount') {
                        return <TableCell key={f.field} className="text-xs text-right font-medium">{formatINR(f.field === 'total_amount' ? (it.total_amount || it.qty * it.unit_price) : val)}</TableCell>;
                      }
                      if (f.field === 'discount_pct' || f.field === 'tax_pct') {
                        return <TableCell key={f.field} className="text-xs text-right">{val}%</TableCell>;
                      }
                      return <TableCell key={f.field} className="text-xs">{val ?? '—'}</TableCell>;
                    })}
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

// ── Per-group panel (manages its own vendor search) ───────────────────────────
const GroupPanel: React.FC<{
  label: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  items: POConfirmItem[];
  vendors: Vendor[];
  loadingVendors: boolean;
  quotations: Quotation[];
  loadingQuotations: boolean;
  splitGroup: number;         // 0 = main PO (ungrouped)
  viewVendorFields: any[];
  viewQuotItemFields: any[];
  onAddQuotation: (vendor: Vendor, splitGroup: number) => void;
  onSelectQuotation: (q: Quotation) => void;
  onCreatePO: (q: Quotation) => void;
}> = ({
  label, badgeClass, borderClass, bgClass, textClass,
  items, vendors, loadingVendors, quotations, loadingQuotations, splitGroup,
  viewVendorFields, viewQuotItemFields,
  onAddQuotation, onSelectQuotation, onCreatePO,
}) => {
  const [search, setSearch] = useState('');
  const [itemsOpen, setItemsOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter(v =>
      !q ||
      (v.company_name ?? v.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.contact_person ?? '').toLowerCase().includes(q) ||
      (v.gst_no ?? '').toLowerCase().includes(q)
    );
  }, [vendors, search]);

  const getVendorFieldValue = (vendor: Vendor, field: string): string => {
    if (field === 'company_name') return vendor.company_name ?? vendor.vendor_name ?? '—';
    if (field === 'mobile_number') return vendor.mobile_number ?? vendor.mobile ?? vendor.phone ?? vendor.email ?? '—';
    return (vendor as any)[field] ?? '—';
  };

  return (
    <Card className={`border ${borderClass}`}>
      <CardHeader className={`pb-3 ${bgClass} rounded-t-lg`}>
        <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${textClass}`}>
          <Badge className={`${badgeClass} text-white border-none text-xs`}>{label}</Badge>
          <span className="text-gray-700 font-medium">{items.length} item(s) → separate PO</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 ml-auto text-xs text-gray-500"
            onClick={() => setItemsOpen(v => !v)}
          >
            {itemsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {itemsOpen ? 'Hide' : 'Show'} items
          </Button>
        </CardTitle>

        {/* Items list (collapsible) */}
        {itemsOpen && (
          <div className="mt-2 space-y-1">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white/60 rounded px-2 py-1 border border-white">
                <span className="text-gray-400 w-4 shrink-0">{i + 1}.</span>
                <span className="font-medium text-gray-800">{it.prod_name}</span>
                <span className="text-gray-500 ml-auto shrink-0">{it.qty} {it.unit_name}</span>
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        {/* Vendor search + table */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            <Users size={12} /> Select Supplier &amp; Add Quotation
          </p>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
          </div>
          {loadingVendors ? (
            <div className="flex items-center gap-2 text-gray-400 py-3 justify-center">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs">Loading vendors…</span>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {viewVendorFields.map((f: any) => (
                      <TableHead key={f.field} className="text-xs py-1.5">{f.label}</TableHead>
                    ))}
                    <TableHead className="text-xs w-24 py-1.5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 15).map(v => (
                    <TableRow key={v.kyc_basic_info_sno ?? v.vendor_sno} className="hover:bg-indigo-50/50">
                      {viewVendorFields.map((f: any) => (
                        <TableCell key={f.field} className={`text-xs py-1.5 ${f.field === 'company_name' ? 'font-medium' : 'text-gray-600'}`}>
                          {getVendorFieldValue(v, f.field)}
                        </TableCell>
                      ))}
                      <TableCell className="py-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => onAddQuotation(v, splitGroup)}
                        >
                          <Plus size={11} className="mr-1" /> Quote
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Quotations for this group */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            <ClipboardCheck size={12} /> Quotations
            <Badge variant="outline" className="text-xs ml-1">{quotations.length}</Badge>
          </p>
          {loadingQuotations ? (
            <div className="flex items-center gap-2 text-gray-400 py-3 justify-center">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : quotations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">
              No quotations yet for this group. Add one using a supplier above.
            </p>
          ) : (
            <div className="space-y-2">
              {quotations.map(q => (
                <QuotationCard
                  key={q.sq_basic_sno}
                  q={q}
                  viewQuotItemFields={viewQuotItemFields}
                  onSelect={onSelectQuotation}
                  onCreatePO={onCreatePO}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const QuotationsTab: React.FC<QuotationsTabProps> = ({
  selectedPR, vendors, loadingVendors,
  existingQuotations, loadingQuotations,
  onOpenQuotation, onSelectQuotation, onCreatePO,
  onCompare, onRefreshQuotations,
  poGroups = [],
  confirmedSplitGroups = [],
}) => {
  const vendorFields = useVendorFields();
  const quotationItemFields = useQuotationItemFields();
  const [searchVendor, setSearchVendor] = useState('');

  const viewVendorFields = vendorFields.filter((f: any) => f.view);
  const viewQuotItemFields = quotationItemFields.filter((f: any) => f.view);

  const filteredVendors = useMemo(() => {
    const q = searchVendor.toLowerCase();
    return vendors.filter(v =>
      !q ||
      (v.company_name ?? v.vendor_name ?? '').toLowerCase().includes(q) ||
      (v.contact_person ?? '').toLowerCase().includes(q) ||
      (v.gst_no ?? '').toLowerCase().includes(q)
    );
  }, [vendors, searchVendor]);

  const getVendorFieldValue = (vendor: Vendor, field: string): string => {
    if (field === 'company_name') return vendor.company_name ?? vendor.vendor_name ?? '—';
    if (field === 'mobile_number') return vendor.mobile_number ?? vendor.mobile ?? vendor.phone ?? vendor.email ?? '—';
    return (vendor as any)[field] ?? '—';
  };

  const displayLabel = selectedPR ? getPRDisplayNo(selectedPR) : 'Selected';
  const prNo = selectedPR ? getPRDisplayNo(selectedPR) : '';

  // ── Quotations filtered per confirmed split group ─────────────────────────
  const quotationsForGroup = (groupNum: number) =>
    existingQuotations.filter(q =>
      q.split_group !== undefined
        ? q.split_group === groupNum
        : groupNum === 0   // fallback: ungrouped quotations appear in "Main PO"
    );

  const ungroupedQuotations = existingQuotations.filter(q => !q.split_group);

  // Main PO items (items with no split_group)
  const hasConfirmedGroups = confirmedSplitGroups.length > 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE A — confirmed split groups from POConfirmStep
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasConfirmedGroups) {
    // "Main PO" quotations = quotations with no split_group set.

    return (
      <div className="space-y-4">
        {/* Per-group panels */}
        {confirmedSplitGroups.map(({ groupNum, items }) => {
          const col = gc(groupNum);
          return (
            <GroupPanel
              key={groupNum}
              label={`${prNo} / Group ${groupNum}`}
              badgeClass={col.badge}
              borderClass={col.border}
              bgClass={col.bg}
              textClass={col.text}
              items={items}
              vendors={vendors}
              loadingVendors={loadingVendors}
              quotations={quotationsForGroup(groupNum)}
              loadingQuotations={loadingQuotations}
              splitGroup={groupNum}
              viewVendorFields={viewVendorFields}
              viewQuotItemFields={viewQuotItemFields}
              onAddQuotation={(vendor, sg) => onOpenQuotation(vendor, sg)}
              onSelectQuotation={onSelectQuotation}
              onCreatePO={onCreatePO}
            />
          );
        })}

        {/* Main PO panel — quotations not belonging to any split group */}
        {ungroupedQuotations.length > 0 && (
          <GroupPanel
            label="Main PO"
            badgeClass="bg-gray-500"
            borderClass="border-gray-200"
            bgClass="bg-gray-50"
            textClass="text-gray-700"
            items={[]}
            vendors={vendors}
            loadingVendors={loadingVendors}
            quotations={ungroupedQuotations}
            loadingQuotations={loadingQuotations}
            splitGroup={0}
            viewVendorFields={viewVendorFields}
            viewQuotItemFields={viewQuotItemFields}
            onAddQuotation={(vendor, sg) => onOpenQuotation(vendor, sg)}
            onSelectQuotation={onSelectQuotation}
            onCreatePO={onCreatePO}
          />
        )}

        {/* Refresh + Compare */}
        <div className="flex justify-end gap-2">
          {existingQuotations.length >= 2 && (
            <Button size="sm" variant="outline" className="text-xs" onClick={onCompare}>
              <Eye size={14} className="mr-1" /> Compare All
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={onRefreshQuotations} disabled={loadingQuotations}>
            <RefreshCw size={14} className={loadingQuotations ? 'animate-spin mr-1' : 'mr-1'} />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE B — poGroups from SplitPRTab (legacy split flow)
  // ═══════════════════════════════════════════════════════════════════════════
  if (poGroups.length > 0) {
    return (
      <div className="space-y-4">
        {poGroups.map((group, gIdx) => {
          const groupVendor = vendors.find(v =>
            (v.kyc_basic_info_sno ?? v.vendor_sno) === group.vendorSno
          );
          const groupQuotations = existingQuotations.filter(q => q.vendor_sno === group.vendorSno);

          return (
            <Card key={group.id} className="border-indigo-100">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white border-none">{prNo}/{gIdx + 1}</Badge>
                    <span className="text-gray-800">
                      {group.vendorName ?? <span className="text-amber-600 italic font-normal">No vendor assigned</span>}
                    </span>
                    <span className="text-xs font-normal text-gray-400">• {group.items.length} item(s)</span>
                  </CardTitle>
                  {groupVendor && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onOpenQuotation(groupVendor)}>
                      <Plus size={12} className="mr-1" /> Add Quotation
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingQuotations ? (
                  <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
                    <Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading...</span>
                  </div>
                ) : groupQuotations.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">
                    No quotations yet.{!groupVendor && ' Assign a vendor via Split to add quotations.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {groupQuotations.map(q => (
                      <QuotationCard key={q.sq_basic_sno} q={q} viewQuotItemFields={viewQuotItemFields} onSelect={onSelectQuotation} onCreatePO={onCreatePO} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        <div className="flex justify-end gap-2">
          {existingQuotations.length >= 2 && (
            <Button size="sm" variant="outline" className="text-xs" onClick={onCompare}>
              <Eye size={14} className="mr-1" /> Compare All
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={onRefreshQuotations} disabled={loadingQuotations}>
            <RefreshCw size={14} className={loadingQuotations ? 'animate-spin mr-1' : 'mr-1'} /> Refresh
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE C — standard (no split groups)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users size={16} className="text-green-600" />
            Assign Supplier &amp; Add Quotation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search vendors by name, GST..."
              value={searchVendor}
              onChange={e => setSearchVendor(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {loadingVendors ? (
            <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading vendors...</span>
            </div>
          ) : filteredVendors.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No vendors found</p>
          ) : (
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {viewVendorFields.map((f: any) => (
                      <TableHead key={f.field} className="text-xs">{f.label}</TableHead>
                    ))}
                    <TableHead className="text-xs w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.slice(0, 20).map(v => (
                    <TableRow key={v.kyc_basic_info_sno ?? v.vendor_sno} className="hover:bg-gray-50">
                      {viewVendorFields.map((f: any) => (
                        <TableCell key={f.field} className={`text-${f.field === 'company_name' ? 'sm font-medium' : 'xs text-gray-600'}`}>
                          {getVendorFieldValue(v, f.field)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenQuotation(v)}>
                          <Plus size={12} className="mr-1" /> Quote
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck size={16} className="text-purple-600" />
              Quotations for {displayLabel}
              <Badge variant="outline" className="text-xs ml-1">{existingQuotations.length}</Badge>
            </CardTitle>
            <div className="flex gap-2">
              {existingQuotations.length >= 2 && (
                <Button size="sm" variant="outline" className="text-xs" onClick={onCompare}>
                  <Eye size={14} className="mr-1" /> Compare
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-xs" onClick={onRefreshQuotations} disabled={loadingQuotations}>
                <RefreshCw size={14} className={loadingQuotations ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingQuotations ? (
            <div className="flex items-center gap-2 text-gray-400 py-6 justify-center">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading quotations...</span>
            </div>
          ) : existingQuotations.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-gray-400 gap-2">
              <ClipboardCheck size={28} />
              <p className="text-sm">No quotations yet. Assign a supplier above to add one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {existingQuotations.map(q => (
                <QuotationCard key={q.sq_basic_sno} q={q} viewQuotItemFields={viewQuotItemFields} onSelect={onSelectQuotation} onCreatePO={onCreatePO} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuotationsTab;
