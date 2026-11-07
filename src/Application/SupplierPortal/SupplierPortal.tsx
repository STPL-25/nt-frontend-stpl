import React, { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'sonner';
import {
  loadSupplierSession,
  clearSupplierSession,
  saveSupplierSession,
  onSupplierSessionExpired,
  type SupplierProfile,
  type DispatchCreateResult,
} from '@/Services/SupplierService';
import SupplierLogin from './SupplierLogin';
import SupplierResetPassword from './SupplierResetPassword';
import SupplierSidebar, { SIDEBAR_WIDTH } from './SupplierSidebar';
import SupplierHeader from './SupplierHeader';
import SupplierPOWorkspace from './SupplierPOWorkspace';
import SupplierDispatchForm from './SupplierDispatchForm';
import SupplierDispatchSummary from './SupplierDispatchSummary';
import SupplierDispatchSlip from './SupplierDispatchSlip';
import SupplierDebitNotesList from './SupplierDebitNotesList';
import SupplierPaymentsList from './SupplierPaymentsList';
import SupplierRfqList from './SupplierRfqList';
import SupplierRfqEntry from './SupplierRfqEntry';
import SupplierMyKyc from './SupplierMyKyc';
import type { SupplierNotificationTarget } from './supplierNotificationModel';

type View =
  | { name: 'rfq-list' }
  | { name: 'rfq-entry'; rfq_supplier_sno: number }
  | { name: 'workspace'; selected?: number }
  | { name: 'dispatch-form'; po_basic_sno: number }
  | { name: 'dispatch-summary'; result: DispatchCreateResult }
  | { name: 'dispatch-slip'; delivery_sno: number }
  | { name: 'debit-notes' }
  | { name: 'payments' }
  | { name: 'kyc' };

const VIEW_TITLES: Record<View['name'], string> = {
  'rfq-list': 'Quotation Requests',
  'rfq-entry': 'Quotation Entry',
  workspace: 'Purchase Orders',
  'dispatch-form': 'Dispatch',
  'dispatch-summary': 'Dispatch Summary',
  'dispatch-slip': 'Delivery Slip',
  'debit-notes': 'Debit / Credit Notes',
  payments: 'Payments',
  kyc: 'My KYC',
};

const COLLAPSED_WIDTH = 80;

/**
 * Self-contained supplier-facing portal, isolated from the internal app's
 * Redux `userData`/session-cookie auth — the supplier's identity lives only
 * in localStorage (Bearer JWT), restored here on mount the same way the
 * internal app restores its session in App.tsx's RootRoute/initUser().
 *
 * Layout deliberately mirrors the internal app's Dashboard shell (fixed
 * left sidebar + sticky header + scrollable main), but with its own local
 * layout state instead of the Redux-backed sidebar/header used there —
 * the supplier portal has no screens/permissions data to drive a dynamic
 * menu, so it doesn't need that machinery.
 */
const SupplierPortal: React.FC = () => {
  const [restoring, setRestoring] = useState(true);
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [view, setView] = useState<View>({ name: 'workspace' });

  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const session = loadSupplierSession();
    if (session) setSupplier(session.supplier);
    setRestoring(false);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLoggedIn = useCallback((token: string, profile: SupplierProfile, mustReset: boolean) => {
    saveSupplierSession(token, profile);
    setSupplier(profile);
    setMustResetPassword(mustReset);
    setView({ name: 'workspace' });
  }, []);

  const handleLogout = useCallback(() => {
    clearSupplierSession();
    setSupplier(null);
    setMustResetPassword(false);
    setView({ name: 'workspace' });
  }, []);

  // The server says the session is no longer valid (401 on any signed-in call): back to the login screen, no error toast.
  useEffect(() => onSupplierSessionExpired(handleLogout), [handleLogout]);

  // A notification names the screen it is about (and, for an RFQ / PO, which one).
  const handleOpenNotification = useCallback((t: SupplierNotificationTarget) => {
    switch (t.view) {
      case 'rfq-entry':
        setView(t.rfq_supplier_sno ? { name: 'rfq-entry', rfq_supplier_sno: t.rfq_supplier_sno } : { name: 'rfq-list' });
        break;
      case 'workspace':
        setView({ name: 'workspace', selected: t.po_basic_sno });
        break;
      case 'debit-notes':
        setView({ name: 'debit-notes' });
        break;
      case 'payments':
        setView({ name: 'payments' });
        break;
      case 'kyc':
        setView({ name: 'kyc' });
        break;
    }
  }, []);

  if (restoring) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <SupplierLogin onLoggedIn={handleLoggedIn} />
      </>
    );
  }

  if (mustResetPassword) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <SupplierResetPassword onDone={() => setMustResetPassword(false)} suppCode={supplier.supp_code} />
      </>
    );
  }

  const mainContentStyle = isMobile
    ? { marginLeft: 0, width: '100%' }
    : {
        marginLeft: `${isCollapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH}px`,
        transition: 'margin-left 300ms ease-in-out',
        width: `calc(100% - ${isCollapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH}px)`,
      };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />

      <SupplierSidebar
        supplier={supplier}
        isCollapsed={isCollapsed}
        toggleCollapse={() => setIsCollapsed((c) => !c)}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onGoHome={() => setView({ name: 'workspace' })}
        isHome={view.name === 'workspace'}
        onGoDebitNotes={() => setView({ name: 'debit-notes' })}
        isDebitNotes={view.name === 'debit-notes'}
        onGoPayments={() => setView({ name: 'payments' })}
        isPayments={view.name === 'payments'}
        onGoRfqs={() => setView({ name: 'rfq-list' })}
        isRfqs={view.name === 'rfq-list' || view.name === 'rfq-entry'}
        onGoKyc={() => setView({ name: 'kyc' })}
        isKyc={view.name === 'kyc'}
      />

      <div className="flex h-screen min-w-0 flex-col overflow-hidden" style={mainContentStyle}>
        <SupplierHeader
          supplier={supplier}
          title={VIEW_TITLES[view.name]}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onLogout={handleLogout}
          onOpenNotification={handleOpenNotification}
        />

        <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(to_right,color-mix(in_oklab,var(--border)_42%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_42%,transparent)_1px,transparent_1px)] bg-[size:32px_32px] px-1 pb-4 pt-2 sm:px-2 lg:px-3 lg:pb-6 lg:pt-3 print:overflow-visible print:bg-none print:p-0">
          <div className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
            <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-primary/[0.10] blur-3xl" />
            <div className="absolute -bottom-40 left-1/4 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/65 to-background" />
          </div>

          <div className="relative h-full w-full">
            {view.name === 'rfq-list' ? (
              <div className="h-full w-full">
                <SupplierRfqList onOpen={(rfq_supplier_sno) => setView({ name: 'rfq-entry', rfq_supplier_sno })} />
              </div>
            ) : view.name === 'rfq-entry' ? (
              <div className="mx-auto h-full w-full max-w-5xl">
                <SupplierRfqEntry
                  key={view.rfq_supplier_sno}
                  rfq_supplier_sno={view.rfq_supplier_sno}
                  onBack={() => setView({ name: 'rfq-list' })}
                />
              </div>
            ) : view.name === 'workspace' ? (
              <div className="h-full w-full">
                <SupplierPOWorkspace
                  key={view.selected}
                  initialSelected={view.selected}
                  onDispatch={(po_basic_sno) => setView({ name: 'dispatch-form', po_basic_sno })}
                />
              </div>
            ) : view.name === 'debit-notes' ? (
              <div className="h-full w-full">
                <SupplierDebitNotesList />
              </div>
            ) : view.name === 'payments' ? (
              <div className="h-full w-full">
                <SupplierPaymentsList />
              </div>
            ) : view.name === 'kyc' ? (
              <div className="h-full w-full">
                <SupplierMyKyc />
              </div>
            ) : (
              <div className="mx-auto h-full w-full max-w-4xl">
                {view.name === 'dispatch-form' && (
                  <SupplierDispatchForm
                    po_basic_sno={view.po_basic_sno}
                    onBack={() => setView({ name: 'workspace', selected: view.po_basic_sno })}
                    onCreated={(result) => setView({ name: 'dispatch-summary', result })}
                  />
                )}
                {view.name === 'dispatch-summary' && (
                  <SupplierDispatchSummary
                    result={view.result}
                    onBack={() => setView({ name: 'workspace' })}
                    onPrint={(delivery_sno) => setView({ name: 'dispatch-slip', delivery_sno })}
                  />
                )}
                {view.name === 'dispatch-slip' && (
                  <SupplierDispatchSlip
                    delivery_sno={view.delivery_sno}
                    onBack={() => setView({ name: 'workspace' })}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SupplierPortal;
