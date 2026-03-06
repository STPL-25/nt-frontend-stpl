import { useState, useEffect } from "react";
import axios, { AxiosError } from "axios";

interface MasterItem {
  id: string;
  name: string;
  // ➤ Add more fields based on your API response
}

interface FetchDataReturn {
  data: MasterItem[] | null;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

const fetchDataFunction = (): FetchDataReturn => {
  const [data, setData] = useState<MasterItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL as string;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get<MasterItem[]>(`${apiUrl}/api/MasterItems`);

      setData(response.data);
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : "An error occurred while fetching data";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, fetchData };
};

export default fetchDataFunction;
