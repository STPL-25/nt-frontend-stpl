import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/LayoutComponent/AuthLayout';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { supplierAxios, supplierLogin, type SupplierProfile } from '@/Services/SupplierService';
import { SUPPLIER_BRAND } from './supplierBrand';

interface Props {
  onLoggedIn: (token: string, supplier: SupplierProfile, mustResetPassword: boolean) => void;
}

const SupplierLogin: React.FC<Props> = ({ onLoggedIn }) => {
  const [suppCode, setSuppCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await supplierAxios.post(supplierLogin, { supp_code: suppCode, password });
      const { token, must_reset_password, supplier } = res.data?.data ?? {};
      if (!token) throw new Error('Login failed');
      onLoggedIn(token, supplier, Boolean(must_reset_password));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Invalid supplier code or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in with your supplier code to open the Supplier Portal" brand={SUPPLIER_BRAND}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <CustomInputField
          field="supp_code"
          id="supp_code"
          label="Supplier Code"
          type="text"
          placeholder="Enter your supplier code"
          require
          autoComplete="username"
          value={suppCode}
          onChange={(v: string) => setSuppCode(v)}
        />
        <CustomInputField
          field="supplier_password"
          label="Password"
          type="password"
          placeholder="Enter password (or temporary password)"
          require
          id="supplier_password"
          autoComplete="current-password"
          value={password}
          onChange={(v: string) => setPassword(v)}
        />
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>) : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default SupplierLogin;
