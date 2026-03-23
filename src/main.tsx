import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./globalState/store";
import App from "./App";
import axios from "axios";
import { encryptPayload, decryptPayload } from "./Services/apiCrypto";

axios.defaults.withCredentials = true;

// ─── GLOBAL AXIOS REQUEST INTERCEPTOR ───────────────────────────────────────
// Automatically attaches the JWT Bearer token to every request that goes to a
// protected route (/api/*).  Auth routes (/api/secure/*) use Basic Auth and
// must NOT receive a Bearer header — they are skipped here.
axios.interceptors.request.use(
  (config) => {
    const url = config.url ?? "";
    const isAuthRoute = url.includes("/api/secure");

    if (!isAuthRoute) {
      const stored = localStorage.getItem("userToken");
      console.log(stored)
      if (stored) {
        try {
          const parsedToken = JSON.parse(stored);
          // Backend expects: Authorization: Bearer <base64(JSON.stringify({token, iv}))>
          const base64Token = btoa(JSON.stringify(parsedToken));
          config.headers = config.headers ?? {};
          config.headers["Authorization"] = `Bearer ${base64Token}`;
        } catch {
          // Corrupt localStorage entry — let the request through; server returns 401
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── PAYLOAD ENCRYPTION: REQUEST ────────────────────────────────────────────
// Encrypt request body for all protected API routes before sending.
// Skips: /api/secure (login/signup use Basic Auth), FormData (file uploads).
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
// On a 401 response (token expired / invalid), clear stored token and redirect
// to the login page so the user is forced to re-authenticate.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url ?? "";
   let token= localStorage.getItem("userToken");
    // Force-logout only on 401 from protected routes (not from the login call itself)
    if (status === 401 && !requestUrl.includes("/api/secure")&& token) {
      localStorage.removeItem("userToken");
      window.location.reload(); // Simple way to reset app state and redirect to login
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
