import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader, FormSection } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useAppState } from '@/globalState/hooks/useAppState';
import {
  getPendingServicePOsForServiceEntry,
  createServiceEntry,
  getAllServiceEntries,
} from '@/Services/Api';
import { toast } from 'sonner';

interface PendingPO {
  po_basic_sno: number;
  po_no: string;
  vendor_name: string;
  service_type_code: string;
  ceiling_amount?: number;
  consumed_amount?: number;
  variance_tolerance_pct?: number;
  items: string; // JSON string
}

const ServiceEntryPage: React.FC = () => {
  const { userData } = useAppState();
  const currentUser = Array.isArray(userData) ? userData[0] : userData;

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPo, setSelectedPo] = useState<PendingPO | null>(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [usageReference, setUsageReference] = useState('');
  const [confirmedAmounts, setConfirmedAmounts] = useState<Record<number, string>>({});

  const { data: poData } = useFetch<{ success: boolean; data: PendingPO[] }>(getPendingServicePOsForServiceEntry, '', null, refreshKey);
  const pendingPOs = poData?.data ?? [];

  const { data: entriesData, loading: entriesLoading } = useFetch<{ success: boolean; data: any[] }>(getAllServiceEntries, '', null, refreshKey);
  const entries = entriesData?.data ?? [];

  const poItems = useMemo(() => {
    if (!selectedPo) return [];
    try { return JSON.parse(selectedPo.items || '[]'); } catch { return []; }
  }, [selectedPo]);

  const totalConfirmed = useMemo(
    () => Object.values(confirmedAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [confirmedAmounts]
  );
  const totalBudgeted = useMemo(
    () => poItems.reduce((sum: number, i: any) => sum + (Number(i.net_cost) || 0), 0),
    [poItems]
  );
  const previewVariancePct = totalBudgeted > 0 ? ((totalConfirmed - totalBudgeted) / totalBudgeted) * 100 : null;
  const willEscalate = selectedPo?.variance_tolerance_pct != null && previewVariancePct != null
    && Math.abs(previewVariancePct) > selectedPo.variance_tolerance_pct;

  const { postData, loading: submitting } = usePost();

  const handleSelectPo = (po: PendingPO) => {
    setSelectedPo(po);
    setConfirmedAmounts({});
  };

  const handleSubmit = async () => {
    if (!selectedPo) return;
    const items = poItems
      .filter((i: any) => confirmedAmounts[i.po_item_sno])
      .map((i: any) => ({
        po_item_sno: i.po_item_sno,
        service_sno: i.service_sno,
        confirmed_amount: Number(confirmedAmounts[i.po_item_sno] || 0),
      }));
    if (items.length === 0) {
      toast.error('Enter a confirmed amount for at least one line');
      return;
    }
    try {
      const result: any = await postData(createServiceEntry, {
        po_basic_sno: selectedPo.po_basic_sno,
        period_from: periodFrom,
        period_to: periodTo,
        usage_reference: usageReference,
        com_sno: currentUser?.com_sno,
        div_sno: currentUser?.div_sno,
        brn_sno: currentUser?.brn_sno,
        dept_sno: currentUser?.dept_sno,
        items,
      });
      const created = result?.data;
      toast.success(
        created?.status === 'Approved'
          ? `Service Entry #${created.service_entry_no} auto-approved`
          : `Service Entry #${created.service_entry_no} routed for variance approval`
      );
      setSelectedPo(null);
      setConfirmedAmounts({});
      setPeriodFrom(''); setPeriodTo(''); setUsageReference('');
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to create Service Entry');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader icon={ClipboardCheck} title="Service Entry" description="Confirm usage/consumption for a Service PO period — the GRN-equivalent for services" />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-6">
            <FormSection icon={ClipboardCheck} title="1. Select a Service PO">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pendingPOs.map(po => (
                  <div
                    key={po.po_basic_sno}
                    onClick={() => handleSelectPo(po)}
                    className={`cursor-pointer rounded-lg border p-3 ${selectedPo?.po_basic_sno === po.po_basic_sno ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <p className="text-sm font-semibold">{po.po_no}</p>
                    <p className="text-xs text-muted-foreground">{po.vendor_name} · {po.service_type_code}</p>
                    {po.ceiling_amount != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ₹{Number(po.consumed_amount ?? 0).toLocaleString('en-IN')} / ₹{Number(po.ceiling_amount).toLocaleString('en-IN')} consumed
                      </p>
                    )}
                  </div>
                ))}
                {pendingPOs.length === 0 && <p className="text-sm text-muted-foreground">No approved Service POs found.</p>}
              </div>
            </FormSection>

            {selectedPo && (
              <>
                <FormSection icon={ClipboardCheck} title="2. Period & confirmed usage">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div><Label>Period From</Label><Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} /></div>
                    <div><Label>Period To</Label><Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} /></div>
                    <div><Label>Usage Reference</Label><Input value={usageReference} onChange={e => setUsageReference(e.target.value)} placeholder="e.g. AWS billing cycle Aug" /></div>
                  </div>
                  <div className="space-y-2">
                    {poItems.map((item: any) => (
                      <div key={item.po_item_sno} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{item.service_name}</p>
                          <p className="text-xs text-muted-foreground">Budgeted: ₹{Number(item.net_cost || 0).toLocaleString('en-IN')}</p>
                        </div>
                        <Input
                          type="number" className="w-40"
                          value={confirmedAmounts[item.po_item_sno] || ''}
                          onChange={e => setConfirmedAmounts(prev => ({ ...prev, [item.po_item_sno]: e.target.value }))}
                          placeholder="Confirmed amount"
                        />
                      </div>
                    ))}
                  </div>
                </FormSection>

                {totalBudgeted > 0 && totalConfirmed > 0 && (
                  <div className={`rounded-lg border p-3 flex items-center gap-2 text-sm ${willEscalate ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-green-300 bg-green-50 text-green-800'}`}>
                    {willEscalate ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    Variance: {previewVariancePct?.toFixed(2)}%
                    {willEscalate
                      ? ` — exceeds ${selectedPo?.variance_tolerance_pct}% tolerance, will route for approval`
                      : ' — within tolerance, will auto-approve'}
                  </div>
                )}

                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Submit Service Entry
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader><CardTitle className="text-base">Service Entries</CardTitle></CardHeader>
          <CardContent>
            {entriesLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Service Entries yet.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((se: any) => (
                  <div key={se.service_entry_sno} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-semibold">#{se.service_entry_no} · {se.po_no}</p>
                      <p className="text-xs text-muted-foreground">{se.vendor_name} · ₹{Number(se.confirmed_amount).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {se.variance_status && se.variance_status !== 'N/A' && (
                        <Badge variant="outline" className="text-xs">{se.variance_status} ({Number(se.variance_pct ?? 0).toFixed(1)}%)</Badge>
                      )}
                      <Badge className="text-xs">{se.status}</Badge>
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

export default ServiceEntryPage;
