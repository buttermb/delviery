/**
 * Hook to calculate onboarding progress
 * Tracks completion of setup steps
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface UseOnboardingProgressResult {
  steps: OnboardingStep[];
  progress: number;
  isComplete: boolean;
}

export function useOnboardingProgress(tenantId: string | undefined): UseOnboardingProgressResult {
  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select("usage, limits, onboarding_completed")
        .eq("id", tenantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const usage = tenant?.usage || {};

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

