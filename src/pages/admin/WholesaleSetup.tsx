import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, Truck, ArrowRight } from "lucide-react";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";

export default function WholesaleSetup() {
  const { navigateToAdmin } = useTenantNavigation();

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 shadow-xl">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-xl font-bold mb-2">Wholesale CRM Setup</h1>
            <p className="text-muted-foreground">
              Set up your wholesale operations by adding your real business data
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 py-8">
            <div className="space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">Add Clients</div>
              <div className="text-xs text-muted-foreground">Your B2B customers</div>
            </div>

            <div className="space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Truck className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">Add Runners</div>
              <div className="text-xs text-muted-foreground">Delivery fleet members</div>
            </div>

            <div className="space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Package className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">Add Products</div>
              <div className="text-xs text-muted-foreground">Your inventory items</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-sm mb-2">✨ Getting Started:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Add your wholesale clients with contact details</li>
                <li>• Configure your delivery runners</li>
                <li>• Import your product inventory</li>
                <li>• Start processing real orders</li>
              </ul>
            </div>

            <Button
              size="lg"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-lg py-6"
              onClick={() => navigateToAdmin("inventory/products")}
            >
              <Package className="h-5 w-5 mr-2" />
              Add Your First Product
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigateToAdmin("dashboard")}
            >
              Skip & Go to Dashboard
            </Button>
          </div>

          <div className="text-xs text-muted-foreground pt-4 border-t">
            💡 Add your real business data to unlock the full power of your wholesale CRM.
          </div>
        </div>
      </Card>
    </div>
  );
}
