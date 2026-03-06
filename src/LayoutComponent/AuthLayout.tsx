import React from "react";
import stplimage from "@/assets/stpllogo.png";

const FEATURES = [
  "Purchase Requisition Management",
  "Purchase Order Processing",
  "Budget Planning & Control",
  "KYC & Vendor Management",
];

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left Brand Panel ── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-2/5 relative overflow-hidden flex-col justify-between bg-primary p-10 xl:p-14">
        {/* Mesh grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        {/* Decorative blurred circles */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-12 h-32 w-32 -translate-y-1/2 rounded-full bg-white/5 blur-2xl" />

        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="rounded-xl bg-white/10 p-2.5 ring-1 ring-white/20 backdrop-blur-sm">
            <img src={stplimage} alt="STPL" className="h-10 w-auto" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary-foreground/50">
              ERP Console
            </p>
            <h2 className="text-base font-bold text-primary-foreground leading-tight">
              Space Textiles Pvt Ltd
            </h2>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <h3 className="text-3xl xl:text-4xl font-bold text-primary-foreground leading-tight mb-3">
            Non-Trade<br />Procurement
          </h3>
          <p className="text-sm text-primary-foreground/60 leading-relaxed max-w-xs mb-8">
            Streamline your procurement workflow with real-time tracking, approvals, and budget control.
          </p>
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3 text-primary-foreground/75">
                <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/40 flex-shrink-0" />
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-[11px] text-primary-foreground/35">
            © {new Date().getFullYear()} Space Textiles Pvt Ltd. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Mobile brand bar */}
        <div className="flex items-center gap-3 border-b bg-background px-5 py-3.5 lg:hidden">
          <div className="rounded-lg bg-primary/10 p-1.5 ring-1 ring-primary/20">
            <img src={stplimage} alt="STPL" className="h-7 w-auto" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Non-Trade ERP
            </p>
            <p className="text-sm font-bold text-foreground leading-tight">Space Textiles Pvt Ltd</p>
          </div>
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
