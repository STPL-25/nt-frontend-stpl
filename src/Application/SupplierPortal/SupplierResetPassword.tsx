import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/LayoutComponent/AuthLayout';
import { CustomInputField } from '@/CustomComponent/InputComponents/CustomInputField';
import { supplierAxios, supplierResetPassword } from '@/Services/SupplierService';
import { SUPPLIER_BRAND } from './supplierBrand';

interface Props {
  onDone: () => void;
  suppCode?: string | null;
}

const SupplierResetPassword: React.FC<Props> = ({ onDone, suppCode }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (suppCode && newPassword.toUpperCase().includes(suppCode.toUpperCase())) {
      toast.error('Password must not contain your supplier code');
      return;
    }
    setSubmitting(true);
    try {
      await supplierAxios.post(supplierResetPassword, { new_password: newPassword });
      toast.success('Password updated');
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Set a new password" subtitle="You're using a temporary password - choose a new one to continue" brand={SUPPLIER_BRAND}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <CustomInputField
          field="new_password" id="new_password" label="New password" type="password" placeholder="At least 6 characters" require
          autoComplete="new-password" value={newPassword} onChange={(v: string) => setNewPassword(v)}
        />
        <CustomInputField
          field="confirm_password" id="confirm_password" label="Confirm password" type="password" placeholder="Type it again" require
          autoComplete="new-password" value={confirmPassword} onChange={(v: string) => setConfirmPassword(v)}
        />
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>) : 'Save password'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default SupplierResetPassword;
