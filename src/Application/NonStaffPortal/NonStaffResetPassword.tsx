import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import usePost from '@/hooks/usePostHook';
import { nonStaffResetPassword } from '@/Services/NonStaffService';

interface Props {
  onDone: () => void;
  loginId?: string | null;
}

// Forced/self password reset shown as a popup over the Dashboard (not a
// full-page redirect) when a non-staff session's must_reset_password is
// still true — mirrors the employee Dashboard shell everywhere else.
const NonStaffResetPassword: React.FC<Props> = ({ onDone, loginId }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { postData, loading: submitting } = usePost();

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
    if (loginId && newPassword.toUpperCase().includes(loginId.toUpperCase())) {
      toast.error('Password must not contain your login ID');
      return;
    }
    try {
      await postData(nonStaffResetPassword, { new_password: newPassword });
      toast.success('Password updated');
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not update password');
    }
  };

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            You're using a temporary password — choose a new one to continue.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ns-new-password">New password</Label>
            <Input
              id="ns-new-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ns-confirm-password">Confirm password</Label>
            <Input
              id="ns-confirm-password"
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
      </DialogContent>
    </Dialog>
  );
};

export default NonStaffResetPassword;
