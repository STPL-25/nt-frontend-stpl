import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface DynamicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  Icon?: React.ComponentType<{ className?: string }>;

  children: React.ReactNode;

  onSave?: () => void;
  onCancel?: () => void;

  saveText?: string;
  cancelText?: string;

  loading?: boolean;
  hideFooter?: boolean;
}

const DynamicDialog: React.FC<DynamicDialogProps> = ({
  open,  onOpenChange,  title,  Icon,  children,  onSave,  onCancel,  saveText = "Save Changes",  cancelText = "Cancel",  loading = false,  hideFooter = false,}) => {
  const handleClose = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-[95vw] sm:max-w-2xl lg:max-w-4xl
          p-4 sm:p-6
          overflow-hidden
        "
      >
        {/* ---------- HEADER ---------- */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-2xl">
            {Icon && <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <Separator className="my-2" />

        {/* ---------- BODY ---------- */}
        <div className="overflow-y-auto max-h-[60vh] sm:max-h-[65vh] px-0 sm:px-1">
          {children}
        </div>

        {/* ---------- FOOTER ---------- */}
        {!hideFooter && (
          <DialogFooter className="mt-3 sm:mt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              {cancelText}
            </Button>

            {onSave && (
              <Button onClick={onSave} disabled={loading}>
                {loading ? "Saving..." : saveText}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DynamicDialog;
