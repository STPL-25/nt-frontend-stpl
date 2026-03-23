import React from "react";
import { Star, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PrimaryItemCardProps {
  index: number;
  isPrimary: boolean;
  icon: LucideIcon;
  primaryLabel: string;
  secondaryLabel: string;
  onSetPrimary: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

export function PrimaryItemCard({
  index,
  isPrimary,
  icon: Icon,
  primaryLabel,
  secondaryLabel,
  onSetPrimary,
  onRemove,
  children,
}: PrimaryItemCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border p-4",
        isPrimary
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {isPrimary ? primaryLabel : `${secondaryLabel} ${index + 1}`}
          {isPrimary && (
            <Badge className="ml-1 bg-amber-500 hover:bg-amber-600 text-xs">
              <Star className="h-3 w-3 mr-1" />
              Primary
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {!isPrimary && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSetPrimary}
              className="text-xs h-7"
            >
              <Star className="h-3 w-3 mr-1" />
              Set Primary
            </Button>
          )}
          {!isPrimary && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-7 w-7 text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
