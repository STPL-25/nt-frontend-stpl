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

// ── PR approval real-time events ─────────────────────────────────────────────
export const SOCKET_PR_APPROVAL_UPDATED = "pr:approval:updated";

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

// ── User / permission events ──────────────────────────────────────────────────
export const SOCKET_PERMISSIONS_UPDATED          = "permissions:updated";
export const SOCKET_USER_NEW                     = "user:new";
export const SOCKET_ADMIN_PERMISSIONS_UPDATED    = "admin:permissions:updated";
