import React, { JSX, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { useAppState } from "@/globalState/hooks/useAppState";
import { useLoginFields } from "@/FieldDatas/SignUpData";
import usePost from "@/hooks/usePostHook";
import { toast } from "sonner";
import AuthLayout from "@/LayoutComponent/AuthLayout";
import { nonStaffLogin } from "@/Services/NonStaffService";

const apiUrl = import.meta.env.VITE_API_URL as string;

interface LoginForm {
  [key: string]: string;
}

export default function SignIn(): JSX.Element {
  const loginFields = useLoginFields();
  const [formData, setFormData] = useState<LoginForm>({});
  const [rememberMe, setRememberMe] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const { postData } = usePost();
  const { setUserData } = useAppState();
  const navigate = useNavigate();

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Non-staff approvers (temporary login ID + password) sign in through this
  // same form and land on the same session-cookie-backed Dashboard as staff —
  // if staff login rejects the credentials, retry them as non-staff before
  // reporting failure. userData is wrapped in an array to match the shape
  // employee login already returns ([{ecno, ename, ...}]), so every existing
  // `userData[0]` read site keeps working, just resolving `.login_id`
  // instead of `.ecno` for a non-staff session.
  const tryNonStaffLogin = async (): Promise<boolean> => {
    try {
      const response = await postData(nonStaffLogin, {
        login_id: formData.ecno,
        password: formData.sign_up_pass,
      });
      if (!response?.success) return false;
      setUserData([response.data]);
      navigate("/");
      return true;
    } catch {
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSigningIn(true);

    try {
      const response = await postData(`${apiUrl}/api/secure/log_user`, { ...formData });

      if (response?.success) {
        toast.success(response?.message);
        // User data comes directly from the server — no token in the browser.
        // The session cookie (HttpOnly) is set automatically by the server.
        setUserData(response.data);
      } else if (response) {
        if (await tryNonStaffLogin()) return;
        toast.error(response?.error || response?.message || "Invalid credentials");
      }
    } catch (error: any) {
      if (await tryNonStaffLogin()) return;
      console.log("Sign-in error:", error);
      toast.error(error?.response?.data?.error || "Invalid ID or password");
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your procurement and approvals workspace."
    >
      <form onSubmit={handleSignIn} className="space-y-5">
        {loginFields.map((fieldDef: any) => (
          <CustomInputField
            key={fieldDef.field}
            field={fieldDef.field}
            label={fieldDef.label}
            required={fieldDef.require !== false}
            type={fieldDef.type || "text"}
            value={formData[fieldDef.field] || ""}
            options={fieldDef.options || []}
            placeholder={fieldDef.placeholder}
            showToggle={fieldDef.showToggle}
            autoComplete={fieldDef.type === "password" ? "current-password" : "username"}
            className="h-12 rounded-xl border-slate-200 bg-slate-50/80 px-4 shadow-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:focus-visible:bg-white/[0.06]"
            onChange={(val: string) => handleInputChange(fieldDef.field, val)}
          />
        ))}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(val) => setRememberMe(Boolean(val))}
              className="h-4.5 w-4.5 rounded border-slate-300 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            />
            <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal text-slate-500 dark:text-slate-400">
              Keep me signed in
            </Label>
          </div>
          <div className="hidden items-center gap-1.5 text-xs font-medium text-emerald-600 sm:flex dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure login
          </div>
        </div>

        <Button
          type="submit"
          className="group h-12 w-full rounded-xl bg-primary text-sm font-semibold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:translate-y-0 disabled:translate-y-0"
          size="lg"
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : <>
            Sign in to workspace
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </>}
        </Button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-white/10" />
          </div>
          <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-[0.18em]">
            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-slate-400 dark:bg-slate-800">New here?</span>
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-slate-500 dark:text-slate-400">
          <BadgeCheck className="h-4 w-4 text-primary" />
          Need access?{" "}
          <Link
            to="/signup"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
