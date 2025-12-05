import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle2, 
  Sparkles, 
  Package, 
  Users, 
  FileSpreadsheet,
  ArrowRight,
  PartyPopper
} from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface TrialWelcomeModalProps {
  tenantSlug?: string;
  businessName?: string;
  onClose?: () => void;
}

export function TrialWelcomeModal({ tenantSlug, businessName, onClose }: TrialWelcomeModalProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const isWelcome = searchParams.get("welcome") === "true";
  const isTrial = searchParams.get("trial") === "true";

  // Show modal if welcome=true in URL
  useEffect(() => {
    if (isWelcome) {
      setOpen(true);
      
      // Trigger confetti on open
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
        });
      }, 300);
    }
  }, [isWelcome]);

  const handleClose = () => {
    setOpen(false);
    // Remove welcome and trial params from URL
    searchParams.delete("welcome");
    searchParams.delete("trial");
    setSearchParams(searchParams, { replace: true });
    onClose?.();
  };

  const quickStartItems = [
    {
      icon: Package,
      title: "Add Your First Product",
      description: "Import or manually add your inventory",
      action: () => {
        handleClose();
        navigate(`/${tenantSlug}/admin/inventory/products`);
      },
    },
    {
      icon: Users,
      title: "Add a Customer",
      description: "Start building your customer base",
      action: () => {
        handleClose();
        navigate(`/${tenantSlug}/admin/customers/add`);
      },
    },
    {
      icon: FileSpreadsheet,
      title: "Create a Disposable Menu",
      description: "Share a secure, one-time menu with clients",
      action: () => {
        handleClose();
        navigate(`/${tenantSlug}/admin/menus/create`);
      },
    },
  ];

  if (!isWelcome) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto">
                <PartyPopper className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -right-1 -top-1">
                <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
              </div>
            </div>
          </div>
          
          <DialogTitle className="text-2xl font-bold">
            Welcome to FloraIQ! 🎉
          </DialogTitle>
          
          <DialogDescription className="text-base mt-2">
            {businessName && (
              <span className="block font-medium text-foreground mb-1">
                {businessName}
              </span>
            )}
            Your 14-day free trial has started. Let's get you set up!
          </DialogDescription>
        </DialogHeader>

        {/* Trial Info */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">Trial Activated</p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Full access for 14 days. No charges until then.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Start Items */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-muted-foreground">Get started in minutes:</p>
          {quickStartItems.map((item, index) => (
            <Card
              key={index}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                "group"
              )}
              onClick={item.action}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Explore Dashboard
          </Button>
          <Button 
            className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
            onClick={() => {
              handleClose();
              navigate(`/${tenantSlug}/admin/inventory/products`);
            }}
          >
            Add First Product
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

