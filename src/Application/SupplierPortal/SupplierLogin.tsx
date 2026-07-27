import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { supplierAxios, supplierLogin, type SupplierProfile } from '@/Services/SupplierService';

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
          <CardTitle>Supplier Portal</CardTitle>
          <CardDescription>Sign in to view purchase orders</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-code">Supplier Code</Label>
              <Input
                id="supplier-code"
                type="text"
                autoComplete="username"
                required
                value={suppCode}
                onChange={(e) => setSuppCode(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-password">Password</Label>
              <Input
                id="supplier-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierLogin;
