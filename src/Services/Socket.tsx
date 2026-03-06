import io from 'socket.io-client';

const baseUrl = import.meta.env.VITE_API_URL || "";

// autoConnect: false — the socket must not connect at module load time because
// there is no JWT token yet.  useAppState watches decryptedData and calls
// socket.auth = { token } + socket.connect() once the user has authenticated.
export const socket = io(baseUrl, {
  autoConnect: false,
  withCredentials: true,
});
