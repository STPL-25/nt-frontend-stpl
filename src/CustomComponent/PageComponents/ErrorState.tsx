import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  fullPage?: boolean;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  fullPage = false,
}: ErrorStateProps) {
  const inner = (
    <div className="text-center space-y-4 p-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <p className="text-foreground font-medium text-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        {inner}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-20">{inner}</div>;
}
