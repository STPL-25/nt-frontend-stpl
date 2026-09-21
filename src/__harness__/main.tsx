// THROWAWAY screenshot harness (delete with preview-harness.html). Renders the real screens; axios is
// pointed at a local bridge that runs the REAL backend routes against the dev DB with a fake session.
import '../index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import axios from 'axios';
import { Toaster } from 'sonner';
import { store } from '@/globalState/store';
import { setUserData } from '@/globalState/features/decodeSlice';
import { fetchSidebarData } from '@/globalState/features/fetchSidebarDataSlice';
import LoanVoucherPage from '@/Application/LoanVoucher/LoanVoucherPage';
import LoanVoucherApprovalScreen from '@/Application/LoanVoucher/LoanVoucherApprovalScreen';
import ServiceAgreementPage from '@/Application/ServiceAgreement/ServiceAgreementPage';
import ServiceAgreementApprovalScreen from '@/Application/ServiceAgreement/ServiceAgreementApprovalScreen';

const BRIDGE = 'http://localhost:7199';

axios.defaults.adapter = async (config: any) => {
  const u = new URL(axios.getUri(config), location.origin);
  const method = String(config.method ?? 'get').toUpperCase();
  const headers: Record<string, string> = {};
  let body: any;
  if (method !== 'GET' && method !== 'HEAD' && config.data != null) {
    if (config.data instanceof FormData) body = config.data;
    else { body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data); headers['Content-Type'] = 'application/json'; }
  }
  const r = await fetch(BRIDGE + u.pathname + u.search, { method, body, headers });
  const data = await r.json().catch(() => null);
  const response = { data, status: r.status, statusText: r.statusText, headers: {}, config, request: {} };
  if (r.status >= 200 && r.status < 300) return response as any;
  throw new (axios as any).AxiosError(`Request failed with status code ${r.status}`, 'ERR_BAD_REQUEST', config, {}, response);
};

const params = new URLSearchParams(location.search);
const screen = params.get('screen') ?? 'loan';

store.dispatch(setUserData([{ ecno: 'KTM1148', login_id: 'KTM1148', name: 'Finance Manager' }] as any));
const all = [2, 3, 4, 5, 7, 8].map((permission_id) => ({ permission_id }));
store.dispatch((fetchSidebarData as any).fulfilled({
  screens: [
    { screen_id: 72, screen_name: 'Loan Payments', screen_comp: 'LoanVoucherPage', permissions: all },
    { screen_id: 73, screen_name: 'Loan Voucher Approvals', screen_comp: 'LoanVoucherApprovalScreen', permissions: all },
    { screen_id: 60, screen_name: 'Service Agreements', screen_comp: 'ServiceAgreementPage', permissions: all },
    { screen_id: 61, screen_name: 'Service Agreement Approvals', screen_comp: 'ServiceAgreementApprovalScreen', permissions: all },
  ],
}, 'req', { id: 'KTM1148' }));

const Screen = { loan: LoanVoucherPage, approval: LoanVoucherApprovalScreen, agreement: ServiceAgreementPage, agreementApproval: ServiceAgreementApprovalScreen }[screen] ?? LoanVoucherPage;

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <main id="harness-main" className="flex-1 overflow-y-auto px-2 pb-4 pt-3 lg:px-4 lg:pt-4">
        <div className="h-full w-full"><React.Suspense fallback={null}><Screen /></React.Suspense></div>
      </main>
    </div>
    <Toaster position="top-right" richColors />
  </Provider>,
);
