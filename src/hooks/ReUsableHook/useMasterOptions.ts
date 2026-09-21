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

// endpointUrl defaults to the staff-protected master-options endpoint;
// pass apiPublicKycMasterOptions (or similar) to hit a public equivalent
// instead — see SupplierKYCEntry's masterOptionsUrl prop.
export const useMasterOptions = (masterFields: string[], endpointUrl: string = getAllRequiredMasterForOptions) => {
  const [options, setOptions] = useState<MasterOptionsResponse>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!masterFields || masterFields.length === 0) return;

    const fetchOptions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.post(endpointUrl, { masterFields: masterFields }, { withCredentials: true });
          setOptions(response?.data?.data);
      } catch (err) {
        setError('Failed to fetch master options');
        console.error('Error fetching master options:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [masterFields.join(','), endpointUrl]); // Dependency on array content + which endpoint

  return { options, loading, error };
};