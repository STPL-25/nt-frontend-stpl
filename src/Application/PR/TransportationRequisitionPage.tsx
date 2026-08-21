import React from 'react';
import PurchaseRequisitionPage from './PurchaseRequisitionPage';
import type { PRItemType } from '@/FieldDatas/PRData';

const TRANSPORTATION_ITEM_TYPES: PRItemType[] = ['product', 'service'];

const TransportationRequisitionPage: React.FC = () => (
  <PurchaseRequisitionPage
    requisitionType="transportation"
    pageTitle="Transportation Requisition"
    pageSubtitle="Transportation requisition for fuel/spares and hired fleet services"
    allowedItemTypes={TRANSPORTATION_ITEM_TYPES}
    permissionComponent="TransportationRequisitionPage"
  />
);

export default TransportationRequisitionPage;
