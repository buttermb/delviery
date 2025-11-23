import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Package, Users, Truck, Sparkles } from "lucide-react";
import { createSampleWholesaleData } from "@/utils/sampleWholesaleData";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useQueryClient } from "@tanstack/react-query";

interface QuickStartWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function QuickStartWizard({ open, onOpenChange, onComplete }: QuickStartWizardProps) {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const queryClient = useQueryClient();

  const handleQuickStart = async () => {
    setLoading(true);
    try {
      await createSampleWholesaleData();
      
      // Invalidate all relevant queries to refresh dashboard
      queryClient.invalidateQueries({ queryKey: ["wholesale-clients"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-runners"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-dashboard-today"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      
      setCompleted(true);
      showSuccessToast("Quick Start Complete! 🎉", "Sample data has been created for your business");
      
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      showErrorToast("Quick Start Failed", error instanceof Error ? error.message : "Failed to create sample data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Quick Start Setup
          </DialogTitle>
          <DialogDescription className="text-base">
            Get started in seconds with pre-configured sample data for your business operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">6 Clients</div>
              <div className="text-xs text-muted-foreground">Sample B2B customers</div>
            </div>

            <div className="text-center space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Truck className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">5 Runners</div>
              <div className="text-xs text-muted-foreground">Delivery fleet members</div>
            </div>

            <div className="text-center space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Package className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">5 Products</div>
              <div className="text-xs text-muted-foreground">Inventory items</div>
            </div>
          </div>

          {completed && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Setup Complete!</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Your dashboard is now populated with sample data. You can modify or delete this data anytime.
              </p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">What you'll get:</h4>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>✓ Sample wholesale clients with contact details</li>
              <li>✓ Delivery runners with availability status</li>
              <li>✓ Inventory products with stock levels</li>
              <li>✓ Sample orders and payment history</li>
              <li>✓ Active deliveries for testing workflows</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Tip: This sample data helps you explore features immediately. You can always delete it and add your real business data later.
          </p>
        </div>

        <DialogFooter className="gap-2">
          {!completed && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Skip for Now
              </Button>
              <Button
                onClick={handleQuickStart}
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Sample Data...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Quick Setup
                  </>
                )}
              </Button>
            </>
          )}
          {completed && (
            <Button onClick={() => onComplete()} className="w-full">
              Go to Dashboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
