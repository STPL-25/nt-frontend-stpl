import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { PageHeader, FormSection } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import { createServiceAgreement, getServiceAgreements, apiGetAllKycDatas } from '@/Services/Api';
import { toast } from 'sonner';

// Same shape as PRData.tsx's CascadeOption — DivisionMaster/BranchMaster/
// DeptMaster rows carry com_sno/div_sno/brn_sno beyond just {value,label},
// which is what makes client-side cascade filtering possible.
interface CascadeOption {
  value: string | number;
  label: string;
  com_sno?: string | number | null;
  div_sno?: string | number | null;
  brn_sno?: string | number | null;
}

interface Vendor {
  kyc_basic_info_sno: number;
  company_name: string;
}

const CADENCE_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'EVERY_N_DAYS', label: 'Every N Days' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly' },
  { value: 'YEARLY_FIXED_DATE', label: 'Yearly (Fixed Date)' },
];

const ServiceAgreementPage: React.FC = () => {
  const { options } = useMasterOptions([
    'CompanyMaster', 'DivisionMaster', 'BranchMaster', 'DeptMaster', 'ServiceMaster', 'UomMaster',
  ]);
  const { CompanyMaster, DivisionMaster, BranchMaster, DeptMaster, ServiceMaster, UomMaster } = options || {};

  const [comSno, setComSno] = useState('');
  const [divSno, setDivSno] = useState('');
  const [brnSno, setBrnSno] = useState('');
  const [deptSno, setDeptSno] = useState('');
  const [serviceSno, setServiceSno] = useState('');
  const [vendorSno, setVendorSno] = useState('');
  const [rateAmount, setRateAmount] = useState('');
  const [rateUomSno, setRateUomSno] = useState('');
  const [cadence, setCadence] = useState('MONTHLY');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [remarks, setRemarks] = useState('');
  const [document, setDocument] = useState<File | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cascade filtering — identical recipe to PRData.tsx's usePRBasicInfoFields
  const divisionOptions = useMemo(() => {
    if (!DivisionMaster) return [];
    if (!comSno) return DivisionMaster;
    return DivisionMaster.filter((d: CascadeOption) => String(d.com_sno) === String(comSno));
  }, [DivisionMaster, comSno]);

  const branchOptions = useMemo(() => {
    if (!BranchMaster) return [];
    return BranchMaster.filter((b: CascadeOption) => {
      const matchCompany = !comSno || String(b.com_sno) === String(comSno);
      const matchDivision = !divSno || String(b.div_sno) === String(divSno);
      return matchCompany && matchDivision;
    });
  }, [BranchMaster, comSno, divSno]);

  const deptOptions = useMemo(() => {
    if (!DeptMaster) return [];
    return DeptMaster.filter((d: CascadeOption) => {
      const matchCompany = !comSno || String(d.com_sno) === String(comSno);
      const matchDivision = !divSno || String(d.div_sno) === String(divSno);
      const matchBranch = !brnSno || String(d.brn_sno) === String(brnSno);
      return matchCompany && matchDivision && matchBranch;
    });
  }, [DeptMaster, comSno, divSno, brnSno]);

  const { data: vendorData } = useFetch<{ success: boolean; data: Vendor[] } | Vendor[]>(apiGetAllKycDatas);
  const vendors: Vendor[] = Array.isArray(vendorData) ? vendorData : (vendorData as any)?.data ?? [];

  const { data: agreementsData, loading: listLoading } = useFetch<{ success: boolean; data: any[] }>(
    getServiceAgreements, '', null, refreshKey
  );
  const agreements = agreementsData?.data ?? [];

  const { postData, loading: submitting } = usePost();

  const resetForm = () => {
    setComSno(''); setDivSno(''); setBrnSno(''); setDeptSno('');
    setServiceSno(''); setVendorSno('');
    setRateAmount(''); setRateUomSno(''); setCadence('MONTHLY');
    setPeriodStart(''); setPeriodEnd(''); setRemarks(''); setDocument(null);
  };

  const handleSubmit = async () => {
    if (!comSno || !divSno || !brnSno || !deptSno || !serviceSno) {
      toast.error('Company, Division, Branch, Department and Service are required');
      return;
    }
    if (!rateAmount || Number(rateAmount) <= 0) {
      toast.error('Enter a valid rate amount');
      return;
    }
    if (!periodStart || !periodEnd) {
      toast.error('Period start and end dates are required');
      return;
    }
    if (new Date(periodEnd) <= new Date(periodStart)) {
      toast.error('Period end date must be after the start date');
      return;
    }
    if (!document) {
      toast.error('Upload the agreement/contract document');
      return;
    }

    // Flat multipart fields — matches the backend contract exactly
    // (ServiceAgreement.controller.js#createServiceAgreement reads req.body.*
    // plus a file field named "agreement_document").
    const formData = new FormData();
    formData.append('com_sno', comSno);
    formData.append('div_sno', divSno);
    formData.append('brn_sno', brnSno);
    formData.append('dept_sno', deptSno);
    formData.append('service_sno', serviceSno);
    if (vendorSno) formData.append('vendor_sno', vendorSno);
    formData.append('rate_amount', rateAmount);
    if (rateUomSno) formData.append('rate_uom_sno', rateUomSno);
    formData.append('recurrence_cadence', cadence);
    formData.append('period_start_date', periodStart);
    formData.append('period_end_date', periodEnd);
    if (remarks) formData.append('remarks', remarks);
    formData.append('agreement_document', document);

    try {
      const result = await postData(createServiceAgreement, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const created = (result as any)?.data;
      toast.success(`Service agreement ${created?.agreement_no ?? ''} submitted for approval`);
      resetForm();
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to submit service agreement');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={FileText}
        title="Service Agreements"
        description="Fixed-recurring service contracts (e.g. rent) — approval-gated, auto-fills PR lines once approved"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-6">
            <FormSection icon={Plus} title="New agreement">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Company</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={comSno}
                    onChange={(e) => { setComSno(e.target.value); setDivSno(''); setBrnSno(''); setDeptSno(''); }}
                  >
                    <option value="">Select company…</option>
                    {(CompanyMaster ?? []).map((c: CascadeOption) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Division</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={divSno}
                    onChange={(e) => { setDivSno(e.target.value); setBrnSno(''); setDeptSno(''); }}
                  >
                    <option value="">Select division…</option>
                    {divisionOptions.map((d: CascadeOption) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Branch</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={brnSno}
                    onChange={(e) => { setBrnSno(e.target.value); setDeptSno(''); }}
                  >
                    <option value="">Select branch…</option>
                    {branchOptions.map((b: CascadeOption) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Department</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={deptSno}
                    onChange={(e) => setDeptSno(e.target.value)}
                  >
                    <option value="">Select department…</option>
                    {deptOptions.map((d: CascadeOption) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Service</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={serviceSno}
                    onChange={(e) => setServiceSno(e.target.value)}
                  >
                    <option value="">Select service…</option>
                    {(ServiceMaster ?? []).map((s: CascadeOption) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be a Fixed Recurring service — the server rejects anything else.
                  </p>
                </div>
                <div>
                  <Label>Vendor (optional)</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={vendorSno}
                    onChange={(e) => setVendorSno(e.target.value)}
                  >
                    <option value="">Select vendor…</option>
                    {vendors.map((v) => (
                      <option key={v.kyc_basic_info_sno} value={v.kyc_basic_info_sno}>{v.company_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Rate amount</Label>
                  <Input type="number" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} placeholder="e.g. 100000" />
                </div>
                <div>
                  <Label>Rate UOM (optional)</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={rateUomSno}
                    onChange={(e) => setRateUomSno(e.target.value)}
                  >
                    <option value="">Select unit…</option>
                    {(UomMaster ?? []).map((u: CascadeOption) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Recurrence cadence</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value)}
                  >
                    {CADENCE_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Period start</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label>Period end</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                <div>
                  <Label>Agreement document</Label>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-sm"
                    onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
                  />
                  {document && <p className="text-xs text-muted-foreground mt-1 truncate">{document.name}</p>}
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <Label>Remarks (optional)</Label>
                  <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Submit for approval
                </Button>
              </div>
            </FormSection>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Service Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : agreements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No service agreements yet.</p>
            ) : (
              <div className="space-y-2">
                {agreements.map((a: any) => (
                  <div key={a.agreement_sno} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-semibold">{a.agreement_no} · {a.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.vendor_name || 'No vendor'} · ₹{Number(a.rate_amount).toLocaleString('en-IN')}
                        {a.rate_uom_name ? `/${a.rate_uom_name}` : ''} ·{' '}
                        {String(a.period_start_date).slice(0, 10)} → {String(a.period_end_date).slice(0, 10)}
                      </p>
                    </div>
                    <Badge className="text-xs">
                      {a.status === 'A' ? 'Approved' : a.status === 'R' ? 'Rejected' : a.status === 'X' ? 'Expired' : 'Pending'}
                    </Badge>
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

export default ServiceAgreementPage;
