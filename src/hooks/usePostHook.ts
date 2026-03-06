import { useState, useCallback, useRef, useEffect } from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

type Maybe<T> = T | null;

interface UsePostReturn<T> {
  data: Maybe<T>;
  loading: boolean;
  error: Maybe<string>;
  postData: (url: string, payload?: any, config?: AxiosRequestConfig) => Promise<Maybe<T>>;
  reset: () => void;
  cancel: () => void;
}

/**
 * Generic usePost hook
 * @example
 * const { postData } = usePost<MyResponseType>();
 */
const usePost = <T = any>(): UsePostReturn<T> => {
  const [data, setData] = useState<Maybe<T>>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Maybe<string>>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // typed env reads (may be undefined)
  const baseURL = (import.meta.env.VITE_API_URL as string) || undefined;
  const username = (import.meta.env.VITE_USER_NAME as string) || undefined;
  const password = (import.meta.env.VITE_USER_PASSWORD as string) || undefined;

  const postData = useCallback(
    async (url: string, payload: any = null, config: AxiosRequestConfig = {}): Promise<Maybe<T>> => {
      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        setLoading(true);
        setError(null);
        setData(null);

        // clone config to avoid mutating user config
        const requestConfig: AxiosRequestConfig = { ...config };

        // Basic Auth is ONLY for /api/secure routes (login / signup).
        // All other routes use Bearer JWT set by the global axios interceptor.
        const isAuthRoute = url.includes("/api/secure");
        if (isAuthRoute && username && password && !requestConfig.auth) {
          requestConfig.auth = { username, password };
        }

        // Attach abort signal (axios supports signal in modern versions)
        (requestConfig as any).signal = abortControllerRef.current.signal;

        // Prepend baseURL if provided and url is relative
        const endpoint =
          baseURL && !/^(https?:)?\/\//i.test(url) ? `${baseURL.replace(/\/$/, "")}/${url.replace(/^\//, "")}` : url;

        const response: AxiosResponse<T> = await axios.post(endpoint, payload, requestConfig);

        setData(response.data);
        return response.data;
      } catch (err: unknown) {
        const e = err as any;

        // Treat axios cancellation and AbortError similarly
        const canceled =
          e?.name === "AbortError" ||
          e?.code === "ERR_CANCELED" ||
          (axios.isAxiosError(e) && e.code === "ERR_CANCELED");

        if (canceled) {
          // Request was intentionally cancelled
          // keep data as null and do not set an error
          console.log("Request cancelled");
          return null;
        } else {
          const errorMessage =
            e?.response?.data?.error ||
            e?.response?.data?.message ||
            e?.message ||
            "An error occurred";
          setError(String(errorMessage));
          throw err;
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [baseURL, username, password]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    postData,
    reset,
    cancel,
  };
};

export default usePost;
