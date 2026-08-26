import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Receipt, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { PageHeader, FormSection } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import {
  createServiceBillRequest, getServiceBillRequests, getActiveCeilingAgreementsForBilling,
} from '@/Services/Api';
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

interface CeilingAgreement {
  agreement_sno: number;
  agreement_no: string;
  service_sno: number;
  service_name: string;
  vendor_sno: number | null;
  vendor_name: string | null;
  ceiling_amount: number;
  variance_tolerance_pct: number;
  cadence_name: string | null;
  period_start_date: string;
  period_end_date: string;
}

const ServiceBillRequestPage: React.FC = () => {
  const { options } = useMasterOptions(['CompanyMaster', 'DivisionMaster', 'BranchMaster', 'DeptMaster']);
  const { CompanyMaster, DivisionMaster, BranchMaster, DeptMaster } = options || {};

  const [comSno, setComSno] = useState('');
  const [divSno, setDivSno] = useState('');
  const [brnSno, setBrnSno] = useState('');
  const [deptSno, setDeptSno] = useState('');
  const [agreementSno, setAgreementSno] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [document, setDocument] = useState<File | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cascade filtering — identical recipe to ServiceAgreementPage.tsx
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

  // Only fetch eligible ceiling agreements once the full org scope is picked
  // — mirrors PurchaseRequisitionPage.tsx's agreementLookupUrl pattern.
  const scopeReady = Boolean(comSno && divSno && brnSno && deptSno);
  const { data: agreementsLookup, loading: agreementsLoading } = useFetch<{ success: boolean; data: CeilingAgreement[] }>(
    scopeReady ? getActiveCeilingAgreementsForBilling : null,
    '',
    scopeReady ? { com_sno: comSno, div_sno: divSno, brn_sno: brnSno, dept_sno: deptSno } : null
  );
  const eligibleAgreements: CeilingAgreement[] = agreementsLookup?.data ?? [];
  const selectedAgreement = eligibleAgreements.find((a) => String(a.agreement_sno) === agreementSno) || null;

  const { data: requestsData, loading: listLoading } = useFetch<{ success: boolean; data: any[] }>(
    getServiceBillRequests, '', null, refreshKey
  );
  const requests = requestsData?.data ?? [];

  const { postData, loading: submitting } = usePost();

  const resetForm = () => {
    setComSno(''); setDivSno(''); setBrnSno(''); setDeptSno('');
    setAgreementSno(''); setPeriodStart(''); setPeriodEnd('');
    setInvoiceNo(''); setInvoiceDate(''); setInvoiceAmount('');
    setRemarks(''); setDocument(null);
  };

  const handleSubmit = async () => {
    if (!comSno || !divSno || !brnSno || !deptSno) {
      toast.error('Company, Division, Branch and Department are required');
      return;
    }
    if (!agreementSno) {
      toast.error('Select the ceiling Service Agreement this bill is against');
      return;
    }
    if (!periodStart || !periodEnd) {
      toast.error('Billing period start and end dates are required');
      return;
    }
    if (new Date(periodEnd) < new Date(periodStart)) {
      toast.error('Billing period end date must not be before the start date');
      return;
    }
    if (!invoiceAmount || Number(invoiceAmount) <= 0) {
      toast.error('Enter a valid invoice amount');
      return;
    }
    if (!document) {
      toast.error('Upload the invoice document');
      return;
    }

    // Flat multipart fields — matches ServiceBillRequest.controller.js's
    // createServiceBillRequest contract exactly.
    const formData = new FormData();
    formData.append('agreement_sno', agreementSno);
    formData.append('billing_period_start', periodStart);
    formData.append('billing_period_end', periodEnd);
    if (invoiceNo) formData.append('invoice_no', invoiceNo);
    if (invoiceDate) formData.append('invoice_date', invoiceDate);
    formData.append('invoice_amount', invoiceAmount);
    if (remarks) formData.append('remarks', remarks);
    formData.append('invoice_document', document);

    try {
      const result = await postData(createServiceBillRequest, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const created = (result as any)?.data;
      toast.success(`Service bill request ${created?.request_no ?? ''} submitted for approval`);
      resetForm();
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to submit service bill request');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={Receipt}
        title="Service Bill Requests"
        description="Variable-recurring services (e.g. electricity, AWS) — enter this cycle's actual invoice value for approval, capped by the ceiling Service Agreement"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-6">
            <FormSection icon={Plus} title="New bill request">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Company</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={comSno}
                    onChange={(e) => { setComSno(e.target.value); setDivSno(''); setBrnSno(''); setDeptSno(''); setAgreementSno(''); }}
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
                    onChange={(e) => { setDivSno(e.target.value); setBrnSno(''); setDeptSno(''); setAgreementSno(''); }}
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
                    onChange={(e) => { setBrnSno(e.target.value); setDeptSno(''); setAgreementSno(''); }}
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
                    onChange={(e) => { setDeptSno(e.target.value); setAgreementSno(''); }}
                  >
                    <option value="">Select department…</option>
                    {deptOptions.map((d: CascadeOption) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <Label>Ceiling Service Agreement</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={agreementSno}
                    onChange={(e) => setAgreementSno(e.target.value)}
                    disabled={!scopeReady}
                  >
                    <option value="">
                      {!scopeReady ? 'Select company/division/branch/department first…' : agreementsLoading ? 'Loading…' : 'Select agreement…'}
                    </option>
                    {eligibleAgreements.map((a) => (
                      <option key={a.agreement_sno} value={a.agreement_sno}>
                        {a.agreement_no} · {a.service_name} · ceiling ₹{Number(a.ceiling_amount).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                  {scopeReady && !agreementsLoading && eligibleAgreements.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No Approved, in-period Variable Recurring ceiling agreement for this scope — create and approve one on the Service Agreements page first.
                    </p>
                  )}
                  {selectedAgreement && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedAgreement.vendor_name || 'No vendor'} · tolerance {selectedAgreement.variance_tolerance_pct}% ·{' '}
                      {selectedAgreement.cadence_name || selectedAgreement.period_start_date} ·{' '}
                      valid {String(selectedAgreement.period_start_date).slice(0, 10)} → {String(selectedAgreement.period_end_date).slice(0, 10)}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Billing period start</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label>Billing period end</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                <div>
                  <Label>Invoice number (optional)</Label>
                  <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV-2026-1042" />
                </div>
                <div>
                  <Label>Invoice date (optional)</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>

                <div>
                  <Label>Invoice amount</Label>
                  <Input type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="e.g. 42500" />
                  {selectedAgreement && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ceiling ₹{Number(selectedAgreement.ceiling_amount).toLocaleString('en-IN')} (+{selectedAgreement.variance_tolerance_pct}% tolerance)
                    </p>
                  )}
                </div>
                <div>
                  <Label>Invoice document</Label>
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
            <CardTitle className="text-base">Service Bill Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No service bill requests yet.</p>
            ) : (
              <div className="space-y-2">
                {requests.map((r: any) => (
                  <div key={r.bill_request_sno} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-semibold">{r.request_no} · {r.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.vendor_name || 'No vendor'} · ₹{Number(r.invoice_amount).toLocaleString('en-IN')} ·{' '}
                        {String(r.billing_period_start).slice(0, 10)} → {String(r.billing_period_end).slice(0, 10)}
                        {r.po_no ? ` · PO ${r.po_no}` : ''}
                      </p>
                    </div>
                    <Badge className="text-xs">
                      {r.status === 'A' ? 'Approved' : r.status === 'R' ? 'Rejected' : 'Pending'}
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

export default ServiceBillRequestPage;
