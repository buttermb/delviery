import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Users, Truck, ArrowRight, FileUp, X, CheckCircle2, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CustomerImportDialog } from "@/components/admin/CustomerImportDialog";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { cn } from "@/lib/utils";

interface QuickStartWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function QuickStartWizard({ open, onOpenChange, onComplete }: QuickStartWizardProps) {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const tenantSlug = tenant?.slug;
  const isPaidTier = tenant?.subscription_plan === 'professional' || tenant?.subscription_plan === 'enterprise';

  const [activeStep, setActiveStep] = useState<'overview' | 'import_clients'>('overview');
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveStep('overview');
    }
  }, [open]);

  // Close dialog, navigate, then mark complete after a delay.
  // onComplete() calls queryClient.invalidateQueries() which wipes the
  // feature toggles cache — if that fires before the target page mounts,
  // FeatureProtectedRoute sees no cached data and blocks the page.
  const closeAndNavigate = (path?: string) => {
    onOpenChange(false);
    if (path && tenantSlug) navigate(path);
    // Defer onComplete so query cache stays intact during navigation
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    onOpenChange(false);
    setTimeout(onComplete, 300);
  };

  const handleAddProducts = () => {
    closeAndNavigate(`/${tenantSlug}/admin/inventory-hub?tab=products`);
  };

  const handleAddClients = () => {
    closeAndNavigate(`/${tenantSlug}/admin/customer-hub?tab=contacts`);
  };

  const handleAddRunners = () => {
    if (!isPaidTier) return;
    closeAndNavigate(`/${tenantSlug}/admin/fulfillment-hub?tab=couriers`);
  };

  const handleOpenImport = () => {
    // Close the wizard first, then open import dialog to avoid nested dialogs
    onOpenChange(false);
    setTimeout(() => setShowImportDialog(true), 150);
  };

  const overviewContent = (
    <motion.div
      key="overview"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Rocket className="h-6 w-6 text-primary" />
          Welcome to Your Dashboard
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl">
          Complete these initial setup steps to populate your dashboard with real business data. All features and modules will activate automatically as data flows in.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Products Card */}
        <button
          onClick={handleAddProducts}
          className="group relative flex flex-col p-5 bg-card border border-border rounded-xl text-left transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold mb-1 text-card-foreground">Add Products</h3>
          <p className="text-sm text-muted-foreground flex-1">Setup your inventory and start selling instantly.</p>
          <div className="mt-4 flex shrink-0 items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Get started <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </button>

        {/* Clients Card */}
        <button
          onClick={() => setActiveStep('import_clients')}
          className="group relative flex flex-col p-5 bg-card border border-border rounded-xl text-left transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold mb-1 text-card-foreground">Add Clients</h3>
          <p className="text-sm flex-1 text-muted-foreground">Import or add your customer list to start tracking.</p>
          <div className="mt-4 shrink-0 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Import customers <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </button>

        {/* Runners Card */}
        <button
          onClick={isPaidTier ? handleAddRunners : undefined}
          disabled={!isPaidTier}
          className={cn(
            "group relative flex flex-col p-5 rounded-xl text-left transition-all border",
            isPaidTier 
              ? "bg-card border-border hover:shadow-md hover:border-primary/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" 
              : "bg-muted/50 border-transparent opacity-80 cursor-not-allowed"
          )}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={cn(
              "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center",
              isPaidTier ? "bg-primary/10 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
            )}>
              <Truck className="h-5 w-5" />
            </div>
            {!isPaidTier && (
              <Badge variant="secondary" className="text-[10px] uppercase font-medium tracking-wide">
                Pro+
              </Badge>
            )}
          </div>
          
          <h3 className={cn("text-base font-semibold mb-1", isPaidTier ? "text-card-foreground" : "text-muted-foreground")}>
            Add Runners
          </h3>
          
          <p className="text-sm text-muted-foreground flex-1">
            {isPaidTier ? "Assign drivers for your incoming delivery fleet." : "Upgrade to unlock enterprise delivery routing."}
          </p>
          
          {isPaidTier && (
            <div className="mt-4 shrink-0 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Setup fleet <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          )}
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h4 className="font-semibold text-sm mb-4 text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Quick Setup Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-4">
          {[
            { step: 1, label: 'Add Products', desc: 'Start managing your inventory', path: `/${tenantSlug}/admin/inventory-hub?tab=products` },
            { step: 2, label: 'Add Wholesale Clients', desc: 'Build your customer base', path: `/${tenantSlug}/admin/customer-hub?tab=contacts` },
            { step: 3, label: 'Create Orders', desc: 'Track deliveries seamlessly', path: `/${tenantSlug}/admin/orders?new=true` },
            { step: 4, label: 'Use the POS', desc: 'Perfect for walk-in sales', path: `/${tenantSlug}/admin/pos-system` },
          ].map(({ step, label, desc, path }) => (
            <button
              key={step}
              onClick={() => closeAndNavigate(path)}
              className="flex items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50 group"
            >
              <div className="flex-shrink-0 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{step}</div>
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 mt-0.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-border gap-4">
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
          Skip for now
        </Button>
        <Button onClick={handleAddProducts} className="w-full sm:w-auto">
          Add First Product
        </Button>
      </div>
    </motion.div>
  );

  const importClientsContent = (
    <motion.div
      key="import_clients"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <Button variant="ghost" size="icon" onClick={() => setActiveStep('overview')} className="h-8 w-8 rounded-full">
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Add Your Clients</h2>
          <p className="text-muted-foreground text-sm">How would you like to add your customers?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Manual Add */}
        <button
          onClick={handleAddClients}
          className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-xl hover:bg-accent/50 hover:border-primary/40 transition-all text-center group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-base text-card-foreground">Add Manually</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Type in customer details one by one. Perfect for a small list.
          </p>
        </button>

        {/* CSV Upload */}
        <button
          onClick={handleOpenImport}
          className="flex flex-col items-center justify-center p-8 bg-muted/30 border border-dashed border-border rounded-xl hover:bg-muted/60 hover:border-primary/40 transition-all text-center group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <div className="h-12 w-12 bg-background border border-border rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-sm">
            <FileUp className="h-6 w-6 text-foreground" />
          </div>
          <h3 className="font-semibold text-base text-foreground">Import Customers</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Upload a CSV or Excel file. Automatically maps fields.
          </p>
          <div className="mt-4 text-xs font-medium text-foreground bg-background border border-border px-3 py-1 rounded-md shadow-sm">
            .csv, .xlsx, .xls
          </div>
        </button>
      </div>

    </motion.div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 overflow-y-auto max-h-[85vh] bg-background border-border shadow-xl sm:rounded-2xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 h-8 w-8 rounded-full z-50 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {activeStep === 'overview' ? overviewContent : importClientsContent}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
      {/* Import dialog rendered outside the wizard dialog to avoid nested dialog z-index issues */}
      <CustomerImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={() => {
          setShowImportDialog(false);
          onComplete();
          if (tenantSlug) navigate(`/${tenantSlug}/admin/customer-hub?tab=contacts`);
        }}
      />
    </>
  );
}
