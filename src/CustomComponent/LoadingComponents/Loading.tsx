import React from "react";
import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

type LoadingSize = "sm" | "md" | "lg" | "xl";
type LoadingVariant = "spinner" | "dots" | "skeleton";

interface LoadingProps {
  size?: LoadingSize;
  text?: string;
  fullScreen?: boolean;
  variant?: LoadingVariant;
}

interface SpaceLogoLoaderProps {
  size?: LoadingSize;
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const LOADER_TEXT_SIZES: Record<LoadingSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
  xl: "text-base",
};

const LoadingDots: React.FC<Required<Pick<LoadingProps, "size" | "text" | "fullScreen">>> = ({
  size,
  text,
  fullScreen,
}) => (
  <div className={cn("flex items-center justify-center gap-3", fullScreen ? "min-h-screen" : "p-8")}>
    <div className="flex space-x-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
    <span className={cn("font-medium text-muted-foreground", LOADER_TEXT_SIZES[size])}>{text}</span>
  </div>
);

const LoadingSkeleton: React.FC<{ fullScreen: boolean }> = ({ fullScreen }) => (
  <div className={cn("space-y-4 p-8", fullScreen && "min-h-screen")}>
    <div className="animate-pulse">
      <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
      <div className="mb-2 h-4 w-1/2 rounded bg-muted" />
      <div className="mb-4 h-32 rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
    </div>
  </div>
);

/** Branded loader: the Space symbol fills from bottom to top in a soft loop. */
export const SpaceLogoLoader: React.FC<SpaceLogoLoaderProps> = ({
  size = "md",
  text = "Loading...",
  fullScreen = false,
  className,
}) => {
  const markSizes: Record<LoadingSize, string> = {
    sm: "h-9",
    md: "h-12",
    lg: "h-16",
    xl: "h-24",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullScreen ? "min-h-screen" : "py-8",
        className
      )}
    >
      <div className={cn("space-logo-loader relative aspect-[9/10]", markSizes[size])} aria-hidden="true">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
        <BrandLogo compact className="absolute inset-0 h-full opacity-[0.16] grayscale" />
        <div className="space-logo-loader__fill absolute inset-0 overflow-hidden">
          <BrandLogo compact className="absolute inset-0 h-full drop-shadow-[0_5px_12px_color-mix(in_oklab,var(--primary)_28%,transparent)]" />
        </div>
        <span className="space-logo-loader__shine absolute inset-x-1 bottom-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
      {text ? (
        <div className="space-y-1.5 text-center">
          <p className={cn("font-semibold tracking-wide text-foreground", LOADER_TEXT_SIZES[size])}>{text}</p>
          <div className="mx-auto h-1 w-20 overflow-hidden rounded-full bg-primary/10">
            <span className="space-logo-loader__progress block h-full w-1/2 rounded-full bg-primary" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Loading: React.FC<LoadingProps> = ({
  size = "md",
  text = "Loading...",
  fullScreen = false,
  variant = "spinner",
}) => {
  if (variant === "dots") {
    return <LoadingDots size={size} text={text} fullScreen={fullScreen} />;
  }
  if (variant === "skeleton") {
    return <LoadingSkeleton fullScreen={fullScreen} />;
  }
  return <SpaceLogoLoader size={size} text={text} fullScreen={fullScreen} />;
};

export default Loading;
