import { useState, useRef } from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

type Maybe<T> = T | null;

interface UseUpdateReturn<T> {
  data: Maybe<T>;
  loading: boolean;
  error: Maybe<string>;
  updateData: (
    url: string,
    query?: string | null,
    payload?: any,
    config?: AxiosRequestConfig
  ) => Promise<Maybe<T>>;
  patchData: (
    url: string,
    payload?: any,
    config?: AxiosRequestConfig
  ) => Promise<Maybe<T>>;
  reset: () => void;
}

const useUpdate = <T = any>(): UseUpdateReturn<T> => {
  const [data, setData] = useState<Maybe<T>>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Maybe<string>>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const updateData = async (
    url: string,
    query: string | null = null,
    payload: any = null,
    config: AxiosRequestConfig = {}
  ): Promise<Maybe<T>> => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const endpoint = query ? `${url}/${query}` : url;

      const response: AxiosResponse<T> = await axios.put(endpoint, payload, {
        ...config,
        signal: abortControllerRef.current.signal,
      });

      setData(response.data);
      return response.data;
    } catch (err: any) {
      const canceled =
        err?.name === "AbortError" ||
        err?.code === "ERR_CANCELED" ||
        (axios.isAxiosError(err) && err.code === "ERR_CANCELED");

      if (canceled) return null;

      const errorMessage =
        err?.response?.data?.message || err?.message || "An error occurred";
      setError(String(errorMessage));
      throw err;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const patchData = async (
    url: string,
    payload: any = null,
    config: AxiosRequestConfig = {}
  ): Promise<Maybe<T>> => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response: AxiosResponse<T> = await axios.patch(url, payload, {
        ...config,
        signal: abortControllerRef.current.signal,
      });

      setData(response.data);
      return response.data;
    } catch (err: any) {
      const canceled =
        err?.name === "AbortError" ||
        err?.code === "ERR_CANCELED" ||
        (axios.isAxiosError(err) && err.code === "ERR_CANCELED");

      if (canceled) return null;

      const errorMessage =
        err?.response?.data?.message || err?.message || "An error occurred";
      setError(String(errorMessage));
      throw err;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
    setLoading(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  return { data, loading, error, updateData, patchData, reset };
};

export default useUpdate;
