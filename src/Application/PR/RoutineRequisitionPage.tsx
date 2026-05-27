import React from 'react';
import PurchaseRequisitionPage from './PurchaseRequisitionPage';
import type { PRItemType } from '@/FieldDatas/PRData';

const ROUTINE_ITEM_TYPES: PRItemType[] = ['product'];

const RoutineRequisitionPage: React.FC = () => (
  <PurchaseRequisitionPage
    requisitionType="routine"
    pageTitle="Routine Requisition"
    pageSubtitle="Routine purchase requisition form"
    allowedItemTypes={ROUTINE_ITEM_TYPES}
    permissionComponent="RoutineRequisitionPage"
  />
);

export default RoutineRequisitionPage;
