import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Building2, FileText, Landmark, Loader2, MapPin, Paperclip, Plus, Send, ShieldCheck, Trash2, Users, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Callout, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { apiPublicKycResubmitSave } from '@/Services/Api';
import {
  FILE_ACCEPT, blankAddress, blankBank, blankContact, buildForm, buildRequest, contentProblem, ensurePrimary, fileProblem, formProblem,
  withPrimary, type AddressRow, type BankRow, type ContactRow, type ResubmitData, type ResubmitForm,
} from './kycResubmitModel';

const MSME_TYPES = ['Micro', 'Small', 'Medium'];
const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60';

const Field: React.FC<{ id: string; label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }> = ({
  id, label, required, hint, className, children,
}) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}{required && <span className="text-destructive"> *</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const Text: React.FC<{
  id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string; className?: string;
  max?: number; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; type?: string; upper?: boolean;
}> = ({ id, label, value, onChange, required, hint, className, max, placeholder, inputMode, type = 'text', upper }) => (
  <Field id={id} label={label} required={required} hint={hint} className={className}>
    <Input id={id} type={type} value={value} maxLength={max} placeholder={placeholder} inputMode={inputMode}
      className={upper ? 'uppercase' : undefined} onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)} />
  </Field>
);

const Choice: React.FC<{ id: string; value: boolean; onChange: (v: boolean) => void; yes: string; no: string }> = ({ id, value, onChange, yes, no }) => (
  <div className="flex gap-4" role="radiogroup" aria-labelledby={`${id}-label`}>
    {[{ v: true, t: yes }, { v: false, t: no }].map((o) => (
      <label key={o.t} className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input type="radio" name={id} checked={value === o.v} onChange={() => onChange(o.v)} className="h-4 w-4 accent-[var(--primary)]" />
        {o.t}
      </label>
    ))}
  </div>
);

const PrimaryRadio: React.FC<{ name: string; checked: boolean; onChange: () => void; label: string }> = ({ name, checked, onChange, label }) => (
  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
    <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--primary)]" />
    {label}
    {checked && <StatusPill tone="primary">Primary</StatusPill>}
  </label>
);

/** Choose files. A file that cannot be uploaded is refused on the spot, with the reason (type, size, and what is really inside). */
const FilePick: React.FC<{
  id: string; label: string; files: File[]; max: number; maxMb: number; onChange: (files: File[]) => void; required?: boolean; hint?: string;
  existing?: React.ReactNode;
}> = ({ id, label, files, max, maxMb, onChange, required, hint, existing }) => {
  const add = async (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const f of Array.from(picked)) {
      const problem = fileProblem(f, maxMb) || (await contentProblem(f));
      if (problem) { toast.error(problem); continue; }
      if (next.length >= max) { toast.error(`You can add at most ${max} file${max > 1 ? 's' : ''} here.`); break; }
      next.push(f);
    }
    onChange(next);
  };
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      {existing}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted', files.length >= max && 'pointer-events-none opacity-50')}>
          <Paperclip className="h-4 w-4" /> {files.length ? 'Add another' : 'Choose file'}
        </label>
        <input id={id} type="file" accept={FILE_ACCEPT} multiple={max > 1} className="sr-only" disabled={files.length >= max}
          onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 py-1 pl-2 pr-1 text-xs">
            <span className="truncate">{f.name}</span>
            <button type="button" aria-label={`Remove ${f.name}`} className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange(files.filter((_, j) => j !== i))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    </Field>
  );
};

interface Props {
  data: ResubmitData;
  token: string;
  /** Saved: the page shows its thank-you. */
  onDone: (message: string) => void;
  /** The server says this link can no longer be used (spent, replaced, expired): the page switches to that message. */
  onLinkGone: (message: string) => void;
}

/** Everything the supplier can correct, prefilled with the KYC as it is on file. Nothing is saved until Send. */
const KycResubmitForm: React.FC<Props> = ({ data, token, onDone, onLinkGone }) => {
  const [form, setForm] = useState<ResubmitForm>(() => buildForm(data));
  const [docs, setDocs] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const maxMb = data.uploads.max_mb;
  const set = (patch: Partial<ResubmitForm>) => setForm((f) => ({ ...f, ...patch }));
  const setAddress = (key: string, patch: Partial<AddressRow>) => set({ addresses: form.addresses.map((a) => (a.key === key ? { ...a, ...patch } : a)) });
  const setBank = (key: string, patch: Partial<BankRow>) => set({ banks: form.banks.map((a) => (a.key === key ? { ...a, ...patch } : a)) });
  const setContact = (key: string, patch: Partial<ContactRow>) => set({ contacts: form.contacts.map((a) => (a.key === key ? { ...a, ...patch } : a)) });

  const { business_types, account_types, supplier_categories } = data.choices;
  // a value already on file stays selectable even if the master has since retired it
  const withCurrent = (list: { value: string; label: string }[], v: string) => (v && !list.some((o) => o.value === v) ? [{ value: v, label: v }, ...list] : list);
  const typeOptions = useMemo(() => withCurrent(business_types, form.business_type), [business_types, form.business_type]);
  const categoryOptions = useMemo(() => withCurrent(supplier_categories, form.supplier_cat_code), [supplier_categories, form.supplier_cat_code]);

  const onFile = (type: string) => data.documents.filter((d) => d.document_type === type);
  const hasPan = onFile('pan_file').length > 0 || (docs.pan_file?.length ?? 0) > 0;
  const fileCount = Object.values(docs).reduce((n, l) => n + l.length, 0);

  const choosePayMode = (portal: boolean) => set({ pay_via_portal: portal, banks: !portal && form.banks.length === 0 ? [blankBank(true)] : form.banks });

  const fail = (message: string) => {
    setError(message);
    requestAnimationFrame(() => document.getElementById('resubmit-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const submit = async () => {
    setError('');
    const problem = formProblem(form, hasPan);
    if (problem) return fail(problem);

    setSubmitting(true);
    try {
      const res = await axios.post(apiPublicKycResubmitSave, buildRequest(token, form, docs));
      onDone(res.data?.message ?? 'Your corrected KYC has been sent for approval.');
    } catch (err) {
      const message = getErrorMessage(err, 'Could not send your KYC. Please try again.');
      if (axios.isAxiosError(err) && err.response?.status === 410) onLinkGone(message);
      else fail(message);
    } finally {
      setSubmitting(false);
    }
  };

  const otherSlot = data.uploads.fields.find((f) => f.type === 'other_file');
  const slots = data.uploads.fields.filter((f) => f.type !== 'other_file');

  return (
    <div className="space-y-4">
      {/* ── company ── */}
      <Panel icon={Building2} title="Company details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Text id="company_name" label="Company name" required max={50} value={form.company_name} onChange={(v) => set({ company_name: v })} />
          <Text id="legal_name" label="Legal name" max={100} value={form.legal_name} onChange={(v) => set({ legal_name: v })} />
          <Text id="trade_name" label="Trade name" max={100} value={form.trade_name} onChange={(v) => set({ trade_name: v })} />
          <Field id="business_type" label="Business type" required>
            <select id="business_type" className={selectCls} value={form.business_type} onChange={(e) => set({ business_type: e.target.value })}>
              <option value="">Select…</option>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {categoryOptions.length > 0 && (
            <Field id="supplier_cat_code" label="Supplier category" required>
              <select id="supplier_cat_code" className={selectCls} value={form.supplier_cat_code} onChange={(e) => set({ supplier_cat_code: e.target.value })}>
                <option value="">Select…</option>
                {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}
          <Text id="contact_person" label="Contact person" required max={50} value={form.contact_person} onChange={(v) => set({ contact_person: v })} />
          <Text id="mobile_number" label="Mobile" required max={15} inputMode="tel" value={form.mobile_number} onChange={(v) => set({ mobile_number: v })} />
          <Text id="email" label="Email" required max={50} type="email" value={form.email} onChange={(v) => set({ email: v })} />
          <Text id="pan_no" label="PAN" required max={10} upper value={form.pan_no} onChange={(v) => set({ pan_no: v })} hint="10 characters, e.g. ABCDE1234F" />

          <div className="space-y-2">
            <p id="gst-label" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">GST registered</p>
            <Choice id="gst" value={form.is_gst_avail} onChange={(v) => set({ is_gst_avail: v })} yes="Yes" no="No" />
            {form.is_gst_avail && (
              <Text id="gst_no" label="GST number" required max={20} upper value={form.gst_no} onChange={(v) => set({ gst_no: v })}
                hint="15 characters. Characters 3 to 12 must be your PAN." />
            )}
          </div>
          <div className="space-y-2">
            <p id="msme-label" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">MSME registered</p>
            <Choice id="msme" value={form.is_msme_avail} onChange={(v) => set({ is_msme_avail: v })} yes="Yes" no="No" />
            {form.is_msme_avail && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text id="msme_no" label="MSME (Udyam) number" required max={20} upper value={form.msme_no} onChange={(v) => set({ msme_no: v })} />
                <Field id="msme_type" label="MSME type">
                  <select id="msme_type" className={selectCls} value={form.msme_type} onChange={(e) => set({ msme_type: e.target.value })}>
                    <option value="">Select…</option>
                    {MSME_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* ── addresses ── */}
      <Panel icon={MapPin} title={`Addresses (${form.addresses.length})`} description="Your registered office and other places of business."
        action={<Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => set({ addresses: [...form.addresses, blankAddress(form.addresses.length === 0)] })}><Plus className="h-4 w-4" />Add</Button>}>
        <ul className="space-y-3">
          {form.addresses.map((a, i) => (
            <li key={a.key} className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <PrimaryRadio name="primary-address" checked={a.is_primary} label={`Address ${i + 1}`} onChange={() => set({ addresses: withPrimary(form.addresses, a.key) })} />
                <Button type="button" size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" disabled={form.addresses.length <= 1}
                  onClick={() => set({ addresses: ensurePrimary(form.addresses.filter((x) => x.key !== a.key)) })}>
                  <Trash2 className="h-4 w-4" />Remove
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Text id={`${a.key}-door`} label="Door / building" required max={300} value={a.door_no} onChange={(v) => setAddress(a.key, { door_no: v })} className="sm:col-span-2" />
                <Text id={`${a.key}-street`} label="Street" required max={200} value={a.street} onChange={(v) => setAddress(a.key, { street: v })} />
                <Text id={`${a.key}-area`} label="Area" required max={200} value={a.area} onChange={(v) => setAddress(a.key, { area: v })} />
                <Text id={`${a.key}-city`} label="City" required max={200} value={a.city} onChange={(v) => setAddress(a.key, { city: v })} />
                <Text id={`${a.key}-taluk`} label="Taluk" max={200} value={a.taluk} onChange={(v) => setAddress(a.key, { taluk: v })} />
                <Text id={`${a.key}-state`} label="State" required max={200} value={a.state} onChange={(v) => setAddress(a.key, { state: v })} />
                <Text id={`${a.key}-state_code`} label="State code" max={2} inputMode="numeric" value={a.state_code} hint="2-digit GST state code, e.g. 33"
                  onChange={(v) => setAddress(a.key, { state_code: v.replace(/\D/g, '') })} />
                <Text id={`${a.key}-pincode`} label="Pincode" required max={6} inputMode="numeric" value={a.pincode}
                  onChange={(v) => setAddress(a.key, { pincode: v.replace(/\D/g, '') })} />
                <Text id={`${a.key}-map`} label="Map link" max={500} value={a.location_link} placeholder="https://maps.google.com/…" onChange={(v) => setAddress(a.key, { location_link: v })} className="sm:col-span-3" />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ── how you are paid ── */}
      <Panel icon={form.pay_via_portal ? Wallet : Landmark} title="How you are paid">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2" role="radiogroup" aria-label="How you are paid">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="pay-mode" checked={!form.pay_via_portal} onChange={() => choosePayMode(false)} className="h-4 w-4 accent-[var(--primary)]" />
            Bank transfer to my bank account
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="pay-mode" checked={form.pay_via_portal} onChange={() => choosePayMode(true)} className="h-4 w-4 accent-[var(--primary)]" />
            Through my own website / portal
          </label>
        </div>

        {form.pay_via_portal ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Text id="portal_name" label="Portal name" required max={150} value={form.payment_portal_name} onChange={(v) => set({ payment_portal_name: v })} />
            <Text id="portal_url" label="Portal web address" required max={500} placeholder="https://" value={form.payment_portal_url} onChange={(v) => set({ payment_portal_url: v })} />
            <Field id="portal_instr" label="Payment instructions" className="sm:col-span-2">
              <Textarea id="portal_instr" rows={3} maxLength={1000} value={form.payment_instructions} onChange={(e) => set({ payment_instructions: e.target.value })} />
            </Field>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {form.banks.map((k, i) => (
                <li key={k.key} className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <PrimaryRadio name="primary-bank" checked={k.is_primary} label={`Bank account ${i + 1}`} onChange={() => set({ banks: withPrimary(form.banks, k.key) })} />
                    <Button type="button" size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" disabled={form.banks.length <= 1}
                      onClick={() => set({ banks: ensurePrimary(form.banks.filter((x) => x.key !== k.key)) })}>
                      <Trash2 className="h-4 w-4" />Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Text id={`${k.key}-holder`} label="Account holder name" required max={50} value={k.ac_holder_name} onChange={(v) => setBank(k.key, { ac_holder_name: v })} />
                    <Text id={`${k.key}-no`} label="Account number" required max={18} inputMode="numeric" value={k.ac_number}
                      onChange={(v) => setBank(k.key, { ac_number: v.replace(/\D/g, '') })} />
                    <Field id={`${k.key}-type`} label="Account type" required>
                      <select id={`${k.key}-type`} className={selectCls} value={k.ac_type} onChange={(e) => setBank(k.key, { ac_type: e.target.value })}>
                        <option value="">Select…</option>
                        {withCurrent(account_types, k.ac_type).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Text id={`${k.key}-ifsc`} label="IFSC" required max={11} upper value={k.ifsc} onChange={(v) => setBank(k.key, { ifsc: v })} />
                    <Text id={`${k.key}-bank`} label="Bank" required max={50} value={k.bank_name} onChange={(v) => setBank(k.key, { bank_name: v })} />
                    <Text id={`${k.key}-branch`} label="Branch" required max={50} value={k.bank_branch_name} onChange={(v) => setBank(k.key, { bank_branch_name: v })} />
                    <Text id={`${k.key}-addr`} label="Bank address" required max={300} value={k.bank_address} onChange={(v) => setBank(k.key, { bank_address: v })} className="sm:col-span-3" />
                  </div>
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" variant="outline" className="mt-3 gap-1" onClick={() => set({ banks: [...form.banks, blankBank(form.banks.length === 0)] })}>
              <Plus className="h-4 w-4" />Add bank account
            </Button>
            <Callout tone="warning" className="mt-3">
              Payments are made to the primary bank account. Check the account number and IFSC carefully - a wrong account sends your money to someone else.
            </Callout>
          </>
        )}
      </Panel>

      {/* ── contacts ── */}
      <Panel icon={Users} title={`Contacts (${form.contacts.length})`}
        action={<Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => set({ contacts: [...form.contacts, blankContact(form.contacts.length === 0)] })}><Plus className="h-4 w-4" />Add</Button>}>
        <ul className="space-y-3">
          {form.contacts.map((c, i) => (
            <li key={c.key} className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <PrimaryRadio name="primary-contact" checked={c.is_primary} label={`Contact ${i + 1}`} onChange={() => set({ contacts: withPrimary(form.contacts, c.key) })} />
                <Button type="button" size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" disabled={form.contacts.length <= 1}
                  onClick={() => set({ contacts: ensurePrimary(form.contacts.filter((x) => x.key !== c.key)) })}>
                  <Trash2 className="h-4 w-4" />Remove
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text id={`${c.key}-name`} label="Name" required max={50} value={c.contact_name} onChange={(v) => setContact(c.key, { contact_name: v })} />
                <Text id={`${c.key}-pos`} label="Position" max={50} value={c.contact_position} onChange={(v) => setContact(c.key, { contact_position: v })} />
                <Text id={`${c.key}-mobile`} label="Mobile" required max={15} inputMode="tel" value={c.contact_mobile} onChange={(v) => setContact(c.key, { contact_mobile: v })} />
                <Text id={`${c.key}-email`} label="Email" required max={50} type="email" value={c.contact_email} onChange={(v) => setContact(c.key, { contact_email: v })} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ── documents ── */}
      <Panel icon={FileText} title="Documents" description={`PDF or picture (${data.uploads.allowed}), up to ${maxMb} MB each. Upload a new copy only for what was wrong - a new copy replaces the one on file.`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {slots.map((slot) => {
            const current = onFile(slot.type);
            return (
              <FilePick key={slot.type} id={`doc-${slot.type}`} label={slot.label} max={1} maxMb={maxMb} required={slot.type === 'pan_file' && current.length === 0}
                files={docs[slot.type] ?? []} onChange={(files) => setDocs((d) => ({ ...d, [slot.type]: files }))}
                hint={current.length ? undefined : slot.type === 'pan_file' ? 'Required - none on file.' : 'None on file.'}
                existing={current.length ? (
                  <ul className="mb-2 space-y-1">
                    {current.map((d) => (
                      <li key={`${d.document_name}-${d.uploaded_date}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> On file: <span className="truncate font-medium text-foreground">{d.document_name}</span>
                      </li>
                    ))}
                  </ul>
                ) : null} />
            );
          })}
          {otherSlot && (
            <FilePick id="doc-other_file" label={otherSlot.label} max={3} maxMb={maxMb}
              files={docs.other_file ?? []} onChange={(files) => setDocs((d) => ({ ...d, other_file: files }))} />
          )}
        </div>
      </Panel>

      {/* ── note + send ── */}
      <Panel icon={Send} title="Send for approval">
        <div className="space-y-4">
          <Field id="note" label="What did you correct? (optional)" hint="A short note helps our team review it faster.">
            <Textarea id="note" rows={3} maxLength={500} value={form.note} placeholder="e.g. Uploaded a clear PAN card and corrected the bank account number."
              onChange={(e) => set({ note: e.target.value })} />
          </Field>
          {error && <div id="resubmit-error"><Callout tone="danger"><span role="alert">{error}</span></Callout></div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {fileCount > 0 ? `${fileCount} file${fileCount > 1 ? 's' : ''} will be security-checked and uploaded.` : 'No new files selected.'}
            </p>
            <Button type="button" onClick={() => void submit()} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Sending…' : 'Send corrected KYC'}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default KycResubmitForm;
