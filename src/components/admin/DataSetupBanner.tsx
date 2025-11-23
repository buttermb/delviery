import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Database, AlertCircle, Sparkles } from "lucide-react";
import { useWholesaleClients } from "@/hooks/useWholesaleData";
import { QuickStartWizard } from "@/components/onboarding/QuickStartWizard";

export function DataSetupBanner() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useWholesaleClients();
  const [showQuickStart, setShowQuickStart] = useState(false);

  if (isLoading) return null;
  
  if (clients.length === 0) {
    return (
      <>
        <Alert className="border-yellow-500 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 shadow-lg">
          <AlertCircle className="h-6 w-6 text-yellow-500" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-500 font-bold text-lg">
            🚀 Ready to Launch? Your System is Empty
          </AlertTitle>
          <AlertDescription className="space-y-4 mt-2">
            <p className="text-sm font-medium text-foreground">
              Get started in seconds with our Quick Start wizard or add your data manually.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-md"
                onClick={() => setShowQuickStart(true)}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Quick Start (30 seconds)
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/admin/wholesale-clients')}
              >
                <Database className="h-5 w-5 mr-2" />
                Add Data Manually
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Quick Start creates sample clients, products, and runners so you can explore features immediately
            </p>
          </AlertDescription>
        </Alert>

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
