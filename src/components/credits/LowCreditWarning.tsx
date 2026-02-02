import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

interface LowCreditWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuyCredits: () => void;
  currentBalance: number;
}

export function LowCreditWarning({ open, onOpenChange, onBuyCredits, currentBalance }: LowCreditWarningProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertTriangle className="w-6 h-6" />
            <DialogTitle>Low Credit Balance</DialogTitle>
          </div>
          <DialogDescription>
            Your credit balance is running low ({currentBalance} credits remaining).
            Some features may become unavailable soon.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:justify-between sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Remind me later
          </Button>
          <Button onClick={onBuyCredits} className="bg-amber-600 hover:bg-amber-700 text-white">
            Top Up Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

