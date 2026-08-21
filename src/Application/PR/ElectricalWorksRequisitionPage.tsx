import React from 'react';
import PurchaseRequisitionPage from './PurchaseRequisitionPage';
import type { PRItemType } from '@/FieldDatas/PRData';

const ELECTRICAL_WORKS_ITEM_TYPES: PRItemType[] = ['product', 'service'];

const ElectricalWorksRequisitionPage: React.FC = () => (
  <PurchaseRequisitionPage
    requisitionType="electrical_works"
    pageTitle="Electrical Works Requisition"
    pageSubtitle="Electrical works requisition for products and services"
    allowedItemTypes={ELECTRICAL_WORKS_ITEM_TYPES}
    permissionComponent="ElectricalWorksRequisitionPage"
  />
);

export default ElectricalWorksRequisitionPage;
