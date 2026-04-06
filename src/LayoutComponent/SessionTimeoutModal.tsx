import React from "react";
import { Clock, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionTimeoutModalProps {
  isOpen: boolean;
  countdown: number; // seconds remaining
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  countdown,
  onStayLoggedIn,
  onLogoutNow,
}) => {
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // progress 1 → 0 as countdown runs down
  const progress = countdown / 120;

  // Stroke for the SVG ring
  const radius     = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Clicking the overlay = "Stay Logged In"
        if (!open) onStayLoggedIn();
      }}
    >
      <DialogContent
        className="sm:max-w-sm text-center"
        showCloseButton={false}
      >
        <DialogHeader className="items-center gap-4">
          {/* Animated countdown ring */}
          <div className="relative flex items-center justify-center w-20 h-20">
            {/* Background ring */}
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 64 64"
            >
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                strokeWidth="4"
                className="stroke-muted"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="stroke-amber-500 transition-all duration-1000 ease-linear"
              />
            </svg>
            {/* Clock icon in the centre */}
            <div className="z-10 flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-center text-lg">
              Session Expiring Soon
            </DialogTitle>
            <DialogDescription className="text-center">
              You've been inactive for a while. Your session will automatically
              end in:
            </DialogDescription>
          </div>

          {/* Big countdown display */}
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {formatted}
            </span>
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-2 flex-col sm:flex-col gap-2">
          <Button
            className="w-full gap-2"
            onClick={onStayLoggedIn}
          >
            <ShieldCheck className="w-4 h-4" />
            Stay Logged In
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive"
            onClick={onLogoutNow}
          >
            <LogOut className="w-4 h-4" />
            Logout Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionTimeoutModal;
