import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock, History, Loader2, Pencil, ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Callout, DetailHero, Panel, StatusPill } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { getErrorMessage } from '@/lib/errors';
import {
  supplierAxios, supplierKyc, supplierKycWithdraw, type SupplierKycChange, type SupplierKycData,
} from '@/Services/SupplierService';
import { formatDate } from './helpers';
import SupplierKycEditForm from './SupplierKycEditForm';
import SupplierKycView, { FileList } from './SupplierKycView';
import { SECTION_LABEL, STATUS_LABEL, changeStatus, dash, stageText, type KycSection } from './supplierKycModel';

const when = (v: string | null | undefined) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : `${formatDate(v)}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

/** One request the supplier made: where it stands, why, the files it came with, who decided what, and the details it is about. */
const ChangeCard: React.FC<{ change: SupplierKycChange; data: SupplierKycData }> = ({ change, data }) => {
  const st = changeStatus(change.status);
  const waiting = change.status === 'P';
  const applied = !change.status || change.status === 'A';
  const letters = change.files.filter((f) => f.file_kind === 'AUTHORIZATION');
  const added = change.files.filter((f) => f.file_kind !== 'AUTHORIZATION');
  const trail = change.approvals ?? [];
  // an approved change is shown as it was BEFORE (that is what changed); one still waiting / refused as it was ASKED for
  const detailsSnapshot = applied ? change.old_data : change.new_data;

  return (
    <li className="rounded-lg border bg-muted/20 p-3" data-testid="kyc-change">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Request {change.version_no}</p>
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
        </div>
        <p className="text-xs text-muted-foreground">{when(change.modified_date)} · {dash(change.modified_by)}</p>
      </div>

      {waiting && (
        <p className="mt-1.5 text-xs text-muted-foreground">{stageText(change.stage_no, change.stage_total, change.stage_name) || 'In approval'}. Your details stay as they are until it is approved.</p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {change.changed_sections.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (
          <StatusPill key={x} tone="info">{SECTION_LABEL[x as KycSection] ?? x}</StatusPill>
        ))}
      </div>
      <p className="mt-2 break-words text-sm"><span className="text-muted-foreground">Reason: </span>{change.reason}</p>

      {change.status === 'R' && (
        <Callout tone="danger" className="mt-2">
          <strong>Rejected</strong>{change.decided_date ? ` on ${formatDate(change.decided_date)}` : ''}: “{dash(change.decision_note)}” Your KYC was not changed - you can make the change again.
        </Callout>
      )}
      {change.status === 'C' && <p className="mt-2 text-xs text-muted-foreground">You withdrew this request{change.decided_date ? ` on ${formatDate(change.decided_date)}` : ''}. Your KYC was not changed.</p>}

      {trail.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Approval</p>
          <ul className="space-y-1 text-xs">
            {trail.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{a.stage_name || `Stage ${a.seq_no}`}</span>
                <span className={a.action === 'A' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>{a.action === 'A' ? 'Approved' : 'Rejected'}</span>
                <span className="text-muted-foreground">{when(a.acted_date)}</span>
                {a.note && <span className="break-words text-muted-foreground">· {a.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {letters.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Authorization letter</p>
          <FileList files={letters} />
        </div>
      )}
      {added.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documents {applied ? 'added' : 'sent'}</p>
          <FileList files={added} />
        </div>
      )}
      {detailsSnapshot && (
        <details className="group mt-3">
          <summary className="cursor-pointer select-none text-xs font-medium text-primary hover:underline">
            {applied ? 'Show your details before this change' : 'Show the details you asked for'}
          </summary>
          <div className="mt-3">
            <SupplierKycView snapshot={detailsSnapshot} businessTypes={data.business_types} accountTypes={data.account_types} muted />
          </div>
        </details>
      )}
    </li>
  );
};

/**
 * "My KYC": the supplier sees only its own KYC (the server takes the supplier from the login) and can ask to change it with an
 * authorization letter. The request then goes through the approval stages; the KYC changes only when the last stage approves,
 * and the KYC as it was is kept next to the new one.
 */
const SupplierMyKyc: React.FC = () => {
  const [data, setData] = useState<SupplierKycData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await supplierAxios.get(supplierKyc);
      setData(res.data?.data as SupplierKycData);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load your KYC'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const withdraw = async (sno: number) => {
    if (!window.confirm('Withdraw this request? Nothing will change in your KYC, and you can send a new request afterwards.')) return;
    setWithdrawing(true);
    try {
      const res = await supplierAxios.post(supplierKycWithdraw, { kyc_modified_sno: sno });
      toast.success(res.data?.message ?? 'Your request has been withdrawn');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not withdraw the request'));
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading && !data) {
    return <div className="flex h-60 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (loadError || !data) {
    return (
      <div className="space-y-3 px-3 py-4 sm:px-5">
        <Callout tone="danger">{loadError || 'Your KYC could not be found.'}</Callout>
        <Button variant="outline" size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }

  const { kyc, history } = data;
  const status = STATUS_LABEL[kyc.status ?? ''] ?? { label: kyc.status || 'Unknown', tone: 'neutral' as const };
  const approved = history.filter((h) => !h.status || h.status === 'A');
  const lastApproved = approved[0];
  const pendingSno = kyc.pending_sno ?? null;

  return (
    <div className="@container">
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-5">
        <DetailHero
          icon={ShieldCheck}
          eyebrow="My KYC"
          title={kyc.basic.company_name || 'Your company'}
          subtitle={[kyc.supp_code ? `Supplier code ${kyc.supp_code}` : '', kyc.supplier_category ?? ''].filter(Boolean).join(' · ') || undefined}
          badges={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
          metrics={[
            { label: 'Submitted on', value: formatDate(kyc.created_date) },
            { label: 'Last changed', value: lastApproved ? formatDate(lastApproved.decided_date ?? lastApproved.modified_date) : '—', hint: lastApproved ? `Request ${lastApproved.version_no}` : 'Not changed since' },
            { label: 'Changes approved', value: String(approved.length), accent: approved.length > 0 },
          ]}
        />

        {editing ? (
          <SupplierKycEditForm
            kyc={kyc}
            businessTypes={data.business_types}
            accountTypes={data.account_types}
            onCancel={() => setEditing(false)}
            onSaved={async () => { setEditing(false); await load(); window.scrollTo({ top: 0 }); }}
          />
        ) : (
          <>
            {pendingSno && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" data-testid="kyc-pending-banner">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">Your change request {kyc.pending_version} is waiting for approval</p>
                      <p className="mt-0.5 text-xs">
                        {stageText(kyc.pending_stage_no, kyc.pending_stage_total, kyc.pending_stage_name) || 'In approval'}
                        {kyc.pending_since ? ` · sent ${when(kyc.pending_since)}` : ''}. The details below stay as they are until it is approved. You can make another change once it is decided.
                      </p>
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 bg-background text-foreground" disabled={withdrawing} onClick={() => withdraw(pendingSno)}>
                    {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}Withdraw request
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">These are the details we hold for you. Need to change something?</p>
              <Button
                type="button" className="gap-1.5" disabled={!!pendingSno}
                title={pendingSno ? 'A change request is already waiting for approval' : undefined}
                onClick={() => { setEditing(true); window.scrollTo({ top: 0 }); }}
              >
                <Pencil className="h-4 w-4" />Edit details
              </Button>
            </div>

            <SupplierKycView snapshot={kyc} businessTypes={data.business_types} accountTypes={data.account_types} />

            <Panel icon={History} title={`Your change requests (${history.length})`} description="Each request keeps the details as they were, the authorization letter you sent and who approved it.">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have not asked to change your KYC yet.</p>
              ) : (
                <ul className="space-y-3">
                  {history.map((h) => <ChangeCard key={h.kyc_modified_sno} change={h} data={data} />)}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
};

export default SupplierMyKyc;
