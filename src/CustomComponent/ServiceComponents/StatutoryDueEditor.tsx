import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Landmark, Lock, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { payNetStatutoryPayees, type StatutoryPayee } from '@/Services/GrnService/paymentNetApi';
import { Panel } from './ServiceParts';
import { STATUTORY_TAB_LABEL, type StatutoryDueForm } from './serviceUtils';

const Choice: React.FC<{ active: boolean; onClick: () => void; icon: React.ElementType; title: string; hint: string }> = ({ active, onClick, icon: Icon, title, hint }) => (
  <button
    type="button" role="radio" aria-checked={active} onClick={onClick}
    className={cn(
      'flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50',
    )}
  >
    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
    <span className="min-w-0">
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
    </span>
  </button>
);

/**
 * Where an approved Statutory agreement's dues are paid (backend sql/157, grn sql/96): the Statutory Payments tab, whether the
 * amount is the same every time, who is paid (a payee from the Statutory Payments "Payees" list, or that tab's default) and a
 * reference number (PF establishment code, ESI code, assessment / consumer number) that is shown on every due.
 */
export const StatutoryDueEditor: React.FC<{
  value: StatutoryDueForm;
  onChange: (next: StatutoryDueForm) => void;
  /** the agreement's company: a payee set up for another company is not offered */
  comSno?: string | number | null;
  error?: string;
}> = ({ value, onChange, comSno, error }) => {
  const [payees, setPayees] = useState<StatutoryPayee[]>([]);
  const [payeeError, setPayeeError] = useState('');
  useEffect(() => {
    let live = true;
    axios.get(payNetStatutoryPayees)
      .then((res) => { if (live) setPayees(res.data?.data ?? []); })
      .catch(() => { if (live) setPayeeError('The Statutory Payments payee list could not be read - the default payee will be used.'); });
    return () => { live = false; };
  }, []);

  const set = (patch: Partial<StatutoryDueForm>) => onChange({ ...value, ...patch });
  const offered = payees.filter((y) => y.kind === value.kind && y.is_active === 'Y' && (y.com_sno == null || !comSno || String(y.com_sno) === String(comSno)));
  const tab = STATUTORY_TAB_LABEL[value.kind];
  // a payee chosen for the other tab no longer applies
  useEffect(() => {
    if (value.payee_sno && payees.length && !offered.some((y) => String(y.payee_sno) === value.payee_sno)) onChange({ ...value, payee_sno: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.kind, comSno, payees]);

  return (
    <Panel icon={Landmark} title="Statutory Payments" description="After approval, every due date shows on the Statutory Payments screen and is paid there - no PO is raised" bodyClassName="space-y-4">
      <div data-error={!!error} className="space-y-1.5">
        <Label className="text-xs">Paid on the tab <span className="text-destructive">*</span></Label>
        <div role="radiogroup" aria-label="Statutory Payments tab" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Choice active={value.kind === 'OTHER'} onClick={() => set({ kind: 'OTHER' })} icon={Landmark} title="Others" hint="PF, ESI, professional tax, property tax, electricity …" />
          <Choice active={value.kind === 'GST'} onClick={() => set({ kind: 'GST' })} icon={Landmark} title="GST" hint="A GST amount paid to the GST department" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Amount <span className="text-destructive">*</span></Label>
        <div role="radiogroup" aria-label="Fixed or Unfixed amount" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Choice active={value.amount_type === 'FIXED'} onClick={() => set({ amount_type: 'FIXED' })} icon={Lock} title="Fixed" hint="The same amount every time - it is ready to pay as soon as it shows" />
          <Choice active={value.amount_type === 'UNFIXED'} onClick={() => set({ amount_type: 'UNFIXED' })} icon={PenLine} title="Unfixed" hint="Changes each time - enter it on Statutory Payments from the challan / bill, then pay" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Pay to</Label>
          <Select value={value.payee_sno || 'default'} onValueChange={(v) => set({ payee_sno: v === 'default' ? '' : v })}>
            <SelectTrigger className="h-10 w-full" aria-label="Pay to"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default {tab} payee</SelectItem>
              {offered.map((y) => (
                <SelectItem key={y.payee_sno} value={String(y.payee_sno)}>
                  {y.payee_name}{y.pay_via_portal === 'Y' ? ' · online' : y.ac_last4 ? ` ••••${y.ac_last4}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {payeeError || (offered.length === 0
              ? `No ${tab} payee is set up yet - add one under Statutory Payments > Payees before the first due is paid.`
              : 'Payees are set up under Statutory Payments > Payees (bank account or online portal).')}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stat-due-ref" className="text-xs">Reference no.</Label>
          <Input
            id="stat-due-ref" value={value.reference_no} maxLength={40} className="h-10"
            onChange={(ev) => set({ reference_no: ev.target.value })} placeholder="PF code, ESI code, assessment / consumer no."
          />
          <p className="text-[11px] text-muted-foreground">Shown on every due of this agreement.</p>
        </div>
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </Panel>
  );
};
