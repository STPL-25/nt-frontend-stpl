import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAllRequiredMasterForOptions } from '@/Services/Api';
interface OptionType {
  value: string | number;
  label: string;
}

interface MasterOptionsResponse {
  [key: string]: OptionType[];
}

export const useMasterOptions = (masterFields: string[]) => {
  const [options, setOptions] = useState<MasterOptionsResponse>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!masterFields || masterFields.length === 0) return;

    const fetchOptions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.post(getAllRequiredMasterForOptions,  {masterFields: masterFields});
          setOptions(response?.data?.data);
      } catch (err) {
        setError('Failed to fetch master options');
        console.error('Error fetching master options:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [masterFields.join(',')]); // Dependency on array content

  return { options, loading, error };
};