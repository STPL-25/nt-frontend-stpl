import React from "react";
import { ShieldOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLoginAgain: () => void;
}

const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onLoginAgain,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm text-center" showCloseButton={false}>
        <DialogHeader className="items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
            <ShieldOff className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-center text-lg">
              Session Expired
            </DialogTitle>
            <DialogDescription className="text-center">
              Your session has expired due to inactivity or a security event.
              Please log in again to continue.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-2">
          <Button className="w-full gap-2" onClick={onLoginAgain}>
            <LogIn className="w-4 h-4" />
            Login Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionExpiredModal;
