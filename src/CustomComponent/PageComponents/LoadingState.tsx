import React from "react";
import { SpaceLogoLoader } from "@/CustomComponent/LoadingComponents/Loading";

interface LoadingStateProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingState({ message = "Loading...", fullPage = false }: LoadingStateProps) {
  const inner = <SpaceLogoLoader size="lg" text={message} className="py-10" />;

  if (fullPage) {
    return (
      <div className="min-h-full flex items-center justify-center bg-muted/20">
        {inner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-20">
      {inner}
    </div>
  );
}
