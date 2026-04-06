import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./globalState/store";
import App from "./App";
import axios from "axios";
import { encryptPayload, decryptPayload } from "./Services/apiCrypto";
import { clearUserData, setSessionExpired } from "./globalState/features/decodeSlice";
import { clearSidebarData } from "./globalState/features/fetchSidebarDataSlice";

// Send the session cookie automatically on every request (same as credentials: "include" in fetch)
axios.defaults.withCredentials = true;

// ─── PAYLOAD ENCRYPTION: REQUEST ────────────────────────────────────────────
// Encrypt request body for all protected API routes before sending.
// Skips: /api/secure (login/signup), FormData (file uploads).
axios.interceptors.request.use(async (config) => {
  const url = config.url ?? "";
  const isAuthRoute = url.includes("/api/secure");
  const isFormData = config.data instanceof FormData;

  if (!isAuthRoute && !isFormData && config.data != null) {
    config.data = await encryptPayload(config.data);
  }

  return config;
});

// ─── PAYLOAD DECRYPTION: RESPONSE ───────────────────────────────────────────
// Decrypt response body when the server returns the encrypted { d, iv } shape.
axios.interceptors.response.use(async (response) => {
  const body = response.data;
  if (
    body &&
    typeof body === "object" &&
    typeof body.d === "string" &&
    typeof body.iv === "string" &&
    Object.keys(body).length === 2
  ) {
    response.data = await decryptPayload(body);
  }
  return response;
});

// ─── GLOBAL AXIOS RESPONSE INTERCEPTOR ──────────────────────────────────────
// On a 401 from a protected route the session has expired or timed out.
// Clear Redux auth state — routing reacts immediately and shows the login screen.
// Only fires for non-login/logout routes so that a bad-credentials login attempt
// does NOT clear an existing session.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url ?? "";
    // /api/secure/* = login, signup, logout, /me — never trigger session-expired on these
    const isAuthRoute = requestUrl.includes("/api/secure");
    if (status === 401 && !isAuthRoute) {
      store.dispatch(clearSidebarData());
      store.dispatch(setSessionExpired(true));
    }
    return Promise.reject(error);
  }
);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement as HTMLElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
