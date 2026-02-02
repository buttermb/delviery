import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Package from "lucide-react/dist/esm/icons/package";
import Users from "lucide-react/dist/esm/icons/users";
import Truck from "lucide-react/dist/esm/icons/truck";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import { useNavigate, useParams } from "react-router-dom";

interface QuickStartWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function QuickStartWizard({ open, onOpenChange, onComplete }: QuickStartWizardProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const handleAddProducts = () => {
    onOpenChange(false);
    navigate(`/${tenantSlug}/admin/inventory/products`);
  };

  const handleAddClients = () => {
    onOpenChange(false);
    navigate(`/${tenantSlug}/admin/big-plug-clients`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Welcome to Your Dashboard!
          </DialogTitle>
          <DialogDescription className="text-base">
            Get started by adding your real business data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={handleAddProducts}
              className="text-center space-y-2 p-4 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Package className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">Add Products</div>
              <div className="text-xs text-muted-foreground">Your inventory</div>
            </button>

            <button
              onClick={handleAddClients}
              className="text-center space-y-2 p-4 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">Add Clients</div>
              <div className="text-xs text-muted-foreground">Your customers</div>
            </button>

            <div className="text-center space-y-2 p-4 rounded-lg opacity-50">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Truck className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-sm font-medium">Add Runners</div>
              <div className="text-xs text-muted-foreground">Delivery fleet</div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">Quick Setup Guide:</h4>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>1. Add your products to start managing inventory</li>
              <li>2. Add your wholesale clients</li>
              <li>3. Create orders and track deliveries</li>
              <li>4. Use the POS for walk-in sales</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Your dashboard will populate automatically as you add data. All features work with real data only.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleAddProducts}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Package className="h-4 w-4 mr-2" />
            Add First Product
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

