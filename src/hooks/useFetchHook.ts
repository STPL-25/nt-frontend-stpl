import { useState, useEffect } from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

type Params = Record<string, any> | null;

interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Generic data-fetching hook.
 *
 * Pass `null` as the URL to skip the fetch entirely (useful for conditional
 * fetches like `selectedId ? url + selectedId : null`).
 *
 * The `refreshKey` param can be bumped to force a re-fetch of the same URL
 * (e.g. after a real-time socket event).
 */
const useFetch = <T = any>(
  url: string | null,
  query: string = "",
  params: Params = null,
  refreshKey: number = 0
): UseFetchReturn<T> => {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // Skip if no URL supplied
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const endpoint = query ? `${url}/${query}` : url;
        const config: AxiosRequestConfig = {
          params: params ?? undefined,
          signal: controller.signal as unknown as AbortSignal,
        };
        const response: AxiosResponse<T> = await axios.get(endpoint, config);
        setData(response.data);
      } catch (err: any) {
        if (controller.signal.aborted) return; // request cancelled — ignore
        const message =
          err?.response?.data?.message || err?.message || "An error occurred";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(params), query, refreshKey]);

  return { data, loading, error };
};

export default useFetch;
