import io from 'socket.io-client';

const baseUrl = import.meta.env.VITE_API_URL || "";

// autoConnect: false — the socket must not connect at module load time because
// there is no JWT token yet.  useAppState watches decryptedData and calls
// socket.auth = { token } + socket.connect() once the user has authenticated.
export const socket = io(baseUrl, {
  autoConnect: false,
  withCredentials: true,
});

// ── Socket lifecycle events ───────────────────────────────────────────────────
export const SOCKET_CONNECT = "connect";
export const SOCKET_DISCONNECT = "disconnect";
export const SOCKET_CONNECT_ERROR = "connect_error";
export const SOCKET_RECONNECT_ATTEMPT = "reconnect_attempt";
export const SOCKET_RECONNECT = "reconnect";
export const SOCKET_RECONNECT_FAILED = "reconnect_failed";

// ── Room events ───────────────────────────────────────────────────────────────
export const SOCKET_JOIN_COMPANY = "join-company";
export const SOCKET_LEAVE_COMPANY = "leave-company";
export const SOCKET_JOIN_PR_SCOPE = "join-pr-scope";
export const SOCKET_LEAVE_PR_SCOPE = "leave-pr-scope";
export const SOCKET_JOIN_PR_APPROVAL = "join-pr-approval";
export const SOCKET_LEAVE_PR_APPROVAL = "leave-pr-approval";
export const SOCKET_JOIN_PO_APPROVAL = "join-po-approval";
export const SOCKET_LEAVE_PO_APPROVAL = "leave-po-approval";

// ── PR approval real-time events ─────────────────────────────────────────────
export const SOCKET_PR_APPROVAL_UPDATED = "pr:approval:updated";

// ── PO approval real-time events ─────────────────────────────────────────────
export const SOCKET_PO_APPROVAL_UPDATED = "po:approval:updated";

// ── KYC room + real-time events ───────────────────────────────────────────────
export const SOCKET_JOIN_KYC_APPROVAL    = "join-kyc-approval";
export const SOCKET_LEAVE_KYC_APPROVAL   = "leave-kyc-approval";
export const SOCKET_KYC_SUBMITTED        = "kyc:submitted";
export const SOCKET_KYC_APPROVAL_UPDATED = "kyc:approval:updated";

// ── PR draft real-time events ─────────────────────────────────────────────────
export const SOCKET_PR_DRAFT_NEW = "pr:draft:new";
export const SOCKET_PR_DRAFT_UPDATED = "pr:draft:updated";
export const SOCKET_PR_DRAFT_DELETED = "pr:draft:deleted";
export const SOCKET_PR_DRAFT_SUBMITTED = "pr:draft:submitted";
export const SOCKET_PR_DRAFT_ALL_SUBMITTED = "pr:draft:all_submitted";

// ── Master data events ────────────────────────────────────────────────────────
export const SOCKET_MASTER_UPDATED = "master:updated";

// ── Notification events ───────────────────────────────────────────────────────
export const SOCKET_NOTIFICATION_NEW = "notification:new";

// ── Purchase Team room + real-time events ─────────────────────────────────────
export const SOCKET_JOIN_PURCHASE_TEAM  = "join-purchase-team";
export const SOCKET_LEAVE_PURCHASE_TEAM = "leave-purchase-team";
export const SOCKET_PT_SPLIT_UPDATED    = "pt:split:updated";

// ── GRN / Gate Entry room + real-time events ──────────────────────────────────
export const SOCKET_JOIN_GRN  = "join-grn";
export const SOCKET_LEAVE_GRN = "leave-grn";
export const SOCKET_GRN_CREATED             = "grn:created";
export const SOCKET_GRN_DRAFT_NEW           = "grn:draft:new";
export const SOCKET_GRN_DRAFT_UPDATED       = "grn:draft:updated";
export const SOCKET_GRN_DRAFT_DELETED       = "grn:draft:deleted";
export const SOCKET_GRN_DRAFT_SUBMITTED     = "grn:draft:submitted";
export const SOCKET_GATE_ENTRY_CREATED        = "gate_entry:created";
export const SOCKET_GATE_ENTRY_STATUS_UPDATED = "gate_entry:status_updated";

// ── Inventory room + real-time events ─────────────────────────────────────────
export const SOCKET_JOIN_INVENTORY  = "join-inventory";
export const SOCKET_LEAVE_INVENTORY = "leave-inventory";
export const SOCKET_INVENTORY_UPDATED = "inventory:updated";
// Stock requests share the inventory room (issuing changes stock)
export const SOCKET_STOCK_REQUEST_UPDATED = "stockrequest:updated";

// ── User / permission events ──────────────────────────────────────────────────
export const SOCKET_PERMISSIONS_UPDATED          = "permissions:updated";
export const SOCKET_USER_NEW                     = "user:new";
export const SOCKET_ADMIN_PERMISSIONS_UPDATED    = "admin:permissions:updated";
