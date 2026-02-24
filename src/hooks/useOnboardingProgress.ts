import { logger } from '@/lib/logger';
/**
 * Hook to calculate onboarding progress
 * Tracks completion of setup steps
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface UseOnboardingProgressResult {
  steps: OnboardingStep[];
  progress: number;
  isComplete: boolean;
  completedCount: number;
  totalSteps: number;
}

export function useOnboardingProgress(tenantId: string | undefined): UseOnboardingProgressResult {
  const { data: tenant } = useQuery({
    queryKey: queryKeys.tenantSingle.byId(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("usage, limits, onboarding_completed")
          .eq("id", tenantId)
          .maybeSingle();

        // If columns don't exist (error code 42703), return defaults
        if (error && error.code === "42703") {
          return {
            usage: {},
            limits: {},
            onboarding_completed: false,
          };
        }

        if (error) throw error;
        return data;
      } catch (error: unknown) {
        // Return safe defaults if query fails
        logger.warn("Error fetching onboarding progress:", error);
        return {
          usage: {},
          limits: {},
          onboarding_completed: false,
        };
      }
    },
    enabled: !!tenantId,
  });

  const usage = (tenant?.usage ?? {}) as Record<string, number>;

  const steps: OnboardingStep[] = [
    { id: "account", label: "Account Created", completed: true },
    { id: "products", label: "Products Added", completed: (usage.products || 0) > 0 },
    { id: "customers", label: "Customers Added", completed: (usage.customers || 0) > 0 },
    { id: "menu", label: "Menu Created", completed: (usage.menus || 0) > 0 },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  // Only show as complete if all steps are done AND not already marked as completed
  // This prevents showing the completion modal multiple times
  const isComplete = progress === 100 && tenant?.onboarding_completed !== true;

  return { steps, progress, isComplete, completedCount, totalSteps: steps.length };
}

