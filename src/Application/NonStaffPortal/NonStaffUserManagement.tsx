import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Loader2 } from 'lucide-react';
import { PageHeader, FormSection } from '@/CustomComponent/PageComponents';
import useFetch from '@/hooks/useFetchHook';
import usePost from '@/hooks/usePostHook';
import { useMasterOptions } from '@/hooks/ReUsableHook/useMasterOptions';
import { apiNonStaffCreate, apiNonStaffList } from '@/Services/Api';
import { toast } from 'sonner';

interface NonStaffUserRow {
  nonstaff_login_sno: number;
  login_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation_name: string;
  must_reset_password: 'Y' | 'N';
  is_active: 'Y' | 'N';
  created_at: string;
}

/**
 * Admin-facing "create a non-staff login" page — the equivalent of the
 * Supplier portal's "Send Portal Invite" action, but as a direct create
 * form (there's no KYC-style approval chain for these designation-based
 * users). Creates the login and emails the temp password only — nothing is
 * shown on screen, matching the Supplier flow.
 */
const NonStaffUserManagement: React.FC = () => {
  const { options } = useMasterOptions(['DesignationMaster']);
  const { DesignationMaster } = options || {};

  const [fullName, setFullName] = useState('');
  const [designationSno, setDesignationSno] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: listData, loading: listLoading } = useFetch<{ success: boolean; data: NonStaffUserRow[] }>(
    apiNonStaffList, '', null, refreshKey
  );
  const users = listData?.data ?? [];

  const { postData, loading: submitting } = usePost();

  const resetForm = () => {
    setFullName(''); setDesignationSno(''); setEmail(''); setPhone('');
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !designationSno || !email.trim()) {
      toast.error('Full name, designation and email are required');
      return;
    }

    try {
      const result = await postData(apiNonStaffCreate, {
        full_name: fullName.trim(),
        designation_sno: Number(designationSno),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });
      const emailSent = (result as any)?.data?.emailSent;
      const generatedLoginId = (result as any)?.data?.login?.login_id;
      toast.success(
        emailSent
          ? `Invite email sent to ${email.trim()} — login ID: ${generatedLoginId}`
          : `User created, but the invite email could not be sent (check the mail server) — login ID: ${generatedLoginId}`
      );
      resetForm();
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to create user');
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader
        icon={UserPlus}
        title="Non-Staff User Management"
        description="Create portal logins for non-staff designations"
      />

      <div className="container mx-auto py-6 px-4 space-y-6">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-6">
            <FormSection icon={UserPlus} title="New user">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., John Doe" />
                </div>
                <div>
                  <Label>Designation</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={designationSno}
                    onChange={(e) => setDesignationSno(e.target.value)}
                  >
                    <option value="">Select designation…</option>
                    {(DesignationMaster ?? []).map((d: any) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {submitting ? 'Creating…' : 'Create user & send invite'}
                </Button>
              </div>
            </FormSection>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-4">Existing non-staff users</h3>
            {listLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No non-staff users created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4">Login ID</th>
                      <th className="py-2 pr-4">Full Name</th>
                      <th className="py-2 pr-4">Designation</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.nonstaff_login_sno} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{u.login_id}</td>
                        <td className="py-2 pr-4">{u.full_name}</td>
                        <td className="py-2 pr-4">{u.designation_name}</td>
                        <td className="py-2 pr-4">{u.email}</td>
                        <td className="py-2 pr-4">{u.phone ?? '-'}</td>
                        <td className="py-2 pr-4">
                          {u.is_active !== 'Y' ? (
                            <Badge variant="destructive">Inactive</Badge>
                          ) : u.must_reset_password === 'Y' ? (
                            <Badge variant="secondary">Invite pending</Badge>
                          ) : (
                            <Badge>Active</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NonStaffUserManagement;
