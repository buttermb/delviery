import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { Button } from "@/components/ui/button";
import { Database, Sparkles } from "lucide-react";
import { useWholesaleClients } from "@/hooks/useWholesaleData";
import { QuickStartWizard } from "@/components/onboarding/QuickStartWizard";

export function DataSetupBanner() {
  useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { data: clients = [], isLoading } = useWholesaleClients();
  const [showQuickStart, setShowQuickStart] = useState(false);

  if (isLoading) return null;

  if (clients.length === 0) {
    return (
      <>
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 p-6 shadow-sm mb-6">
          <div className="absolute top-0 right-0 p-8 translate-x-1/3 -translate-y-1/3">
            <div className="w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
                <Sparkles className="h-5 w-5" />
                <span>Ready to Launch? Your System is Empty</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                Set up your dashboard to unlock all features
              </h3>
              <p className="text-muted-foreground">
                Get started in seconds with our interactive Quick Start wizard. We'll guide you through adding your first products, clients, and getting your store ready for sales.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 min-w-[200px]">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                onClick={() => setShowQuickStart(true)}
              >
                Launch Quick Start
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all border-indigo-200 dark:border-indigo-800"
                onClick={() => navigateToAdmin('wholesale-clients')}
              >
                <Database className="h-4 w-4 mr-2" />
                Add Manually
              </Button>
            </div>
          </div>
        </div>

        <QuickStartWizard
          open={showQuickStart}
          onOpenChange={setShowQuickStart}
          onComplete={() => {
            setShowQuickStart(false);
            window.location.reload(); // Refresh to show new data
          }}
        />
      </>
    );
  }

  return null;
}
