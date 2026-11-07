import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Building2, FileSignature, Landmark, Loader2, MapPin, Paperclip, Plus, Send, Trash2, Users, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Callout, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import {
  supplierAxios, supplierKycModify,
  type SupplierKyc, type SupplierKycChoice,
} from '@/Services/SupplierService';
import {
  DOCUMENT_SLOTS, FILE_ACCEPT, MAX_AUTHORIZATION_FILES, MAX_FILE_MB, MAX_OTHER_DOCUMENTS, MSME_TYPES, OTHER_DOCUMENT,
  blankAddress, blankBank, blankContact, buildForm, changedSections, describeSections, ensurePrimary, fileProblem, toPayload, withPrimary,
  type AddressRow, type BankRow, type ContactRow, type KycForm,
} from './supplierKycModel';
import { FileLink } from './SupplierKycView';

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

/** Choose files; the ones that cannot be used are refused with the reason. */
const FilePick: React.FC<{
  id: string; label: string; files: File[]; max: number; onChange: (files: File[]) => void; required?: boolean; hint?: string; existing?: React.ReactNode;
}> = ({ id, label, files, max, onChange, required, hint, existing }) => {
  const add = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const f of Array.from(picked)) {
      const problem = fileProblem(f);
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
          onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
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

const PrimaryRadio: React.FC<{ name: string; checked: boolean; onChange: () => void; label: string }> = ({ name, checked, onChange, label }) => (
  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
    <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--primary)]" />
    {label}
    {checked && <StatusPill tone="primary">Primary</StatusPill>}
  </label>
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

interface Props {
  kyc: SupplierKyc;
  businessTypes: SupplierKycChoice[];
  accountTypes: SupplierKycChoice[];
  onCancel: () => void;
  /** The change is saved: the page reloads the KYC. */
  onSaved: () => void;
}

/**
 * Change the KYC. Everything on the form can be changed except the PAN and supplier code. Submitting needs a reason and a signed
 * authorization letter; the KYC as it is now is kept on record as the change's "old data" and the new values go live at once.
 */
const SupplierKycEditForm: React.FC<Props> = ({ kyc, businessTypes, accountTypes, onCancel, onSaved }) => {
  const [form, setForm] = useState<KycForm>(() => buildForm(kyc));
  const [reason, setReason] = useState('');
  const [authFiles, setAuthFiles] = useState<File[]>([]);
  const [docs, setDocs] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<KycForm>) => setForm((f) => ({ ...f, ...patch }));
  const setAddress = (key: string, patch: Partial<AddressRow>) => set({ addresses: form.addresses.map((a) => (a.key === key ? { ...a, ...patch } : a)) });
  const setBank = (key: string, patch: Partial<BankRow>) => set({ banks: form.banks.map((a) => (a.key === key ? { ...a, ...patch } : a)) });
  const setContact = (key: string, patch: Partial<ContactRow>) => set({ contacts: form.contacts.map((a) => (a.key === key ? { ...a, ...patch } : a)) });

  const newDocCount = Object.values(docs).reduce((n, list) => n + list.length, 0);
  const sections = useMemo(() => changedSections(kyc, form, newDocCount), [kyc, form, newDocCount]);

  // A value already on file stays selectable even if the master has since retired it.
  const typeOptions = businessTypes.some((b) => b.value === form.business_type) || !form.business_type
    ? businessTypes : [{ value: form.business_type, label: form.business_type }, ...businessTypes];
  const acTypeOptions = (current: string) => (accountTypes.some((a) => a.value === current) || !current
    ? accountTypes : [{ value: current, label: current }, ...accountTypes]);

  const choosePayMode = (portal: boolean) => {
    // coming back to a bank account with none on the form: start a blank one
    set({ pay_via_portal: portal, banks: !portal && form.banks.length === 0 ? [blankBank(true)] : form.banks });
  };

  const submit = async () => {
    setError('');
    if (sections.length === 0) return setError('Nothing has changed yet. Edit a detail or add a new document first.');
    if (!reason.trim()) return setError('Tell us why these details are changing.');
    if (authFiles.length === 0) return setError('Attach the signed authorization letter for this change.');

    const body = new FormData();
    body.append('payload', JSON.stringify(toPayload(form, kyc.snapshot_hash, reason)));
    authFiles.forEach((f) => body.append('authorization_file', f));
    for (const [type, list] of Object.entries(docs)) list.forEach((f) => body.append(`doc_${type}`, f));

    setSubmitting(true);
    try {
      const res = await supplierAxios.post(supplierKycModify, body);
      toast.success(res.data?.message ?? 'Your change has been sent for approval');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your KYC. Please try again.'));
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = () => {
    if ((sections.length > 0 || reason.trim() || authFiles.length) && !window.confirm('Discard the changes you have made?')) return;
    onCancel();
  };

  const onFileDoc = (slotType: string) => kyc.documents.filter((d) => d.document_type === slotType);

  return (
    <div className="space-y-4">
      <Callout tone="info">
        Change what you need and attach a signed authorization letter. Your request is then checked by our team in one or more approval
        stages. Your details stay as they are until it is approved; once it is, the new details go live and the old ones are kept on
        record. Your PAN and supplier code cannot be changed here.
      </Callout>

      {/* ── company details ── */}
      <Panel icon={Building2} title="Company details">
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <Text id="company_name" label="Company name" required max={50} value={form.company_name} onChange={(v) => set({ company_name: v })} />
          <Text id="legal_name" label="Legal name" max={100} value={form.legal_name} onChange={(v) => set({ legal_name: v })} />
          <Text id="trade_name" label="Trade name" max={100} value={form.trade_name} onChange={(v) => set({ trade_name: v })} />
          <Field id="business_type" label="Business type" required>
            <select id="business_type" className={selectCls} value={form.business_type} onChange={(e) => set({ business_type: e.target.value })}>
              <option value="">Select…</option>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Text id="contact_person" label="Contact person" required max={50} value={form.contact_person} onChange={(v) => set({ contact_person: v })} />
          <Text id="mobile_number" label="Mobile" required max={15} inputMode="tel" value={form.mobile_number} onChange={(v) => set({ mobile_number: v })} />
          <Text id="email" label="Email" required max={50} type="email" value={form.email} onChange={(v) => set({ email: v })} />
          <Field id="pan_no" label="PAN" hint="Cannot be changed here. Write to the purchase team if it is wrong.">
            <Input id="pan_no" value={kyc.basic.pan_no ?? ''} disabled readOnly />
          </Field>

          <div className="space-y-2">
            <p id="gst-label" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">GST registered</p>
            <Choice id="gst" value={form.is_gst_avail} onChange={(v) => set({ is_gst_avail: v })} yes="Yes" no="No" />
            {form.is_gst_avail && (
              <Text id="gst_no" label="GST number" required max={20} upper value={form.gst_no} onChange={(v) => set({ gst_no: v })}
                hint={kyc.basic.pan_no ? `Characters 3 to 12 must be your PAN (${kyc.basic.pan_no}).` : undefined} />
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
        {form.is_gst_avail && form.gst_no.trim().toUpperCase() !== (kyc.basic.gst_no ?? '').toUpperCase() && (
          <Callout tone="warning" className="mt-4">
            You are changing your GST number. The GST status we fetched for the old number is cleared; our team re-checks the new one.
          </Callout>
        )}
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
              <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
                <Text id={`${a.key}-door`} label="Door / building" required max={300} value={a.door_no} onChange={(v) => setAddress(a.key, { door_no: v })} className="@xl:col-span-2" />
                <Text id={`${a.key}-street`} label="Street" required max={200} value={a.street} onChange={(v) => setAddress(a.key, { street: v })} />
                <Text id={`${a.key}-area`} label="Area" required max={200} value={a.area} onChange={(v) => setAddress(a.key, { area: v })} />
                <Text id={`${a.key}-city`} label="City" required max={200} value={a.city} onChange={(v) => setAddress(a.key, { city: v })} />
                <Text id={`${a.key}-taluk`} label="Taluk" max={200} value={a.taluk} onChange={(v) => setAddress(a.key, { taluk: v })} />
                <Text id={`${a.key}-state`} label="State" required max={200} value={a.state} onChange={(v) => setAddress(a.key, { state: v })} />
                <Text id={`${a.key}-state_code`} label="State code" max={2} inputMode="numeric" value={a.state_code} hint="2-digit GST state code, e.g. 33"
                  onChange={(v) => setAddress(a.key, { state_code: v.replace(/\D/g, '') })} />
                <Text id={`${a.key}-pincode`} label="Pincode" required max={6} inputMode="numeric" value={a.pincode}
                  onChange={(v) => setAddress(a.key, { pincode: v.replace(/\D/g, '') })} />
                <Text id={`${a.key}-map`} label="Map link" max={500} value={a.location_link} placeholder="https://maps.google.com/…" onChange={(v) => setAddress(a.key, { location_link: v })} className="@xl:col-span-3" />
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
          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
            <Text id="portal_name" label="Portal name" required max={150} value={form.payment_portal_name} onChange={(v) => set({ payment_portal_name: v })} />
            <Text id="portal_url" label="Portal web address" required max={500} placeholder="https://" value={form.payment_portal_url} onChange={(v) => set({ payment_portal_url: v })} />
            <Field id="portal_instr" label="Payment instructions" className="@xl:col-span-2">
              <Textarea id="portal_instr" rows={3} maxLength={1000} value={form.payment_instructions} onChange={(e) => set({ payment_instructions: e.target.value })} />
            </Field>
            {kyc.banks.length > 0 && (
              <div className="@xl:col-span-2">
                <Callout tone="warning">Your bank account{kyc.banks.length > 1 ? 's' : ''} on file will be kept on record but no longer used for payments.</Callout>
              </div>
            )}
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
                  <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
                    <Text id={`${k.key}-holder`} label="Account holder name" required max={50} value={k.ac_holder_name} onChange={(v) => setBank(k.key, { ac_holder_name: v })} />
                    <Text id={`${k.key}-no`} label="Account number" required max={18} inputMode="numeric" value={k.ac_number}
                      onChange={(v) => setBank(k.key, { ac_number: v.replace(/\D/g, '') })} />
                    <Field id={`${k.key}-type`} label="Account type" required>
                      <select id={`${k.key}-type`} className={selectCls} value={k.ac_type} onChange={(e) => setBank(k.key, { ac_type: e.target.value })}>
                        <option value="">Select…</option>
                        {acTypeOptions(k.ac_type).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Text id={`${k.key}-ifsc`} label="IFSC" required max={11} upper value={k.ifsc} onChange={(v) => setBank(k.key, { ifsc: v })} />
                    <Text id={`${k.key}-bank`} label="Bank" required max={50} value={k.bank_name} onChange={(v) => setBank(k.key, { bank_name: v })} />
                    <Text id={`${k.key}-branch`} label="Branch" required max={50} value={k.bank_branch_name} onChange={(v) => setBank(k.key, { bank_branch_name: v })} />
                    <Text id={`${k.key}-addr`} label="Bank address" required max={300} value={k.bank_address} onChange={(v) => setBank(k.key, { bank_address: v })} className="@xl:col-span-3" />
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
              <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
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
      <Panel icon={Paperclip} title="Replace or add documents" description={`Optional. PDF or image, up to ${MAX_FILE_MB} MB each. A new copy replaces the one on file.`}>
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          {DOCUMENT_SLOTS.map((slot) => {
            const current = onFileDoc(slot.type);
            return (
              <FilePick key={slot.type} id={`doc-${slot.type}`} label={slot.label} max={1}
                files={docs[slot.type] ?? []} onChange={(files) => setDocs((d) => ({ ...d, [slot.type]: files }))}
                hint={current.length ? undefined : 'None on file yet.'}
                existing={current.length ? <ul className="mb-2 space-y-1.5">{current.map((d) => <FileLink key={d.kyc_document_sno} url={d.document_path} name={d.document_name} date={d.uploaded_date} />)}</ul> : null} />
            );
          })}
          <FilePick id={`doc-${OTHER_DOCUMENT.type}`} label={OTHER_DOCUMENT.label} max={MAX_OTHER_DOCUMENTS}
            files={docs[OTHER_DOCUMENT.type] ?? []} onChange={(files) => setDocs((d) => ({ ...d, [OTHER_DOCUMENT.type]: files }))} />
        </div>
      </Panel>

      {/* ── authorization + submit ── */}
      <Panel icon={FileSignature} title="Authorization" description="Required for every change.">
        <div className="space-y-4">
          <Field id="reason" label="Why are these details changing?" required>
            <Textarea id="reason" rows={3} maxLength={500} value={reason} placeholder="e.g. We moved our registered office / changed our bank." onChange={(e) => setReason(e.target.value)} />
          </Field>
          <FilePick id="authorization" label="Authorization letter" required max={MAX_AUTHORIZATION_FILES} files={authFiles} onChange={setAuthFiles}
            hint="A letter on your company letterhead, signed by an authorised signatory, asking us to make this change. PDF or image." />

          {sections.length > 0 && <Callout tone="primary">You are changing: <strong>{describeSections(sections)}</strong>.</Callout>}
          {error && <Callout tone="danger"><span role="alert">{error}</span></Callout>}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancel} disabled={submitting}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit for approval
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default SupplierKycEditForm;
