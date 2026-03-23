import React from "react";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SectionActionCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  isComplete?: boolean;
  onClick: () => void;
}

export function SectionActionCard({
  title,
  description,
  icon: Icon,
  isComplete,
  onClick,
}: SectionActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full text-left overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
              {title}
            </h3>
            {isComplete ? (
              <Badge className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-600 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Done
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex-shrink-0 text-xs">
                Pending
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}
