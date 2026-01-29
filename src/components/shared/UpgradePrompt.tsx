/**
 * Reusable Upgrade Prompt Dialog
 * Shows upgrade dialogs for limit warnings and trial expiration
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  type?: "limit" | "trial" | "feature";
  resource?: string;
  limit?: number;
  currentUsage?: number;
  tenantSlug?: string;
}

export function UpgradePrompt({
  open,
  onOpenChange,
  title,
  description,
  type = "limit",
  resource,
  limit,
  currentUsage,
  tenantSlug,
}: UpgradePromptProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    if (tenantSlug) {
      navigate(`/${tenantSlug}/admin/billing`);
    } else {
      navigate("/billing");
    }
  };

  const getIcon = () => {
    switch (type) {
      case "trial":
        return <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />;
      case "feature":
        return <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getIcon()}
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {type === "limit" && resource && limit && currentUsage !== undefined && (
          <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-zinc-400">Current Usage:</span>
              <span className="font-semibold">
                {currentUsage} / {limit} {resource}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${(currentUsage / limit) * 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} className="bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90">
            Upgrade Now →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

