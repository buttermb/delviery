/**
 * Onboarding Completion Modal
 * Shows confetti and "Setup Complete!" message when all onboarding steps are finished
 */

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PartyPopper, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface OnboardingCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug?: string;
  tenantId?: string;
}

export function OnboardingCompletionModal({
  open,
  onOpenChange,
  tenantSlug,
  tenantId,
}: OnboardingCompletionModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      // Trigger confetti animation
      const duration = 3000;
      const end = Date.now() + duration;
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });

        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [open]);

  const handleContinue = async () => {
    // Mark onboarding as complete in database
    if (tenantId) {
      await supabase
        .from("tenants")
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", tenantId);
      
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    }
    
    onOpenChange(false);
    if (tenantSlug) {
      navigate(`/${tenantSlug}/admin/dashboard`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <PartyPopper className="h-10 w-10 text-green-600" />
            </div>
            <DialogTitle className="text-3xl font-bold text-green-900 mb-2">
              Setup Complete! 🎉
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
              You're all set to start using the platform
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Account Created</p>
              <p className="text-sm text-green-700">Your account is ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Products Added</p>
              <p className="text-sm text-green-700">Your inventory is set up</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Customers Added</p>
              <p className="text-sm text-green-700">Your CRM is ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Menu Created</p>
              <p className="text-sm text-green-700">Start sharing with customers</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px] touch-manipulation"
            onClick={() => onOpenChange(false)}
          >
            Stay Here
          </Button>
          <Button
            className="flex-1 bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 min-h-[44px] touch-manipulation"
            onClick={handleContinue}
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

