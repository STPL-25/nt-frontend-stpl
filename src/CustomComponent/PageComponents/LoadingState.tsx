import React from "react";

interface LoadingStateProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingState({ message = "Loading...", fullPage = false }: LoadingStateProps) {
  const inner = (
    <div className="text-center space-y-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
        <div className="animate-spin rounded-full h-7 w-7 border-[3px] border-primary border-t-transparent" />
      </div>
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
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
