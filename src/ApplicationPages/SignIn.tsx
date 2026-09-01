import React, { JSX, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
      subtitle="Enter your credentials to access your account"
    >
      <form onSubmit={handleSignIn} className="space-y-4">
        {loginFields.map((fieldDef: any) => (
          <CustomInputField
            key={fieldDef.field}
            field={fieldDef.field}
            label={fieldDef.label}
            required={fieldDef.require !== false}
            type={fieldDef.type || "text"}
            value={formData[fieldDef.field] || ""}
            options={fieldDef.options || []}
            onChange={(val: string) => handleInputChange(fieldDef.field, val)}
          />
        ))}

        <div className="flex items-center gap-2">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(val) => setRememberMe(Boolean(val))}
          />
          <Label htmlFor="remember-me" className="text-sm cursor-pointer text-muted-foreground">
            Remember me
          </Label>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isSigningIn}>
          {isSigningIn ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or</span>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign Up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
