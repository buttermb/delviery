import { logger } from '@/lib/logger';
/**
 * Onboarding Progress Widget
 * Shows persistent checklist in sidebar or as a widget
 */

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, X, PartyPopper } from "lucide-react";
import { useOnboardingProgress, OnboardingStep } from "@/hooks/useOnboardingProgress";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import confetti from "canvas-confetti";

interface OnboardingProgressProps {
  tenantId?: string;
  dismissable?: boolean;
}

export function OnboardingProgress({
  tenantId,
  dismissable = true,
}: OnboardingProgressProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const effectiveTenantId = tenantId || tenant?.id;
  const { steps, progress, isComplete } = useOnboardingProgress(effectiveTenantId);
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasShownConfetti, setHasShownConfetti] = useState(false);

  // Load dismissal state from localStorage
  useEffect(() => {
    if (effectiveTenantId) {
      const dismissedKey = `tenant_${effectiveTenantId}_onboarding_dismissed`;
      const dismissed = localStorage.getItem(dismissedKey);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    }
  }, [effectiveTenantId]);

  // Show confetti when 100% complete
  useEffect(() => {
    if (isComplete && !hasShownConfetti && !isDismissed && effectiveTenantId) {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setHasShownConfetti(true);

      // Update database to mark onboarding as complete (safely handle missing columns)
      // Move async code into IIFE to avoid await in useEffect
      (async () => {
        try {
          const updateData: { onboarding_completed: boolean; onboarding_completed_at: string } = {
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          };
          
          const { error: updateError } = await supabase
            .from("tenants")
            .update(updateData)
            .eq("id", effectiveTenantId);
          
          if (updateError && updateError.code !== "42703") {
            logger.warn("Error updating onboarding completion:", updateError);
          } else {
            queryClient.invalidateQueries({ queryKey: ["tenant", effectiveTenantId] });
          }
        } catch (error) {
          logger.warn("Error marking onboarding as complete:", error);
          // Don't throw - confetti can still show
        }
      })();
    }
  }, [isComplete, hasShownConfetti, isDismissed, effectiveTenantId, queryClient]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (effectiveTenantId) {
      localStorage.setItem(
        `tenant_${effectiveTenantId}_onboarding_dismissed`,
        "true"
      );
    }
  };

  if (isDismissed || !effectiveTenantId) return null;

  return (
    <Card className="border-[hsl(var(--tenant-border))] shadow-sm sticky top-24">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-[hsl(var(--tenant-text))]">
            Setup Progress
          </CardTitle>
          {dismissable && isComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isComplete && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 rounded-lg border border-green-200">
            <PartyPopper className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">
                Setup Complete! 🎉
              </p>
              <p className="text-xs text-green-700">
                You're all set to start using the platform
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {steps.map((step: OnboardingStep) => (
            <div key={step.id} className="flex items-center gap-2">
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )}
              <span
                className={`text-sm flex-1 ${
                  step.completed
                    ? "text-green-700 font-medium"
                    : "text-gray-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2 border-t border-[hsl(var(--tenant-border))]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[hsl(var(--tenant-text-light))]">Progress</span>
            <Badge variant="outline">{Math.round(progress)}%</Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {dismissable && isComplete && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="w-full mt-2"
          >
            Dismiss checklist
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

