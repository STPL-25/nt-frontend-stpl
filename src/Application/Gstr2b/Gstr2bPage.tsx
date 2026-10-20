import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FileSpreadsheet, RefreshCw, Upload, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FormSection, PageHeader } from '@/CustomComponent/PageComponents';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { useAppSelector } from '@/globalState/hooks/useAppState';
import { selectCompanyHierarchy, type HierarchyResponse } from '@/globalState/features/hierarchyCompanyDetailsSlice';
import { getErrorMessage } from '@/lib/errors';
import {
  gstr2bUpload, gstr2bUploads, gstr2bUploadDetail, gstr2bCandidates, gstr2bConfirm, gstr2bSkip, gstr2bMissing, gstr2bHoldOverride,
  type Gstr2bSummary, type Gstr2bRow, type Gstr2bCandidate, type MissingIn2B,
} from '@/Services/GrnService/gstr2bApi';

const SCREEN = 'Gstr2bPage';
const money = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const periodLabel = (p: string) => `${p.slice(0, 2)}/${p.slice(2)}`;
const thisPeriod = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
};

type Tab = 'Matched' | 'Mismatch' | 'Unmatched' | 'Added' | 'Info' | 'Missing';

const TAB_LABEL: Record<Tab, string> = {
  Matched: 'Matched', Mismatch: 'Mismatch', Unmatched: 'Not in books', Added: 'Added', Info: 'Notes', Missing: 'Missing in 2B',
};

/** Accounts: upload GSTR-2B, review matches, add invoices missing from the books, release payment holds. */
const Gstr2bPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();
  const companies = ((useAppSelector(selectCompanyHierarchy) as HierarchyResponse | null)?.companies ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploads, setUploads] = useState<Gstr2bSummary[]>([]);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [rows, setRows] = useState<Gstr2bRow[]>([]);
  const [missing, setMissing] = useState<MissingIn2B[]>([]);
  const [tab, setTab] = useState<Tab>('Unmatched');
  const [loading, setLoading] = useState(false);

  const [period, setPeriod] = useState(thisPeriod());
  const [comSno, setComSno] = useState('');
  const [uploading, setUploading] = useState(false);

  const [pick, setPick] = useState<Gstr2bRow | null>(null);
  const [candidates, setCandidates] = useState<Gstr2bCandidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const [holdFor, setHoldFor] = useState<MissingIn2B | null>(null);
  const [holdReason, setHoldReason] = useState('');

  const loadUploads = useCallback(async (selectLatest = false) => {
    const res = await axios.get(gstr2bUploads);
    const list: Gstr2bSummary[] = res.data?.data ?? [];
    setUploads(list);
    if (selectLatest || (uploadId == null && list.length)) setUploadId(list[0]?.upload_sno ?? null);
  }, [uploadId]);

  const loadRows = useCallback(async (id: number | null) => {
    if (id == null) { setRows([]); return; }
    const res = await axios.get(gstr2bUploadDetail(id));
    setRows(res.data?.data?.rows ?? []);
  }, []);

  const loadMissing = useCallback(async () => {
    const res = await axios.get(gstr2bMissing);
    setMissing(res.data?.data ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadUploads(), loadRows(uploadId), loadMissing()]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load GSTR-2B data'));
    } finally {
      setLoading(false);
    }
  }, [loadUploads, loadRows, loadMissing, uploadId]);

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [uploadId]);

  const current = uploads.find(u => u.upload_sno === uploadId) ?? null;
  const byStatus = useMemo(() => {
    const g = (s: string) => rows.filter(r => r.match_status === s);
    return { Matched: g('Matched'), Mismatch: g('Mismatch'), Unmatched: g('Unmatched'), Added: g('Added'), Info: g('Info') };
  }, [rows]);

  const upload = async (file: File) => {
    if (!/^(0[1-9]|1[0-2])\d{4}$/.test(period)) { toast.error('Return period must be MMYYYY, e.g. 102026'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('return_period', period);
      if (comSno) fd.append('com_sno', comSno);
      const res = await axios.post(gstr2bUpload, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const s: Gstr2bSummary = res.data?.data?.summary;
      toast.success(`Loaded ${s.row_count} rows: ${s.matched} matched, ${s.mismatch} mismatch, ${s.unmatched} not in books`);
      await loadUploads(true);
      if (s.unmatched > 0) setTab('Unmatched');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openPick = async (r: Gstr2bRow) => {
    setPick(r);
    setCandidates([]);
    setCandLoading(true);
    try {
      const res = await axios.get(gstr2bCandidates(r.row_sno));
      setCandidates(res.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to search suppliers'));
    } finally {
      setCandLoading(false);
    }
  };

  const confirm = async (c: Gstr2bCandidate) => {
    if (!pick) return;
    setWorking(true);
    try {
      await axios.post(gstr2bConfirm(pick.row_sno), { vendor_sno: c.vendor_sno });
      toast.success(`Invoice ${pick.invoice_no} added under ${c.company_name ?? c.legal_name}`);
      setPick(null);
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add the invoice'));
    } finally {
      setWorking(false);
    }
  };

  const skip = async (r: Gstr2bRow) => {
    try {
      await axios.post(gstr2bSkip(r.row_sno), {});
      toast.success(`${r.invoice_no} skipped`);
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to skip'));
    }
  };

  const saveOverride = async (inv: MissingIn2B, override: 'Y' | 'N', reason = '') => {
    setWorking(true);
    try {
      await axios.post(gstr2bHoldOverride(inv.invoice_sno), { override, reason });
      toast.success(override === 'Y' ? `${inv.invoice_no}: payment hold released` : `${inv.invoice_no}: hold restored`);
      setHoldFor(null);
      setHoldReason('');
      await loadMissing();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update the hold'));
    } finally {
      setWorking(false);
    }
  };

  const counts: Record<Tab, number> = {
    Matched: byStatus.Matched.length, Mismatch: byStatus.Mismatch.length, Unmatched: byStatus.Unmatched.length,
    Added: byStatus.Added.length, Info: byStatus.Info.length, Missing: missing.length,
  };

  const empty = (text: string) => (
    <div className="text-center py-10 text-muted-foreground border rounded-xl bg-muted/10">
      <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm">{text}</p>
    </div>
  );

  const invoiceTable = (list: Gstr2bRow[], actions: boolean) => list.length === 0 ? empty('Nothing here') : (
    <div className="border rounded-xl overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs">Supplier</TableHead>
            <TableHead className="text-xs">GSTIN</TableHead>
            <TableHead className="text-xs">Invoice</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs text-right">Invoice value</TableHead>
            <TableHead className="text-xs text-right">Taxable</TableHead>
            <TableHead className="text-xs text-right">GST</TableHead>
            <TableHead className="text-xs">ITC</TableHead>
            <TableHead className="text-xs">Books</TableHead>
            {actions && <TableHead className="w-44" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(r => (
            <TableRow key={r.row_sno}>
              <TableCell className="text-xs">{r.trade_name ?? '—'}</TableCell>
              <TableCell className="text-xs font-mono">{r.supplier_gstin}</TableCell>
              <TableCell className="text-xs font-medium">{r.invoice_no}</TableCell>
              <TableCell className="text-xs">{r.invoice_date ?? '—'}</TableCell>
              <TableCell className="text-xs text-right">₹{money(r.invoice_value)}</TableCell>
              <TableCell className="text-xs text-right">₹{money(r.taxable_value)}</TableCell>
              <TableCell className="text-xs text-right">₹{money(r.igst + r.cgst + r.sgst)}</TableCell>
              <TableCell>
                {r.itc_available === 'No'
                  ? <Badge variant="destructive" className="text-[10px]" title={r.itc_reason ?? ''}>No ITC</Badge>
                  : <span className="text-xs">{r.itc_available ?? '—'}</span>}
              </TableCell>
              <TableCell className="text-xs">
                {r.books_invoice_no ? <>{r.books_invoice_no}{r.books_amount != null && <> · ₹{money(r.books_amount)}</>}</> : '—'}
                {r.mismatch_note && <p className="mt-1 text-amber-700">{r.mismatch_note}</p>}
              </TableCell>
              {actions && (
                <TableCell className="text-right whitespace-nowrap">
                  {r.match_status === 'Unmatched' && canEdit(SCREEN) && (
                    <>
                      <Button size="sm" className="h-7 text-xs" onClick={() => openPick(r)}>Find supplier</Button>
                      <Button size="sm" variant="ghost" className="ml-1 h-7 text-xs" onClick={() => skip(r)}>Skip</Button>
                    </>
                  )}
                  {r.match_status === 'Mismatch' && canEdit(SCREEN) && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => skip(r)}>Dismiss</Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader icon={FileSpreadsheet} title="GSTR-2B Reconciliation" description="Match supplier invoices with your GSTR-2B, claim ITC and release payment holds">
        <Button
          variant="outline" size="sm"
          className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={refresh} disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'mr-1 animate-spin' : 'mr-1'} /> Refresh
        </Button>
      </PageHeader>

      <div className="container mx-auto py-6 px-4 space-y-6">
        {canCreate(SCREEN) && (
          <Card className="shadow-md">
            <CardContent className="pt-6 space-y-4">
              <FormSection icon={Upload} title="Upload GSTR-2B">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
                  <div className="flex flex-col">
                    <CustomInputField
                      field="return_period" label="Return period (MMYYYY)" require type="text"
                      value={period} onChange={(v) => setPeriod(String(v).replace(/\D/g, '').slice(0, 6))} className="h-10"
                    />
                  </div>
                  {companies.length > 0 && (
                    <div className="flex flex-col">
                      <CustomInputField
                        field="com_sno" label="Company" type="select"
                        options={companies.map(c => ({ label: c.com_name, value: String(c.com_sno) }))}
                        value={comSno} onChange={(v) => setComSno(String(v))} className="h-10"
                      />
                    </div>
                  )}
                  {uploads.length > 0 && (
                    <div className="flex flex-col">
                      <CustomInputField
                        field="upload" label="Showing upload" type="select"
                        options={uploads.map(u => ({ label: `${periodLabel(u.return_period)} · ${u.file_name ?? 'file'} · ${u.row_count} rows`, value: String(u.upload_sno) }))}
                        value={uploadId != null ? String(uploadId) : ''} onChange={(v) => setUploadId(Number(v))} className="h-10"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    {current
                      ? `Period ${periodLabel(current.return_period)} · uploaded by ${current.uploaded_by ?? '—'} · ${current.matched} matched · ${current.mismatch} mismatch · ${current.unmatched} not in books`
                      : 'Download the GSTR-2B Excel from the GST portal and upload it here.'}
                  </p>
                  <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                  <Button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="h-9">
                    {uploading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? 'Uploading…' : 'Upload GSTR-2B (.xlsx)'}
                  </Button>
                </div>
              </FormSection>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-md">
          <CardContent className="pt-6">
            <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
              <TabsList className="mb-3 flex h-auto flex-wrap justify-start">
                {(Object.keys(TAB_LABEL) as Tab[]).map(t => (
                  <TabsTrigger key={t} value={t}>
                    {TAB_LABEL[t]}
                    <Badge variant={(t === 'Unmatched' || t === 'Mismatch') && counts[t] ? 'destructive' : 'secondary'} className="ml-2 text-xs">{counts[t]}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="Matched">{invoiceTable(byStatus.Matched, false)}</TabsContent>
              <TabsContent value="Mismatch" className="space-y-2">
                <p className="text-xs text-muted-foreground">Same invoice number as in your books, but the amounts differ. Correct the invoice, or dismiss once resolved.</p>
                {invoiceTable(byStatus.Mismatch, true)}
              </TabsContent>
              <TabsContent value="Unmatched" className="space-y-2">
                <p className="text-xs text-muted-foreground">In the supplier's 2B but not in your books. Find the supplier to add the invoice, or skip it.</p>
                {invoiceTable(byStatus.Unmatched, true)}
              </TabsContent>
              <TabsContent value="Added">{invoiceTable(byStatus.Added, false)}</TabsContent>
              <TabsContent value="Info" className="space-y-2">
                <p className="text-xs text-muted-foreground">Supplier credit / debit notes from 2B. Listed for reference — not matched to your notes yet.</p>
                {invoiceTable(byStatus.Info, false)}
              </TabsContent>

              <TabsContent value="Missing" className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Your invoices from GST-registered suppliers that are not in a GSTR-2B yet. They cannot be paid until they appear — or until you release the hold.
                </p>
                {missing.length === 0 ? empty('No invoices waiting for 2B') : (
                  <div className="border rounded-xl overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="text-xs">Supplier</TableHead>
                          <TableHead className="text-xs">GSTIN</TableHead>
                          <TableHead className="text-xs">Our ref</TableHead>
                          <TableHead className="text-xs">Supplier invoice</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Payment</TableHead>
                          <TableHead className="w-36" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missing.map(m => (
                          <TableRow key={m.invoice_sno}>
                            <TableCell className="text-xs">{m.vendor_name ?? '—'}</TableCell>
                            <TableCell className="text-xs font-mono">{m.gst_no}</TableCell>
                            <TableCell className="text-xs font-medium">{m.invoice_no}</TableCell>
                            <TableCell className="text-xs">{m.vendor_invoice_no ?? '—'}</TableCell>
                            <TableCell className="text-xs">{m.invoice_date ?? '—'}</TableCell>
                            <TableCell className="text-xs text-right">₹{money(m.invoice_amount)}</TableCell>
                            <TableCell>
                              {m.payment_hold_override === 'Y'
                                ? <Badge className="bg-green-100 text-green-800 text-[10px]">Hold released</Badge>
                                : <Badge variant="destructive" className="text-[10px]">On hold</Badge>}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {canEdit(SCREEN) && (m.payment_hold_override === 'Y'
                                ? <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={working} onClick={() => saveOverride(m, 'N')}>Restore hold</Button>
                                : <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setHoldFor(m); setHoldReason(''); }}>Release hold</Button>)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* supplier candidates */}
      <Dialog open={pick != null} onOpenChange={o => { if (!o) setPick(null); }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-2xl">
          <DialogHeader className="border-b p-4">
            <DialogTitle>Add invoice {pick?.invoice_no}</DialogTitle>
            {pick && (
              <p className="text-xs text-muted-foreground">
                2B shows {pick.trade_name ?? 'unknown supplier'} · {pick.supplier_gstin} · ₹{money(pick.invoice_value)}. Pick the matching supplier.
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {candLoading && <p className="text-sm text-muted-foreground">Searching suppliers…</p>}
            {!candLoading && candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">No supplier with this GSTIN or a similar name. Register the supplier first, then upload again.</p>
            )}
            <div className="space-y-2">
              {candidates.map(c => (
                <div key={c.vendor_sno} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{c.company_name ?? c.legal_name ?? c.trade_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{c.gst_no ?? 'no GSTIN'}{c.supp_code ? ` · ${c.supp_code}` : ''}</p>
                    {c.gst_no && pick && c.gst_no.toUpperCase() !== pick.supplier_gstin && (
                      <p className="text-xs text-amber-700">GSTIN differs from the 2B row — check before adding.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.score >= 80 ? 'default' : 'secondary'} className="text-xs">{c.matched_on === 'GSTIN' ? 'GSTIN match' : `${c.score}% name`}</Badge>
                    <Button size="sm" className="h-8 text-xs" disabled={working} onClick={() => confirm(c)}>Add under this supplier</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t p-3"><Button variant="ghost" onClick={() => setPick(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* hold override */}
      <Dialog open={holdFor != null} onOpenChange={o => { if (!o) setHoldFor(null); }}>
        <DialogContent className="w-[calc(100%-1rem)] sm:w-full sm:max-w-md">
          <DialogHeader><DialogTitle>Release payment hold</DialogTitle></DialogHeader>
          <p className="text-sm">
            {holdFor?.invoice_no} ({holdFor?.vendor_name}) is not in GSTR-2B yet. Releasing lets it be paid now; the input GST
            stays pending until the supplier files.
          </p>
          <Input placeholder="Reason (required)" value={holdReason} onChange={e => setHoldReason(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHoldFor(null)}>Cancel</Button>
            <Button disabled={!holdReason.trim() || working} onClick={() => holdFor && saveOverride(holdFor, 'Y', holdReason.trim())}>Release hold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gstr2bPage;
