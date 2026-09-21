import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Receipt, Search, Send, RefreshCw, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { FormSection, PageHeader } from '@/CustomComponent/PageComponents';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import axios from 'axios';
import { getVendorDrivenBillableChildPOs, consolidateVendorDrivenBills } from '@/Services/Api';
import { toast } from 'sonner';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';

interface ChildPOItem {
  po_item_sno: number;
  prod_sno: number;
  prod_name: string;
  requested_qty: number;
  unit_name: string;
  line_value: number;
  received_qty: number;
}

interface ChildPO {
  po_basic_sno: number;
  po_df_no: string;
  po_date: string;
  vendor_sno: number;
  vendor_name: string;
  pr_no: string;
  payment_cycle_days: number;
  vendor_invoice_no: string | null;
  vendor_invoice_date: string | null;
  items: string; // raw JSON from the SP
}

const VendorBillPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const permissionComponent = 'VendorBillPage';
  const canSubmit = canCreate(permissionComponent) || canEdit(permissionComponent);

  const { options } = useMasterOptions(['VendorMaster']);

  const [vendorSno, setVendorSno] = useState<string>('');
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [childPOs, setChildPOs] = useState<ChildPO[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [consolidating, setConsolidating] = useState(false);

  const parsedPOs = useMemo(
    () => childPOs.map((po) => ({ ...po, parsedItems: JSON.parse(po.items || '[]') as ChildPOItem[] })),
    [childPOs]
  );

  const poTotal = (po: { parsedItems: ChildPOItem[] }) =>
    po.parsedItems.reduce((sum, it) => sum + (Number(it.line_value) || 0), 0);

  const handleSearch = async () => {
    if (!vendorSno) {
      setVendorError('Supplier is required');
      return;
    }
    setVendorError(null);
    setSearching(true);
    setSearched(true);
    setSelected(new Set());
    try {
      const res = await axios.get(getVendorDrivenBillableChildPOs, { params: { vendor_sno: vendorSno } });
      setChildPOs(res?.data?.data ?? []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load billable child POs');
      setChildPOs([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleRow = (po_basic_sno: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(po_basic_sno)) next.delete(po_basic_sno); else next.add(po_basic_sno);
      return next;
    });
  };

  const toggleExpand = (po_basic_sno: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(po_basic_sno)) next.delete(po_basic_sno); else next.add(po_basic_sno);
      return next;
    });
  };

  const allSelected = parsedPOs.length > 0 && selected.size === parsedPOs.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(parsedPOs.map((po) => po.po_basic_sno)));
  };

  const selectedTotal = useMemo(
    () => parsedPOs.filter((po) => selected.has(po.po_basic_sno)).reduce((sum, po) => sum + poTotal(po), 0),
    [parsedPOs, selected]
  );

  const handleConsolidate = async () => {
    if (selected.size === 0) return;
    setConsolidating(true);
    try {
      const res = await axios.post(consolidateVendorDrivenBills, {
        vendor_sno: Number(vendorSno),
        po_basic_snos: Array.from(selected),
      });
      const results: Array<{ po_basic_sno: number; po_no?: string; result: string; error?: string; invoice_no?: string }> = res?.data?.data ?? [];
      const succeeded = results.filter((r) => r.result === 'SUCCESS');
      const failed = results.filter((r) => r.result !== 'SUCCESS');
      if (succeeded.length > 0) {
        toast.success(`${succeeded.length} bill${succeeded.length === 1 ? '' : 's'} raised (${succeeded.map((r) => r.invoice_no).filter(Boolean).join(', ')})`);
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} PO(s) could not be billed: ${failed.map((f) => `${f.po_no ?? f.po_basic_sno} — ${f.error}`).join('; ')}`);
      }
      const succeededSnos = new Set(succeeded.map((r) => r.po_basic_sno));
      setChildPOs((prev) => prev.filter((po) => !succeededSnos.has(po.po_basic_sno)));
      setSelected(new Set());
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to raise bills. Try again.');
    } finally {
      setConsolidating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={Receipt}
        title="Vendor Bill"
        description="Select delivered child POs from one supplier — spanning multiple days — and raise one consolidated bill for each"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-4">
            <FormSection icon={Search} title="Select Supplier">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
                <div data-error={!!vendorError} className="flex flex-col">
                  <CustomInputField
                    field="vendor_sno"
                    label="Supplier"
                    require
                    type="search-select"
                    options={options?.VendorMaster}
                    value={vendorSno}
                    onChange={(value) => { setVendorSno(String(value)); setVendorError(null); }}
                    error={vendorError ?? undefined}
                    placeholder="Select supplier"
                    className="h-10"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button type="button" onClick={handleSearch} disabled={searching} className="h-9">
                  {searching ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Search
                </Button>
              </div>
            </FormSection>
          </CardContent>
        </Card>

        {searched && (
          <Card className="shadow-md">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Billable Child POs<Badge variant="secondary">{parsedPOs.length}</Badge>
                </h3>
                {selected.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selected.size} selected — total ₹{selectedTotal.toFixed(2)}
                  </span>
                )}
              </div>

              {parsedPOs.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-10">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                        </TableHead>
                        <TableHead className="w-6" />
                        <TableHead className="text-xs">PO No</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Supplier Invoice</TableHead>
                        <TableHead className="text-xs">Payment Cycle</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedPOs.map((po) => (
                        <React.Fragment key={po.po_basic_sno}>
                          <TableRow className={selected.has(po.po_basic_sno) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}>
                            <TableCell>
                              <Checkbox checked={selected.has(po.po_basic_sno)} onCheckedChange={() => toggleRow(po.po_basic_sno)} />
                            </TableCell>
                            <TableCell>
                              <button type="button" onClick={() => toggleExpand(po.po_basic_sno)} className="text-muted-foreground">
                                {expanded.has(po.po_basic_sno) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </TableCell>
                            <TableCell className="text-xs font-medium">{po.po_df_no}</TableCell>
                            <TableCell className="text-xs">{po.po_date}</TableCell>
                            <TableCell className="text-xs">{po.vendor_invoice_no ?? '—'}</TableCell>
                            <TableCell className="text-xs">Every {po.payment_cycle_days} days</TableCell>
                            <TableCell className="text-xs text-right font-medium">₹{poTotal(po).toFixed(2)}</TableCell>
                          </TableRow>
                          {expanded.has(po.po_basic_sno) && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/20 p-0">
                                <div className="p-3">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Product</TableHead>
                                        <TableHead className="text-xs text-right">Requested Qty</TableHead>
                                        <TableHead className="text-xs text-right">Received (GRN) Qty</TableHead>
                                        <TableHead className="text-xs text-right">Line Value</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {po.parsedItems.map((it) => (
                                        <TableRow key={it.po_item_sno}>
                                          <TableCell className="text-xs">{it.prod_name}</TableCell>
                                          <TableCell className="text-xs text-right">{it.requested_qty} {it.unit_name}</TableCell>
                                          <TableCell className="text-xs text-right">
                                            <span className={Number(it.received_qty) < Number(it.requested_qty) ? 'text-amber-600 font-medium' : ''}>
                                              {it.received_qty} {it.unit_name}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-xs text-right">₹{Number(it.line_value).toFixed(2)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground border rounded-xl bg-muted/10">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No billable child POs for this supplier — goods must be GRN-received and not already invoiced.</p>
                </div>
              )}

              {parsedPOs.length > 0 && (
                <div className="flex items-center justify-end pt-4 border-t">
                  {canSubmit && (
                    <Button
                      type="button"
                      onClick={handleConsolidate}
                      disabled={selected.size === 0 || consolidating}
                      className="bg-blue-600 hover:bg-blue-700 h-9"
                    >
                      {consolidating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Raise Bill ({selected.size} {selected.size === 1 ? 'PO' : 'POs'})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VendorBillPage;
