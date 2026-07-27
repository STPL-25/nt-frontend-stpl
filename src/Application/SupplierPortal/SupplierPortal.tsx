import React, { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'sonner';
import {
  loadSupplierSession,
  clearSupplierSession,
  saveSupplierSession,
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

type View =
  | { name: 'workspace'; selected?: number }
  | { name: 'dispatch-form'; po_basic_sno: number }
  | { name: 'dispatch-summary'; result: DispatchCreateResult }
  | { name: 'dispatch-slip'; delivery_sno: number };

const VIEW_TITLES: Record<View['name'], string> = {
  workspace: 'Purchase Orders',
  'dispatch-form': 'Dispatch',
  'dispatch-summary': 'Dispatch Summary',
  'dispatch-slip': 'Delivery Slip',
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
      />

      <div className="flex h-screen flex-col overflow-hidden" style={mainContentStyle}>
        <SupplierHeader
          supplier={supplier}
          title={VIEW_TITLES[view.name]}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto px-2 pb-4 pt-3 lg:px-4 lg:pt-4 print:overflow-visible print:p-0">
          {view.name === 'workspace' ? (
            <div className="h-full w-full">
              <SupplierPOWorkspace
                key={view.selected}
                initialSelected={view.selected}
                onDispatch={(po_basic_sno) => setView({ name: 'dispatch-form', po_basic_sno })}
              />
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
        </main>
      </div>
    </div>
  );
};

export default SupplierPortal;
