import React, { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { CustomInputField } from "@/CustomComponent/InputComponents/CustomInputField";
import { useAppState } from "@/globalState/hooks/useAppState";
import { toast } from "sonner";
import usePost from "@/hooks/usePostHook";
import { useSignUpFields } from "@/FieldDatas/SignUpData";
import AuthLayout from "@/LayoutComponent/AuthLayout";

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
      title="Create account"
      subtitle="Fill in your details to get started"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
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
            onChange={(val: any) => handleInputChange(fieldDef.field, val)}
          />
        ))}

        <Button type="submit" className="w-full mt-1" size="lg">
          Create Account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
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
