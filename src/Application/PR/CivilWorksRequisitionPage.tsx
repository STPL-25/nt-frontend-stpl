import React from 'react';
import PurchaseRequisitionPage from './PurchaseRequisitionPage';
import type { PRItemType } from '@/FieldDatas/PRData';

const CIVIL_WORKS_ITEM_TYPES: PRItemType[] = ['product', 'service'];

const CivilWorksRequisitionPage: React.FC = () => (
  <PurchaseRequisitionPage
    requisitionType="civil_works"
    pageTitle="Civil Works Requisition"
    pageSubtitle="Civil works requisition for products and services"
    allowedItemTypes={CIVIL_WORKS_ITEM_TYPES}
    permissionComponent="CivilWorksRequisitionPage"
  />
);

export default CivilWorksRequisitionPage;
