import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Users, Truck, Sparkles, ArrowRight, FileUp, X, CheckCircle2 } from "lucide-react";
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
  const isEnterprise = tenant?.subscription_plan === 'enterprise';

  const [activeStep, setActiveStep] = useState<'overview' | 'import_clients'>('overview');
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveStep('overview');
      setShowImportDialog(false);
    }
  }, [open]);

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  const handleAddProducts = () => {
    onComplete();
    onOpenChange(false);
    if (tenantSlug) navigate(`/${tenantSlug}/admin/inventory-hub?tab=products`);
  };

  const handleAddClients = () => {
    onComplete();
    onOpenChange(false);
    if (tenantSlug) navigate(`/${tenantSlug}/admin/big-plug-clients`);
  };

  const handleAddRunners = () => {
    if (!isEnterprise) return;
    onComplete();
    onOpenChange(false);
    if (tenantSlug) navigate(`/${tenantSlug}/admin/fulfillment-hub?tab=couriers`);
  };

  const overviewContent = (
    <motion.div
      key="overview"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center transform hover:rotate-6 transition-transform">
          <Sparkles className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600 dark:from-emerald-400 dark:to-blue-400">
          Welcome to Your Dashboard!
        </h2>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Get started by adding your real business data. Your dashboard will populate automatically as you add data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Products Card */}
        <motion.button
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAddProducts}
          className="relative flex flex-col group overflow-hidden bg-card border shadow-sm hover:shadow-xl hover:border-emerald-500/50 rounded-2xl p-6 text-left transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="h-14 w-14 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-600 shadow-inner">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Add Products</h3>
          <p className="text-sm text-muted-foreground flex-1">Setup your inventory and start selling instantly.</p>
          <div className="mt-4 flex shrink-0 items-center text-sm font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
            Get started <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </motion.button>

        {/* Clients Card */}
        <motion.button
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveStep('import_clients')}
          className="relative flex flex-col group overflow-hidden bg-card border shadow-sm hover:shadow-xl hover:border-blue-500/50 rounded-2xl p-6 text-left transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="h-14 w-14 shrink-0 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center mb-4 text-blue-600 shadow-inner">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Add Clients</h3>
          <p className="text-sm flex-1 text-muted-foreground">Import or add your customer list to start tracking.</p>
          <div className="mt-4 shrink-0 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
            Import customers <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </motion.button>

        {/* Runners Card */}
        <motion.button
          whileHover={isEnterprise ? { y: -5, scale: 1.02 } : {}}
          whileTap={isEnterprise ? { scale: 0.98 } : {}}
          onClick={isEnterprise ? handleAddRunners : undefined}
          className={cn(
            "relative flex flex-col group overflow-hidden border rounded-2xl p-6 text-left transition-all duration-300",
            isEnterprise 
              ? "bg-card shadow-sm hover:shadow-xl hover:border-violet-500/50 cursor-pointer" 
              : "bg-muted/30 border-muted opacity-60 cursor-not-allowed"
          )}
        >
          {isEnterprise && <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
          
          <div className={cn(
            "h-14 w-14 shrink-0 rounded-full flex items-center justify-center mb-4 shadow-inner",
            isEnterprise ? "bg-violet-100 dark:bg-violet-500/10 text-violet-600" : "bg-muted-foreground/10 text-muted-foreground"
          )}>
            <Truck className="h-6 w-6" />
          </div>
          
          <div className="flex justify-between items-start mb-1 gap-2 shrink-0">
            <h3 className="text-lg font-semibold shrink-0">Add Runners</h3>
            {!isEnterprise && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0 bg-background/50">Pro+</Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground flex-1">
            {isEnterprise ? "Assign drivers for your incoming delivery fleet." : "Upgrade to unlock enterprise delivery routing and fleet management."}
          </p>
          
          {isEnterprise && (
            <div className="mt-4 shrink-0 flex items-center text-sm font-medium text-violet-600 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
              Setup fleet <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          )}
        </motion.button>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border rounded-2xl p-6 shadow-inner">
        <h4 className="font-semibold text-base mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          Quick Setup Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center text-xs font-bold text-muted-foreground">1</div>
            <div>
              <p className="text-sm font-medium">Add Products</p>
              <p className="text-xs text-muted-foreground">Start managing your inventory</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center text-xs font-bold text-muted-foreground">2</div>
            <div>
              <p className="text-sm font-medium">Add Wholesale Clients</p>
              <p className="text-xs text-muted-foreground">Build your customer base</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center text-xs font-bold text-muted-foreground">3</div>
            <div>
              <p className="text-sm font-medium">Create Orders</p>
              <p className="text-xs text-muted-foreground">Track deliveries seamlessly</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center text-xs font-bold text-muted-foreground">4</div>
            <div>
              <p className="text-sm font-medium">Use the POS</p>
              <p className="text-xs text-muted-foreground">Perfect for walk-in sales</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center pt-2 gap-4">
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground hover:text-foreground">
          Skip for now
        </Button>
        <Button onClick={handleAddProducts} size="lg" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 shadow-md hover:shadow-lg transition-all">
          <Package className="h-4 w-4 mr-2" />
          Add First Product
        </Button>
      </div>
    </motion.div>
  );

  const importClientsContent = (
    <motion.div
      key="import_clients"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setActiveStep('overview')} className="rounded-full bg-muted/50 hover:bg-muted">
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Add Your Clients</h2>
          <p className="text-muted-foreground text-sm">How would you like to add your customers?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        {/* Manual Add */}
        <motion.button
          whileHover={{ y: -2, scale: 1.01 }}
          onClick={handleAddClients}
          className="flex flex-col items-center justify-center p-8 border rounded-2xl bg-card hover:bg-muted/30 hover:border-primary/50 transition-all text-center group"
        >
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Add Manually</h3>
          <p className="text-sm text-muted-foreground mt-2 px-4">
            Type in customer details one by one. Perfect for a small list.
          </p>
        </motion.button>

        {/* CSV Upload */}
        <motion.button
          whileHover={{ y: -2, scale: 1.01 }}
          onClick={() => setShowImportDialog(true)}
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:border-blue-500 transition-all text-center group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-100">Import Customers</h3>
          <p className="text-sm text-blue-700/70 dark:text-blue-300/70 mt-2 px-4">
            Upload a CSV or Excel file. Automatically maps fields.
          </p>
          <div className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-3 py-1 rounded-full">
            .csv, .xlsx, .xls
          </div>
        </motion.button>
      </div>

      <CustomerImportDialog 
        open={showImportDialog} 
        onOpenChange={setShowImportDialog}
        onSuccess={() => {
          setShowImportDialog(false);
          onComplete();
          onOpenChange(false);
          if (tenantSlug) navigate(`/${tenantSlug}/admin/big-plug-clients`);
        }} 
      />
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-y-auto max-h-[85vh] bg-background/80 backdrop-blur-xl border-accent/20 shadow-2xl">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-full z-50 text-muted-foreground hover:bg-muted/50"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="p-6 md:p-12 relative">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl opacity-50" />
          </div>

          <AnimatePresence mode="wait">
            {activeStep === 'overview' ? overviewContent : importClientsContent}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
