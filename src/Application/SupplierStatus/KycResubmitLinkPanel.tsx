import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Link2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import useFetch from '@/hooks/useFetchHook';
import { getErrorMessage } from '@/lib/errors';
import { apiKycResubmitSend, apiKycResubmitStatus } from '@/Services/Api';
import { linkSummary, type LinkStatus } from '@/Application/Kyc-Screen/kycResubmitModel';

/**
 * A rejected supplier KYC: has the supplier been sent a private link to correct it, did they open it, did they use it - and send a
 * new one (the old link stops working). Only an approver of that KYC is allowed to send; the server decides.
 */
const KycResubmitLinkPanel: React.FC<{ kycId: number }> = ({ kycId }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useFetch<{ success: boolean; data: LinkStatus | null }>(apiKycResubmitStatus(kycId), '', null, refreshKey);
  const [writing, setWriting] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const status = data?.data ?? null;
  const summary = linkSummary(status);

  const open = () => {
    setReason(status?.reject_reason ?? '');
    setWriting(true);
  };

  const send = async () => {
    if (!reason.trim()) return toast.error('Write what the supplier has to correct.');
    setSending(true);
    try {
      const res = await axios.post(apiKycResubmitSend, { kyc_basic_info_sno: kycId, reason: reason.trim() });
      const result = res.data?.data as { emailSent?: boolean; reason?: string } | undefined;
      if (result?.emailSent === false) toast.warning(result.reason ?? 'The link was created but the e-mail was not sent.', { duration: 12000 });
      else toast.success(res.data?.message ?? 'A new correction link was sent.');
      setWriting(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, 'The correction link could not be sent.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel icon={Link2} title="Correction link" description="Lets the supplier fix the rejected KYC without starting again."
      action={!writing && !loading && !error ? <Button type="button" size="sm" variant="outline" className="gap-1" onClick={open}><Send className="h-3.5 w-3.5" />{status ? 'Send new link' : 'Send link'}</Button> : undefined}>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : error ? (
        <Callout tone="danger">{error}</Callout>
      ) : (
        <div className="space-y-3">
          <Callout tone={summary.tone}>
            <p className="font-semibold">{summary.title}</p>
            {summary.lines.map((l) => <p key={l} className="mt-1">{l}</p>)}
            {status?.reject_reason && <p className="mt-2 border-t pt-2 opacity-90"><span className="font-semibold">Asked to correct:</span> {status.reject_reason}</p>}
          </Callout>
          {writing && (
            <div className="space-y-2">
              <label htmlFor="resubmit-reason" className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What should the supplier correct?</label>
              <Textarea id="resubmit-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">The supplier is e-mailed a new private link (valid for a few days, works once). Older links stop working.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setWriting(false)} disabled={sending}>Cancel</Button>
                <Button type="button" size="sm" className="gap-1" onClick={() => void send()} disabled={sending}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Send link
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
};

export default KycResubmitLinkPanel;
