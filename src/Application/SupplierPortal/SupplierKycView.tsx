import React from 'react';
import { Building2, FileText, Landmark, MapPin, Paperclip, Users, Wallet } from 'lucide-react';
import { Fact, FactGrid, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { cn } from '@/lib/utils';
import type { SupplierKycChoice, SupplierKycFile, SupplierKycSnapshot } from '@/Services/SupplierService';
import { formatDate } from './helpers';
import { DOCUMENT_LABEL, choiceLabel, dash, joinAddress, kycFileUrl } from './supplierKycModel';

/** A link to a stored file; opens in a new tab. */
export const FileLink: React.FC<{ url: string | null; name?: string | null; kind?: string | null; date?: string | null }> = ({ url, name, kind, date }) => {
  const label = (kind && DOCUMENT_LABEL[kind]) || kind || 'File';
  const inner = (
    <>
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{name || label}</span>
    </>
  );
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
      {url ? (
        <a href={kycFileUrl(url)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-medium text-primary hover:underline">
          {inner}
        </a>
      ) : (
        <span className="flex min-w-0 items-center gap-2 font-medium">{inner}</span>
      )}
      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
        {kind && <span className="hidden rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline">{label}</span>}
        {date && <span className="tabular-nums">{formatDate(date)}</span>}
      </span>
    </li>
  );
};

export const FileList: React.FC<{ files: SupplierKycFile[] }> = ({ files }) => (
  <ul className="space-y-1.5">
    {files.map((f, i) => (
      <FileLink key={`${f.file_path}-${i}`} url={f.file_path} name={f.file_name} kind={f.file_kind} date={f.uploaded_date} />
    ))}
  </ul>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <li className={cn('rounded-lg border bg-muted/20 p-3', className)}>{children}</li>
);

const Primary = () => <StatusPill tone="primary">Primary</StatusPill>;

interface Props {
  snapshot: SupplierKycSnapshot;
  businessTypes: SupplierKycChoice[];
  accountTypes: SupplierKycChoice[];
  /** Hide the empty-state wording that only makes sense for the current KYC. */
  muted?: boolean;
}

/** Every part of a KYC, read-only. */
const SupplierKycView: React.FC<Props> = ({ snapshot, businessTypes, accountTypes }) => {
  const { basic: b, payment: p, addresses, banks, contacts, documents } = snapshot;
  const viaPortal = p.pay_via_portal === 'Y';

  return (
    <div className="space-y-4">
      <Panel icon={Building2} title="Company details">
        <FactGrid>
          <Fact label="Company name">{dash(b.company_name)}</Fact>
          <Fact label="Legal name">{dash(b.legal_name)}</Fact>
          <Fact label="Trade name">{dash(b.trade_name)}</Fact>
          <Fact label="Business type">{choiceLabel(businessTypes, b.business_type)}</Fact>
          <Fact label="Contact person">{dash(b.contact_person)}</Fact>
          <Fact label="Mobile">{dash(b.mobile_number)}</Fact>
          <Fact label="Email">{dash(b.email)}</Fact>
          <Fact label="PAN">{dash(b.pan_no)}</Fact>
          <Fact label="GST registered">{b.is_gst_avail === 'Y' ? 'Yes' : 'No'}</Fact>
          {b.is_gst_avail === 'Y' && <Fact label="GST number">{dash(b.gst_no)}</Fact>}
          {b.is_gst_avail === 'Y' && b.gst_status && <Fact label="GST status">{dash(b.gst_status)}</Fact>}
          <Fact label="MSME registered">{b.is_msme_avail === 'Y' ? 'Yes' : 'No'}</Fact>
          {b.is_msme_avail === 'Y' && <Fact label="MSME (Udyam) number">{dash(b.msme_no)}</Fact>}
          {b.is_msme_avail === 'Y' && b.msme_type && <Fact label="MSME type">{dash(b.msme_type)}</Fact>}
        </FactGrid>
      </Panel>

      <Panel icon={MapPin} title={`Addresses (${addresses.length})`}>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No address on file.</p>
        ) : (
          <ul className="space-y-2">
            {addresses.map((a) => (
              <Card key={a.kyc_address_sno}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 break-words text-sm font-medium">{joinAddress(a)}</p>
                  {a.is_primary === 'Y' && <Primary />}
                </div>
                {a.location_link && (
                  <a href={a.location_link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">View on map</a>
                )}
              </Card>
            ))}
          </ul>
        )}
      </Panel>

      <Panel icon={viaPortal ? Wallet : Landmark} title={viaPortal ? 'Payment: through your portal' : `Bank accounts (${banks.length})`}>
        {viaPortal ? (
          <FactGrid>
            <Fact label="Portal name">{dash(p.payment_portal_name)}</Fact>
            <Fact label="Portal address">
              {p.payment_portal_url ? <a href={p.payment_portal_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{p.payment_portal_url}</a> : '—'}
            </Fact>
            <Fact label="Instructions" className="col-span-2 @xl:col-span-3">{dash(p.payment_instructions)}</Fact>
          </FactGrid>
        ) : banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bank account on file.</p>
        ) : (
          <ul className="space-y-2">
            {banks.map((k) => (
              <Card key={k.kyc_bank_sno}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-sm font-semibold">{dash(k.ac_holder_name)}</p>
                  {k.is_primary === 'Y' && <Primary />}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 @xl:grid-cols-4">
                  <Fact label="Account no.">{dash(k.ac_number)}</Fact>
                  <Fact label="Type">{k.ac_type_name || choiceLabel(accountTypes, k.ac_type)}</Fact>
                  <Fact label="IFSC">{dash(k.ifsc)}</Fact>
                  <Fact label="Bank">{dash(k.bank_name)}</Fact>
                  <Fact label="Branch">{dash(k.bank_branch_name)}</Fact>
                  <Fact label="Bank address" className="col-span-2">{dash(k.bank_address)}</Fact>
                </dl>
              </Card>
            ))}
          </ul>
        )}
      </Panel>

      <Panel icon={Users} title={`Contacts (${contacts.length})`}>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contact on file.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <Card key={c.kyc_contact_sno}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-sm font-semibold">
                    {dash(c.contact_name)}{c.contact_position ? <span className="font-normal text-muted-foreground"> · {c.contact_position}</span> : null}
                  </p>
                  {c.contact_type === 'PRIMARY' && <Primary />}
                </div>
                <p className="mt-1 break-words text-xs text-muted-foreground">{[c.contact_mobile, c.contact_email].filter(Boolean).join(' · ') || '—'}</p>
              </Card>
            ))}
          </ul>
        )}
      </Panel>

      <Panel icon={Paperclip} title={`Documents (${documents.length})`}>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No document on file.</p>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((d) => (
              <FileLink key={d.kyc_document_sno} url={d.document_path} name={d.document_name} kind={d.document_type} date={d.uploaded_date} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default SupplierKycView;
