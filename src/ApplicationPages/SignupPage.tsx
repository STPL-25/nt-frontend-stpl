import React, { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { useAppState } from "@/globalState/hooks/useAppState";
import { toast } from "sonner";
import usePost from "@/hooks/usePostHook";
import { useSignUpFields } from "@/FieldDatas/SignUpData";
import AuthLayout from "@/LayoutComponent/AuthLayout";
import { ArrowRight, BadgeCheck } from "lucide-react";

const apiUrl = import.meta.env.VITE_API_URL as string;

type FieldDef = {
  field: string;
  label?: string;
  type?: string;
  placeholder?: string;
  require?: boolean;
  options?: Array<{ label?: string; value?: any }>;
  maxLength?: number;
};

export default function SignUp(): JSX.Element {
  const navigate = useNavigate();
  const signUpFields = useSignUpFields();
  const { formData, setFormData } = useAppState() as {
    formData: Record<string, any>;
    setFormData: (v: Record<string, any>) => void;
  };
  const { postData } = usePost();

  const handleInputChange = (field: string, value: any) => {
    const fieldDef = (signUpFields as FieldDef[]).find((f) => f.field === field);
    if (fieldDef?.type === "select") {
      const selected = fieldDef.options?.find((opt) => opt.value == value);
      setFormData({ ...formData, [field]: selected ? selected.value : value });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await postData(`${apiUrl}/api/secure/sign_up`, formData);
      if (response?.success) {
        toast.success(response?.message);
        setFormData({});
        setTimeout(() => navigate("/"), 6000);
      }
    } catch (error: any) {
      setFormData({});
      toast.error(error?.response?.data?.error || "Failed to submit form");
    }
  };

  return (
    <AuthLayout
      wide
      title="Create account"
      subtitle="Create your secure profile to access the procurement workspace."
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        {(signUpFields as FieldDef[]).map((fieldDef) => (
          <CustomInputField
            key={fieldDef.field}
            field={fieldDef.field}
            label={fieldDef.label || ""}
            required={fieldDef.require !== false}
            type={fieldDef.type || "text"}
            placeholder={fieldDef.placeholder}
            value={formData ? formData[fieldDef.field] || "" : ""}
            maxLength={fieldDef?.maxLength}
            showToggle={fieldDef.type === "password"}
            autoComplete={fieldDef.type === "password" ? "new-password" : "off"}
            className="h-12 rounded-xl border-slate-200 bg-slate-50/80 px-4 shadow-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:focus-visible:bg-white/[0.06]"
            onChange={(val: any) => handleInputChange(fieldDef.field, val)}
          />
        ))}

        <Button
          type="submit"
          className="group mt-2 h-12 w-full rounded-xl sm:col-span-2 bg-primary text-sm font-semibold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:translate-y-0"
          size="lg"
        >
          Create account
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>

        <p className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-center text-sm text-muted-foreground sm:col-span-2">
          <BadgeCheck className="h-4 w-4 text-primary" />
          Already have an account?{" "}
          <Link
            to="/"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
