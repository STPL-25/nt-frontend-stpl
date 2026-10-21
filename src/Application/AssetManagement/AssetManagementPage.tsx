import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/globalState/hooks/usePermissions';
import { getErrorMessage } from '@/lib/errors';
import {
  socket, SOCKET_JOIN_INVENTORY, SOCKET_LEAVE_INVENTORY, SOCKET_ASSET_UPDATED,
} from '@/Services/Socket';
import {
  assetSvcMe, assetSvcRegister, assetSvcSuppliers, assetSvcRequests, assetSvcRequest, assetSvcAction,
  type AssetAction, type AssetMe, type AssetRequest, type AssetRequestDetail, type AssetRow,
  type AssetSupplier, type CreateAssetRequestPayload,
} from '@/Services/GrnService/assetApi';

import RegisterTab from './AssetManagement/RegisterTab';
import RequestsBoard from './AssetManagement/RequestsBoard';
import ApprovalsTab from './AssetManagement/ApprovalsTab';
import RequestDrawer from './AssetManagement/RequestDrawer';
import RaiseRequestSheet, { type RaiseIntent } from './AssetManagement/RaiseRequestSheet';
import { daysLate, isClosed } from './AssetManagement/helpers';

const SCREEN = 'AssetManagementPage';

type TabKey = 'register' | 'board' | 'approvals';

const AssetManagementPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();

  const [tab, setTab] = useState<TabKey>('register');
  const [me, setMe] = useState<AssetMe | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [mine, setMine] = useState<AssetRequest[]>([]);
  const [suppliers, setSuppliers] = useState<AssetSupplier[]>([]);
  const [loading, setLoading] = useState(false);

  const [raise, setRaise] = useState<RaiseIntent | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AssetRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r, m] = await Promise.all([
        // every issued line, so an item that is fully out for service still shows where it belongs
        axios.get(assetSvcRegister),
        axios.get(assetSvcRequests),
        axios.get(assetSvcRequests, { params: { mine_approvals: 1, only_open: 1 } }),
      ]);
      setAssets(a.data?.data ?? []);
      setRequests(r.data?.data ?? []);
      setMine(m.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load asset data'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: number, quiet = false) => {
    if (!quiet) setDetailLoading(true);
    try {
      const res = await axios.get(assetSvcRequest(id));
      setDetail(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load request'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    axios.get(assetSvcMe).then(r => setMe(r.data?.data ?? null)).catch(() => {});
    axios.get(assetSvcSuppliers).then(r => setSuppliers(r.data?.data ?? [])).catch(() => {});
  }, [fetchAll]);

  // Live refresh when anyone changes a request (rides the inventory room)
  const detailIdRef = useRef<number | null>(null);
  useEffect(() => { detailIdRef.current = detailId; }, [detailId]);
  useEffect(() => {
    if (!socket) return;
    socket.emit(SOCKET_JOIN_INVENTORY);
    const onUpdated = () => {
      fetchAll();
      if (detailIdRef.current) fetchDetail(detailIdRef.current, true);
    };
    socket.on(SOCKET_ASSET_UPDATED, onUpdated);
    return () => {
      socket?.off(SOCKET_ASSET_UPDATED, onUpdated);
      socket?.emit(SOCKET_LEAVE_INVENTORY);
    };
  }, [fetchAll, fetchDetail]);

  const openRequest = (id: number) => {
    setDetail(null);
    setDetailId(id);
    fetchDetail(id);
  };

  const handleCreate = async (payload: CreateAssetRequestPayload) => {
    setSaving(true);
    try {
      const res = await axios.post(assetSvcRequests, payload);
      toast.success(res.data?.message ?? 'Request raised');
      setRaise(null);
      await fetchAll();
      setTab('board');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to raise request'));
    } finally {
      setSaving(false);
    }
  };

  /** Runs one workflow action. Returns true when it went through. */
  const act = async (id: number, action: AssetAction, extra: Record<string, unknown> = {}) => {
    setActing(true);
    try {
      await axios.post(assetSvcAction(id), { action, ...extra });
      toast.success('Done');
      await Promise.all([fetchAll(), detailIdRef.current === id ? fetchDetail(id, true) : Promise.resolve()]);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
      return false;
    } finally {
      setActing(false);
    }
  };

  const canRaise = canCreate(SCREEN);

  const summary = useMemo(() => {
    const open = requests.filter(r => !isClosed(r.status));
    return {
      inUse: assets.reduce((s, a) => s + (a.in_use_qty || 0), 0),
      products: new Set(assets.filter(a => a.in_use_qty > 0).map(a => a.item_sno)).size,
      service: open.filter(r => r.request_type === 'SERVICE').length,
      late: open.filter(r => daysLate(r) > 0).length,
      returns: open.filter(r => r.request_type === 'RETURN').length,
      openCount: open.length,
    };
  }, [assets, requests]);

  const tabs: { key: TabKey; label: string; count?: number; alert?: boolean }[] = [
    { key: 'register', label: 'Register' },
    { key: 'board', label: 'Requests board', count: summary.openCount },
    { key: 'approvals', label: 'My approvals', count: mine.length, alert: true },
  ];

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-3 px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">GRN <span aria-hidden="true">/</span> Asset Management</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {tab === 'register' ? 'Assets' : tab === 'board' ? 'Requests' : 'My approvals'}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {canRaise && (
                <Button size="sm" onClick={() => setRaise({})}>
                  <Plus className="h-4 w-4" /> Raise request
                </Button>
              )}
            </div>
          </div>
          <nav role="tablist" aria-label="Asset Management sections" className="-mb-px flex gap-6 overflow-x-auto">
            {tabs.map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-1 text-sm transition-colors',
                    active ? 'border-primary font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  {!!t.count && (
                    t.alert
                      ? <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{t.count}</span>
                      : <span className="text-xs text-muted-foreground">{t.count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6">
          {tab === 'register' && (
            <RegisterTab
              rows={assets}
              requests={requests}
              loading={loading}
              canRaise={canRaise}
              summary={summary}
              mineCount={mine.length}
              onRaise={(row, type) => setRaise({ row, type })}
              onOpen={openRequest}
              onShowApprovals={() => setTab('approvals')}
            />
          )}
          {tab === 'board' && (
            <RequestsBoard
              rows={requests}
              loading={loading}
              myEcno={me?.ecno ?? null}
              onOpen={openRequest}
            />
          )}
          {tab === 'approvals' && (
            <ApprovalsTab
              rows={mine}
              loading={loading}
              acting={acting}
              onAct={act}
              onOpen={openRequest}
            />
          )}
        </div>
      </div>

      <RaiseRequestSheet
        intent={raise}
        assets={assets}
        suppliers={suppliers}
        isStoreIncharge={!!me?.is_store_incharge}
        saving={saving}
        onClose={() => setRaise(null)}
        onSubmit={handleCreate}
      />

      <RequestDrawer
        open={detailId !== null}
        detail={detail}
        loading={detailLoading}
        me={me}
        canOperate={canEdit(SCREEN)}
        acting={acting}
        onClose={() => { setDetailId(null); setDetail(null); }}
        onAct={(action, extra) => (detailId ? act(detailId, action, extra) : Promise.resolve(false))}
      />
    </div>
  );
};

export default AssetManagementPage;
