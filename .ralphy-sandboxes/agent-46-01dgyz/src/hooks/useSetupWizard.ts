/**
 * Hook for managing the setup wizard state
 * Tracks current step, navigation, and completion
 */

import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { SetupWizardStepId } from '@/types/setup-wizard';
import { SETUP_WIZARD_STEPS } from '@/types/setup-wizard';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

export function useSetupWizard() {
  const { tenant, refreshTenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<SetupWizardStepId>>(new Set());

  const currentStep = SETUP_WIZARD_STEPS[currentStepIndex];
  const totalSteps = SETUP_WIZARD_STEPS.length;
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const markStepCompleted = useCallback((stepId: SetupWizardStepId) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      markStepCompleted(SETUP_WIZARD_STEPS[currentStepIndex].id);
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, totalSteps, markStepCompleted]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < totalSteps) {
      setCurrentStepIndex(index);
    }
  }, [totalSteps]);

  const completeOnboarding = useCallback(async () => {
    if (!tenant?.id) return;
    setIsCompleting(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      if (error) throw error;

      await refreshTenant();
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });

      toast.success('Setup complete! Welcome to FloraIQ.');
      logger.info('Onboarding completed', { tenantId: tenant.id }, { component: 'useSetupWizard' });
    } catch (error) {
      logger.error('Failed to complete onboarding', error instanceof Error ? error : new Error(String(error)), { component: 'useSetupWizard' });
      toast.error('Failed to save progress. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  }, [tenant?.id, refreshTenant, queryClient]);

  const skipOnboarding = useCallback(async () => {
    if (!tenant?.id) return;
    setIsCompleting(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          onboarding_completed: true,
          onboarding_skipped: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      if (error) throw error;

      await refreshTenant();
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });

      toast.info('Setup skipped. You can complete it anytime from Settings.');
      logger.info('Onboarding skipped', { tenantId: tenant.id }, { component: 'useSetupWizard' });
    } catch (error) {
      logger.error('Failed to skip onboarding', error instanceof Error ? error : new Error(String(error)), { component: 'useSetupWizard' });
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  }, [tenant?.id, refreshTenant, queryClient]);

  const stepStatuses = useMemo(() => {
    return SETUP_WIZARD_STEPS.map((step, index) => ({
      ...step,
      isCompleted: completedSteps.has(step.id),
      isCurrent: index === currentStepIndex,
      isUpcoming: index > currentStepIndex,
    }));
  }, [completedSteps, currentStepIndex]);

  return {
    currentStep,
    currentStepIndex,
    totalSteps,
    progressPercent,
    isFirstStep,
    isLastStep,
    isCompleting,
    stepStatuses,
    completedSteps,
    nextStep,
    prevStep,
    goToStep,
    markStepCompleted,
    completeOnboarding,
    skipOnboarding,
  };
}
