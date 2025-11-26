import { logger } from '@/lib/logger';
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Package, Users, Truck } from "lucide-react";
import { createSampleWholesaleData } from "@/utils/sampleWholesaleData";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";

export default function WholesaleSetup() {
  const { navigateToAdmin } = useTenantNavigation();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      logger.info("Starting sample data creation...", { component: 'WholesaleSetup' });
      const result = await createSampleWholesaleData();
      logger.info("Sample data created", { result, component: 'WholesaleSetup' });
      setCompleted(true);
      showSuccessToast("🎉 Setup Complete!", "Sample wholesale data has been created successfully");

      setTimeout(() => {
        navigateToAdmin("wholesale-dashboard");
      }, 2000);
    } catch (error) {
      logger.error("Setup error", error, { component: 'WholesaleSetup' });
      showErrorToast("Setup Failed", error instanceof Error ? error.message : "Failed to create sample data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full p-8 shadow-xl">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">💎 Wholesale CRM Quick Setup</h1>
            <p className="text-muted-foreground">
              Initialize your wholesale operations with ready-to-use sample data
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 py-8">
            <div className="space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">6 Clients</div>
              <div className="text-xs text-muted-foreground">Sample B2B customers across NYC</div>
            </div>

            <div className="space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Truck className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">5 Runners</div>
              <div className="text-xs text-muted-foreground">Delivery fleet members</div>
            </div>

            <div className="space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Package className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">5 Products</div>
              <div className="text-xs text-muted-foreground">Inventory items with stock levels</div>
            </div>
          </div>

          {completed ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-6 w-6" />
                <span className="font-semibold">Setup Complete! 🎉</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                <h4 className="font-semibold text-sm mb-2">✨ What you'll get:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Wholesale clients with contact details and payment history</li>
                  <li>• Delivery runners with GPS locations</li>
                  <li>• Product inventory with real stock levels</li>
                  <li>• Sample orders and deliveries</li>
                  <li>• Financial data for testing reports</li>
                </ul>
              </div>

              <Button
                size="lg"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-lg py-6"
                onClick={handleSetup}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating Sample Data...
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5 mr-2" />
                    Initialize Wholesale System (30 seconds)
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigateToAdmin("wholesale-dashboard")}
              >
                Skip & Go to Dashboard
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-4 border-t">
            💡 This creates realistic sample data to help you explore features. You can modify or delete it anytime.
          </div>
        </div>
      </Card>
    </div>
  );
}
