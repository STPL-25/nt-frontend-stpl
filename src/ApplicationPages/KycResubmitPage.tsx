// /kyc_resubmit#t=<token> - a supplier whose KYC was rejected opens the private link we e-mailed, corrects it and sends it again.
// No login: the token in the link is the only credential. It sits after the # so it is never sent to a server, written to an
// access log or passed on in a Referer. The server (backend-stpl src/KycResubmit, sql/155) checks the link, the form and every
// uploaded file; see KycResubmitForm.tsx for the form and kycResubmitModel.ts for what is checked up front.
import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, Clock, FileWarning, Loader2, ShieldCheck } from 'lucide-react';
import spaceLogo from '@/assets/space.png';
import { Callout } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { getErrorMessage } from '@/lib/errors';
import { apiPublicKycResubmitOpen } from '@/Services/Api';
import KycResubmitForm from '@/Application/Kyc-Screen/KycResubmitForm';
import { tokenFromHash, whenText, type ResubmitData } from '@/Application/Kyc-Screen/kycResubmitModel';

type View =
  | { kind: 'loading' }
  | { kind: 'gone'; message: string }
  | { kind: 'form'; data: ResubmitData }
  | { kind: 'done'; message: string };

/** The address bar keeps the token; this page must not be indexed or remembered by anything that crawls. */
function useNoIndex() {
  useEffect(() => {
    const metas = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const m = document.createElement('meta');
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
      return m;
    });
    return () => metas.forEach((m) => m.remove());
  }, []);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-700 via-sky-600 to-cyan-500">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-8 sm:pb-24 sm:pt-10 lg:px-8">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
            <div className="shrink-0 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5">
              <img src={spaceLogo} alt="Space Textiles (P) Ltd" className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Space Textiles (P) Ltd</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Correct your KYC</h1>
            </div>
          </div>
        </div>
      </section>
      <main className="relative z-10 mx-auto -mt-12 max-w-4xl space-y-4 px-4 pb-10 lg:px-8">{children}</main>
      <footer className="pb-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Space Textiles (P) Ltd · Your details are used only for supplier verification.
      </footer>
    </div>
  );
}

function Message({ icon: Icon, tone, title, children }: { icon: React.ElementType; tone: 'ok' | 'bad'; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-10" role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon className={tone === 'ok' ? 'mx-auto h-10 w-10 text-emerald-600' : 'mx-auto h-10 w-10 text-amber-600'} />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <div className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export default function KycResubmitPage() {
  useNoIndex();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [token] = useState(() => tokenFromHash(window.location.hash));

  useEffect(() => {
    if (!token) {
      setView({ kind: 'gone', message: 'This page needs the private link from your e-mail. Open that e-mail and use the “Correct my KYC” button.' });
      return;
    }
    let live = true;
    axios
      .post(apiPublicKycResubmitOpen, { token })
      .then((res) => live && setView({ kind: 'form', data: res.data.data as ResubmitData }))
      .catch((err) => live && setView({ kind: 'gone', message: getErrorMessage(err, 'We could not open your KYC. Please try again in a few minutes.') }));
    return () => { live = false; };
  }, [token]);

  if (view.kind === 'loading') {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card p-10 text-sm text-muted-foreground shadow-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening your KYC…
        </div>
      </Shell>
    );
  }

  if (view.kind === 'gone') {
    return (
      <Shell>
        <Message icon={FileWarning} tone="bad" title="This link cannot be used">
          <p>{view.message}</p>
          <p className="mt-3">If you still need to correct your KYC, please contact our purchase team and ask for a new link.</p>
        </Message>
      </Shell>
    );
  }

  if (view.kind === 'done') {
    return (
      <Shell>
        <Message icon={CheckCircle2} tone="ok" title="Your corrected KYC has been sent">
          <p>{view.message}</p>
          <p className="mt-3">You can close this page. This link has now been used and cannot be opened again.</p>
        </Message>
      </Shell>
    );
  }

  const { data } = view;
  const expires = whenText(data.link.expires_at);
  return (
    <Shell>
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Your KYC could not be approved yet. Please correct this:</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-amber-900 [overflow-wrap:anywhere] dark:text-amber-100">{data.link.reject_reason}</p>
          </div>
        </div>
      </div>

      <Callout tone="info" icon={ShieldCheck}>
        Your details are filled in below - change only what is wrong. This private link works once{expires ? ` and expires on ${expires}` : ''}.
        Do not share it: anyone who has it can change your KYC. Files are security-checked; only PDF, PNG, JPG or WEBP are accepted.
      </Callout>
      {expires && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Link valid until {expires}</p>
      )}

      <KycResubmitForm
        data={data}
        token={token}
        onDone={(message) => { setView({ kind: 'done', message }); window.scrollTo({ top: 0 }); }}
        onLinkGone={(message) => { setView({ kind: 'gone', message }); window.scrollTo({ top: 0 }); }}
      />
    </Shell>
  );
}
