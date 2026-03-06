import React,{JSX}from "react";
import { Loader2 } from "lucide-react";

type LoadingSize = "sm" | "md" | "lg" | "xl";
type LoadingVariant = "spinner" | "dots" | "skeleton";

interface LoadingProps {
  size?: LoadingSize;
  text?: string;
  fullScreen?: boolean;
  variant?: LoadingVariant;
}

const Loading: React.FC<LoadingProps> = ({
  size = "md",
  text = "Loading...",
  fullScreen = false,
  variant = "spinner",
}) => {
  const sizeClasses: Record<LoadingSize, string> = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-24 h-24",
  };

  const textSizes: Record<LoadingSize, string> = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };

  const LoadingSpinner = () => (
    <div
      className={`flex items-center justify-center gap-3 ${
        fullScreen ? "min-h-screen" : "p-8"
      }`}
    >
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500`} />
      <span className={`${textSizes[size]} text-gray-600 font-medium`}>
        {text}
      </span>
    </div>
  );

  const LoadingDots = () => (
    <div
      className={`flex items-center justify-center gap-3 ${
        fullScreen ? "min-h-screen" : "p-8"
      }`}
    >
      <div className="flex space-x-1">
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        ></div>
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        ></div>
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        ></div>
      </div>
      <span className={`${textSizes[size]} text-gray-600 font-medium`}>
        {text}
      </span>
    </div>
  );

  const LoadingSkeleton = () => (
    <div
      className={`${fullScreen ? "min-h-screen p-8" : "p-8"} space-y-4`}
    >
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  );

  const variants: Record<LoadingVariant, JSX.Element> = {
    spinner: <LoadingSpinner />,
    dots: <LoadingDots />,
    skeleton: <LoadingSkeleton />,
  };

  return variants[variant] || variants.spinner;
};

export default Loading;
