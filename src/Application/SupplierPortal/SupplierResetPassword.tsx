import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { supplierAxios, supplierResetPassword } from '@/Services/SupplierService';

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>You're using a temporary password — choose a new one to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierResetPassword;
