import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Wrench, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { PageHeader, FormSection } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useAppState } from '@/globalState/hooks/useAppState';
import {
  apiGetAllKycDatas,
  getEligiblePrLinesForServicePO,
  createServicePO,
  getAllServicePOs,
} from '@/Services/Api';
import { toast } from 'sonner';

interface EligibleLine {
  pr_item_sno: number;
  service_sno: number;
  service_name: string;
  service_type_sno: number;
  service_type_code: string;
  service_type_name: string;
  qty: number;
  remarks?: string;
}

interface Vendor {
  kyc_basic_info_sno: number;
  company_name: string;
}

const ServicePOPage: React.FC = () => {
  const { userData } = useAppState();
  const currentUser = Array.isArray(userData) ? userData[0] : userData;

  const [prNoInput, setPrNoInput] = useState('');
  const [prBasicSno, setPrBasicSno] = useState<number | null>(null);
  const [selectedLines, setSelectedLines] = useState<Record<number, { agreed_unit_price: string; tax_pct: string }>>({});
  const [vendorSno, setVendorSno] = useState<string>('');
  const [poType, setPoType] = useState<'ONE_TIME' | 'STANDING'>('STANDING');
  const [validityFrom, setValidityFrom] = useState('');
  const [validityTo, setValidityTo] = useState('');
  const [ceilingAmount, setCeilingAmount] = useState('');
  const [variancePct, setVariancePct] = useState('');
  const [purpose, setPurpose] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: eligibleData, loading: eligibleLoading } = useFetch<{ success: boolean; data: EligibleLine[] }>(
    prBasicSno ? getEligiblePrLinesForServicePO : null,
    '',
    { pr_basic_sno: prBasicSno },
  );
  const eligibleLines = eligibleData?.data ?? [];

  const { data: vendorData } = useFetch<{ success: boolean; data: Vendor[] } | Vendor[]>(apiGetAllKycDatas);
  const vendors: Vendor[] = Array.isArray(vendorData) ? vendorData : (vendorData as any)?.data ?? [];

  const { data: allServicePOsData, loading: listLoading } = useFetch<{ success: boolean; data: any[] }>(
    getAllServicePOs, '', null, refreshKey
  );
  const servicePOs = allServicePOsData?.data ?? [];

  const requiresCeiling = useMemo(
    () => eligibleLines.some(l => l.service_type_code === 'VARIABLE_RECURRING'),
    [eligibleLines]
  );

  const { postData, loading: submitting } = usePost();

  const handleLookupPr = async () => {
    if (!prNoInput.trim()) return;
    // The eligible-lines proc takes pr_basic_sno, not pr_no — resolve it via
    // the common_master-style PR lookup isn't available, so we ask the user
    // to paste the numeric pr_basic_sno shown on the PR approval screen.
    const parsed = Number(prNoInput.trim());
    if (!Number.isFinite(parsed)) {
      toast.error('Enter the PR basic sno (numeric id) shown on the approved PR');
      return;
    }
    setPrBasicSno(parsed);
    setSelectedLines({});
  };

  const toggleLine = (line: EligibleLine) => {
    setSelectedLines(prev => {
      const next = { ...prev };
      if (next[line.pr_item_sno]) delete next[line.pr_item_sno];
      else next[line.pr_item_sno] = { agreed_unit_price: '', tax_pct: '18' };
      return next;
    });
  };

  const updateLineField = (pr_item_sno: number, field: 'agreed_unit_price' | 'tax_pct', value: string) => {
    setSelectedLines(prev => ({ ...prev, [pr_item_sno]: { ...prev[pr_item_sno], [field]: value } }));
  };

  const handleSubmit = async () => {
    const chosen = eligibleLines.filter(l => selectedLines[l.pr_item_sno]);
    if (!prBasicSno || !vendorSno || chosen.length === 0) {
      toast.error('Pick a PR, vendor and at least one service line');
      return;
    }
    const serviceTypeCode = chosen[0].service_type_code;
    if (chosen.some(l => l.service_type_code !== serviceTypeCode)) {
      toast.error('All lines on one Service PO must share the same billing pattern');
      return;
    }
    if (serviceTypeCode === 'VARIABLE_RECURRING' && !ceilingAmount) {
      toast.error('Ceiling amount is required for Variable Recurring services');
      return;
    }

    const payload = {
      pr_basic_sno: prBasicSno,
      vendor_sno: Number(vendorSno),
      service_type_code: serviceTypeCode,
      po_type: poType,
      validity_from: validityFrom || null,
      validity_to: validityTo || null,
      ceiling_amount: ceilingAmount ? Number(ceilingAmount) : null,
      variance_tolerance_pct: variancePct ? Number(variancePct) : null,
      delivery_address: '',
      terms_conditions: '',
      purpose,
      com_sno: currentUser?.com_sno,
      div_sno: currentUser?.div_sno,
      brn_sno: currentUser?.brn_sno,
      dept_sno: currentUser?.dept_sno,
      items: chosen.map(l => ({
        pr_item_sno: l.pr_item_sno,
        service_sno: l.service_sno,
        qty: l.qty ?? 1,
        agreed_unit_price: Number(selectedLines[l.pr_item_sno]?.agreed_unit_price || 0),
        tax_pct: Number(selectedLines[l.pr_item_sno]?.tax_pct || 0),
        remarks: l.remarks,
      })),
    };

    try {
      const result = await postData(createServicePO, payload);
      const created = (result as any)?.data;
      toast.success(
        created?.is_new_po
          ? `Service PO ${created.po_no} created`
          : `Appended to existing Service PO ${created.po_no}`
      );
      setPrBasicSno(null);
      setPrNoInput('');
      setSelectedLines({});
      setVendorSno('');
      setCeilingAmount('');
      setVariancePct('');
      setPurpose('');
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to create Service PO');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader icon={Wrench} title="Service Purchase Order" description="Standing / one-time POs for recurring and vendor-bill-driven services" />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-6">
            <FormSection icon={Search} title="1. Pick an approved PR">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="pr_basic_sno">PR basic sno</Label>
                  <Input id="pr_basic_sno" value={prNoInput} onChange={e => setPrNoInput(e.target.value)}
                    placeholder="e.g. 42" />
                </div>
                <Button onClick={handleLookupPr} disabled={eligibleLoading}>
                  {eligibleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look up'}
                </Button>
              </div>
            </FormSection>

            {prBasicSno && (
              <FormSection icon={Wrench} title="2. Select eligible service lines">
                {eligibleLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No approved, unassigned service lines found on this PR.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eligibleLines.map(line => {
                      const checked = !!selectedLines[line.pr_item_sno];
                      return (
                        <div key={line.pr_item_sno} className={`rounded-lg border p-3 ${checked ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input type="checkbox" checked={checked} onChange={() => toggleLine(line)} />
                              <div>
                                <p className="text-sm font-medium">{line.service_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {line.service_type_name} · qty {line.qty} · {line.remarks || 'no remarks'}
                                </p>
                              </div>
                            </label>
                            <Badge variant="outline" className="text-xs">{line.service_type_code}</Badge>
                          </div>
                          {checked && (
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <Label className="text-xs">Agreed amount / unit price</Label>
                                <Input type="number" value={selectedLines[line.pr_item_sno].agreed_unit_price}
                                  onChange={e => updateLineField(line.pr_item_sno, 'agreed_unit_price', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Tax %</Label>
                                <Input type="number" value={selectedLines[line.pr_item_sno].tax_pct}
                                  onChange={e => updateLineField(line.pr_item_sno, 'tax_pct', e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </FormSection>
            )}

            {prBasicSno && (
              <FormSection icon={Plus} title="3. PO terms">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Vendor</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={vendorSno} onChange={e => setVendorSno(e.target.value)}>
                      <option value="">Select vendor…</option>
                      {vendors.map(v => (
                        <option key={v.kyc_basic_info_sno} value={v.kyc_basic_info_sno}>{v.company_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>PO Type</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={poType} onChange={e => setPoType(e.target.value as any)}>
                      <option value="STANDING">Standing (recurring)</option>
                      <option value="ONE_TIME">One-time</option>
                    </select>
                  </div>
                  <div>
                    <Label>Purpose</Label>
                    <Input value={purpose} onChange={e => setPurpose(e.target.value)} />
                  </div>
                  <div>
                    <Label>Validity From</Label>
                    <Input type="date" value={validityFrom} onChange={e => setValidityFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label>Validity To</Label>
                    <Input type="date" value={validityTo} onChange={e => setValidityTo(e.target.value)} />
                  </div>
                  {requiresCeiling && (
                    <>
                      <div>
                        <Label>Ceiling Amount</Label>
                        <Input type="number" value={ceilingAmount} onChange={e => setCeilingAmount(e.target.value)} />
                      </div>
                      <div>
                        <Label>Variance Tolerance %</Label>
                        <Input type="number" value={variancePct} onChange={e => setVariancePct(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-4">
                  <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Create Service PO
                  </Button>
                </div>
              </FormSection>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Service Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : servicePOs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Service POs yet.</p>
            ) : (
              <div className="space-y-2">
                {servicePOs.map((po: any) => (
                  <div key={po.po_basic_sno} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-semibold">{po.po_no}</p>
                      <p className="text-xs text-muted-foreground">
                        {po.vendor_name} · {po.service_type_name} · {po.po_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {po.ceiling_amount != null && (
                        <Badge variant="outline" className="text-xs">
                          ₹{Number(po.consumed_amount ?? 0).toLocaleString('en-IN')} / ₹{Number(po.ceiling_amount).toLocaleString('en-IN')}
                        </Badge>
                      )}
                      <Badge className="text-xs">{po.status === 'A' ? 'Approved' : po.status === 'R' ? 'Rejected' : 'Pending'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ServicePOPage;
