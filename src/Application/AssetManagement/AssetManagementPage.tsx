import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Boxes, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/CustomComponent/PageComponents';
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

import AssetsTab from './AssetManagement/AssetsTab';
import RequestsTable from './AssetManagement/RequestsTable';
import RequestDialog from './AssetManagement/RequestDialog';
import RequestDetailDialog from './AssetManagement/RequestDetailDialog';

const SCREEN = 'AssetManagementPage';

const AssetManagementPage: React.FC = () => {
  const { canCreate, canEdit } = usePermissions();

  const [tab, setTab] = useState('assets');
  const [me, setMe] = useState<AssetMe | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [service, setService] = useState<AssetRequest[]>([]);
  const [returns, setReturns] = useState<AssetRequest[]>([]);
  const [mine, setMine] = useState<AssetRequest[]>([]);
  const [suppliers, setSuppliers] = useState<AssetSupplier[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialog, setDialog] = useState<{ type: 'RETURN' | 'SERVICE'; row: AssetRow } | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AssetRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s, r, m] = await Promise.all([
        axios.get(assetSvcRegister, { params: { only_in_use: 1 } }),
        axios.get(assetSvcRequests, { params: { request_type: 'SERVICE', only_open: 1 } }),
        axios.get(assetSvcRequests, { params: { request_type: 'RETURN' } }),
        axios.get(assetSvcRequests, { params: { mine_approvals: 1, only_open: 1 } }),
      ]);
      setAssets(a.data?.data ?? []);
      setService(s.data?.data ?? []);
      setReturns(r.data?.data ?? []);
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

  const openRequest = (r: AssetRequest) => {
    setDetail(null);
    setDetailId(r.asset_req_sno);
    fetchDetail(r.asset_req_sno);
  };

  const handleCreate = async (payload: CreateAssetRequestPayload) => {
    setSaving(true);
    try {
      const res = await axios.post(assetSvcRequests, payload);
      toast.success(res.data?.message ?? 'Request raised');
      setDialog(null);
      await fetchAll();
      setTab(payload.request_type === 'RETURN' ? 'returns' : 'service');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to raise request'));
    } finally {
      setSaving(false);
    }
  };

  const handleAct = async (action: AssetAction, extra: Record<string, unknown> = {}) => {
    if (!detailId) return;
    setActing(true);
    try {
      await axios.post(assetSvcAction(detailId), { action, ...extra });
      toast.success('Done');
      await Promise.all([fetchAll(), fetchDetail(detailId, true)]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setActing(false);
    }
  };

  const canRaise = canCreate(SCREEN);

  return (
    <div className="flex h-full flex-col bg-background">
      <PageHeader
        icon={Boxes}
        title="Asset Management"
        description="Non-Regular items issued to departments — return to supplier or send for service"
      >
        <Button
          variant="outline"
          size="sm"
          className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={fetchAll}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'mr-1 animate-spin' : 'mr-1'} /> Refresh
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="service">
              In Service {service.length > 0 && <Badge variant="secondary" className="ml-1.5">{service.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="approvals">
              My Approvals {mine.length > 0 && <Badge className="ml-1.5">{mine.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets">
            <AssetsTab
              rows={assets}
              loading={loading}
              canRaise={canRaise}
              onReturn={row => setDialog({ type: 'RETURN', row })}
              onService={row => setDialog({ type: 'SERVICE', row })}
            />
          </TabsContent>
          <TabsContent value="service">
            <RequestsTable
              rows={service}
              loading={loading}
              emptyText="Nothing is in service. Items sent for service appear here until they return OK."
              onOpen={openRequest}
            />
          </TabsContent>
          <TabsContent value="returns">
            <RequestsTable
              rows={returns}
              loading={loading}
              emptyText="No return requests yet."
              onOpen={openRequest}
            />
          </TabsContent>
          <TabsContent value="approvals">
            <RequestsTable
              rows={mine}
              loading={loading}
              emptyText="Nothing is waiting for your approval."
              onOpen={openRequest}
            />
          </TabsContent>
        </Tabs>
      </div>

      <RequestDialog
        open={!!dialog}
        type={dialog?.type ?? 'RETURN'}
        row={dialog?.row ?? null}
        suppliers={suppliers}
        isStoreIncharge={!!me?.is_store_incharge}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={handleCreate}
      />

      <RequestDetailDialog
        open={detailId !== null}
        detail={detail}
        loading={detailLoading}
        me={me}
        canOperate={canEdit(SCREEN)}
        acting={acting}
        onClose={() => { setDetailId(null); setDetail(null); }}
        onAct={handleAct}
      />
    </div>
  );
};

export default AssetManagementPage;
