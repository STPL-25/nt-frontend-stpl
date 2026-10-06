import { useEffect, useRef } from 'react';
import {
  socket,
  SOCKET_JOIN_SERVICE_AGREEMENT_APPROVAL, SOCKET_LEAVE_SERVICE_AGREEMENT_APPROVAL, SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED,
  SOCKET_JOIN_SERVICE_PO_APPROVAL, SOCKET_LEAVE_SERVICE_PO_APPROVAL, SOCKET_SERVICE_PO_APPROVAL_UPDATED,
} from '@/Services/Socket';

// ── Real-time ───────────────────────────────────────────────────────────────
// The backend emits on these rooms whenever anyone creates / edits / approves /
// rejects / uploads, or a recurring cycle is raised. Every Service screen (list and
// approval alike) joins the room and just refetches — the SPs stay the source of truth.
const LIVE = {
  agreement: { join: SOCKET_JOIN_SERVICE_AGREEMENT_APPROVAL, leave: SOCKET_LEAVE_SERVICE_AGREEMENT_APPROVAL, event: SOCKET_SERVICE_AGREEMENT_APPROVAL_UPDATED },
  po: { join: SOCKET_JOIN_SERVICE_PO_APPROVAL, leave: SOCKET_LEAVE_SERVICE_PO_APPROVAL, event: SOCKET_SERVICE_PO_APPROVAL_UPDATED },
} as const;

export function useServiceLive(kind: keyof typeof LIVE, onChange: () => void) {
  // latest callback without re-subscribing every render
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });

  useEffect(() => {
    const { join, leave, event } = LIVE[kind];
    const handler = () => cb.current();
    const joinRoom = () => socket.emit(join);
    joinRoom();
    // re-join after a reconnect (the server forgets rooms) and catch up on anything missed
    const onReconnect = () => { joinRoom(); cb.current(); };
    socket.on(event, handler);
    socket.on('connect', onReconnect);
    return () => {
      socket.emit(leave);
      socket.off(event, handler);
      socket.off('connect', onReconnect);
    };
  }, [kind]);
}
