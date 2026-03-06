import { useState } from "react";
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

/**
 * Generic useUpdate hook (PUT / PATCH)
 * Usage: const { updateData } = useUpdate<MyResponseType>();
 */
const useUpdate = <T = any>(): UseUpdateReturn<T> => {
  const [data, setData] = useState<Maybe<T>>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Maybe<string>>(null);

  const updateData = async (
    url: string,
    query: string | null = null,
    payload: any = null,
    config: AxiosRequestConfig = {}
  ): Promise<Maybe<T>> => {
    const source = axios.CancelToken.source();

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const endpoint = query ? `${url}/${query}` : url;
      console.log(endpoint);

      const response: AxiosResponse<T> = await axios.put(endpoint, payload, {
        ...config,
        cancelToken: source.token,
      });

      setData(response.data);
      return response.data;
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log("Request cancelled");
        return null;
      } else {
        const errorMessage =
          err?.response?.data?.message || err?.message || "An error occurred";
        setError(String(errorMessage));
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  const patchData = async (
    url: string,
    payload: any = null,
    config: AxiosRequestConfig = {}
  ): Promise<Maybe<T>> => {
    const source = axios.CancelToken.source();
    console.log("Patching data at:", url, "with payload:", payload);

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response: AxiosResponse<T> = await axios.patch(url, payload, {
        ...config,
        cancelToken: source.token,
      });

      setData(response.data);
      return response.data;
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log("Request cancelled");
        return null;
      } else {
        const errorMessage =
          err?.response?.data?.message || err?.message || "An error occurred";
        setError(String(errorMessage));
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
    setLoading(false);
  };

  return { data, loading, error, updateData, patchData, reset };
};

export default useUpdate;
