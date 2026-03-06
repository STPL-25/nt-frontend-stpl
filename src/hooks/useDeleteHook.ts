import { useState } from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

interface UseDeleteReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  deleteData: (
    url: string,
    payload?: any,
    config?: AxiosRequestConfig
  ) => Promise<T>;
  reset: () => void;
}

const useDelete = <T = any>(): UseDeleteReturn<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const deleteData = async (
    url: string,
    payload: any = null,
    config: AxiosRequestConfig = {}
  ): Promise<T> => {
    const source = axios.CancelToken.source();
    console.log("Deleting data at:", url);

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response: AxiosResponse<T> = await axios.delete(url, {
        ...config,
        data: payload, // axios.delete must use `data` to send body
        cancelToken: source.token,
      });

      console.log(response);
      setData(response.data);
      return response.data;
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log("Request cancelled");
      } else {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "An error occurred";
        setError(errorMessage);
        throw err;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
    setLoading(false);
  };

  return {
    data,
    loading,
    error,
    deleteData,
    reset,
  };
};

export default useDelete;
