/**
 * GRN microservice API layer (grn-service, port 8084)
 *
 * Covers the three domains the microservice owns:
 *   - Gate Entry        (/api/gate_entry)  → gateEntryApi.ts
 *   - GRN (approved-PO based) (/api/grn)   → grnApi.ts
 *   - Inventory         (/api/inventory)   → inventoryApi.ts
 *
 * Base URL + response envelope live in base.ts (see routing notes there).
 */

export * from './base';
export * from './gateEntryApi';
export * from './grnApi';
export * from './inventoryApi';
export * from './stockRequestApi';
