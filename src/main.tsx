import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./globalState/store";
import App from "./App";
import axios from "axios";
import { encryptPayload, decryptPayload } from "./Services/apiCrypto";

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
// On a 401 from a protected route the session has expired.
// Reload to reset app state and show the login screen.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url ?? "";
    // if (status === 401 && !requestUrl.includes("/api/secure")) {
    //   window.location.reload();
    // }
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
