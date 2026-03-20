/**
 * useFreeTierOnboarding Hook
 * 
 * Manages the FREE tier onboarding flow state:
 * - Tracks current step
 * - Persists progress to localStorage
 * - Determines if flow should show
 * - Analytics tracking for completion/skip rates
 */

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCredits } from '@/hooks/useCredits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';

// ============================================================================
// Types
// ============================================================================

export type OnboardingStep = 'welcome' | 'credits' | 'limits' | 'upgrade';

export interface FreeTierOnboardingState {
    currentStep: OnboardingStep;
    stepIndex: number;
    totalSteps: number;
    isComplete: boolean;
    isSkipped: boolean;
    startedAt: string | null;
    completedAt: string | null;
}

export interface UseFreeTierOnboardingReturn {
    // State
    state: FreeTierOnboardingState;
    isOpen: boolean;
    shouldShow: boolean;

    // Navigation
    nextStep: () => void;
    prevStep: () => void;
    goToStep: (step: OnboardingStep) => void;

    // Actions
    complete: () => void;
    skip: () => void;
    reset: () => void;
    dismiss: () => void;

    // Helpers
    isFirstStep: boolean;
    isLastStep: boolean;
    progressPercent: number;
}

// ============================================================================
// Constants
// ============================================================================

const STEPS: OnboardingStep[] = ['welcome', 'credits', 'limits', 'upgrade'];
const ONBOARDING_STORAGE_KEY = STORAGE_KEYS.FREE_TIER_ONBOARDING;

const initialState: FreeTierOnboardingState = {
    currentStep: 'welcome',
    stepIndex: 0,
    totalSteps: STEPS.length,
    isComplete: false,
    isSkipped: false,
    startedAt: null,
    completedAt: null,
};

// ============================================================================
// Hook
// ============================================================================

export function useFreeTierOnboarding(): UseFreeTierOnboardingReturn {
    const { isFreeTier } = useCredits();
    const { tenant, isAuthenticated } = useTenantAdminAuth();
    const [searchParams] = useSearchParams();

    const [state, setState] = useState<FreeTierOnboardingState>(initialState);
    const [isOpen, setIsOpen] = useState(false);

    // Generate storage key per tenant
    const storageKey = tenant?.id ? `${ONBOARDING_STORAGE_KEY}_${tenant.id}` : ONBOARDING_STORAGE_KEY;

    // Load persisted state on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved) as FreeTierOnboardingState;
                setState(parsed);
            }
        } catch (error) {
            logger.warn('[FreeTierOnboarding] Failed to load saved state', { error });
        }
    }, [storageKey]);

    // Persist state changes
    const persistState = useCallback((newState: FreeTierOnboardingState) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(newState));
        } catch (error) {
            logger.warn('[FreeTierOnboarding] Failed to persist state', { error });
        }
    }, [storageKey]);

    // Suppress auto-open when ?welcome=true is in URL — WelcomeModal handles the greeting
    const hasWelcomeParam = searchParams.get('welcome') === 'true';
    const welcomeSeenKey = tenant?.id ? `welcome_seen_${tenant.id}` : null;
    const welcomeJustSeen = welcomeSeenKey
        ? (sessionStorage.getItem(welcomeSeenKey) === 'true' || localStorage.getItem(welcomeSeenKey) === 'true')
        : false;

    // Check if another modal already has the mutex
    const anotherModalActive = Boolean(sessionStorage.getItem('floraiq_active_modal'));

    // Determine if onboarding should show
    const shouldShow = Boolean(
        isAuthenticated &&
        isFreeTier &&
        tenant &&
        !state.isComplete &&
        !state.isSkipped &&
        !hasWelcomeParam &&
        !welcomeJustSeen &&
        !anotherModalActive &&
        // Only show for relatively new tenants (created in last 7 days)
        tenant.created_at &&
        new Date(tenant.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    // Auto-open when conditions are met
    useEffect(() => {
        if (shouldShow && !isOpen && !state.isComplete && !state.isSkipped) {
            // Small delay to let the dashboard load first
            const timer = setTimeout(() => {
                // Re-check mutex at open time (another modal may have claimed it during the delay)
                if (sessionStorage.getItem('floraiq_active_modal')) return;
                sessionStorage.setItem('floraiq_active_modal', 'free_tier_onboarding');
                setIsOpen(true);
                if (!state.startedAt) {
                    const newState = { ...state, startedAt: new Date().toISOString() };
                    setState(newState);
                    persistState(newState);
                    logger.info('[FreeTierOnboarding] Started onboarding flow', { tenantId: tenant?.id });
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [shouldShow, isOpen, state, persistState, tenant?.id]);

    // Navigation functions
    const nextStep = useCallback(() => {
        const nextIndex = state.stepIndex + 1;
        if (nextIndex < STEPS.length) {
            const newState = {
                ...state,
                stepIndex: nextIndex,
                currentStep: STEPS[nextIndex],
            };
            setState(newState);
            persistState(newState);
            logger.debug('[FreeTierOnboarding] Next step', { step: STEPS[nextIndex] });
        }
    }, [state, persistState]);

    const prevStep = useCallback(() => {
        const prevIndex = state.stepIndex - 1;
        if (prevIndex >= 0) {
            const newState = {
                ...state,
                stepIndex: prevIndex,
                currentStep: STEPS[prevIndex],
            };
            setState(newState);
            persistState(newState);
        }
    }, [state, persistState]);

    const goToStep = useCallback((step: OnboardingStep) => {
        const stepIndex = STEPS.indexOf(step);
        if (stepIndex >= 0) {
            const newState = {
                ...state,
                stepIndex,
                currentStep: step,
            };
            setState(newState);
            persistState(newState);
        }
    }, [state, persistState]);

    // Action functions
    const complete = useCallback(() => {
        const newState = {
            ...state,
            isComplete: true,
            completedAt: new Date().toISOString(),
        };
        setState(newState);
        persistState(newState);
        setIsOpen(false);
        sessionStorage.removeItem('floraiq_active_modal');
        logger.info('[FreeTierOnboarding] Completed onboarding', {
            tenantId: tenant?.id,
            duration: state.startedAt
                ? Date.now() - new Date(state.startedAt).getTime()
                : null
        });
    }, [state, persistState, tenant?.id]);

    const skip = useCallback(() => {
        const newState = {
            ...state,
            isSkipped: true,
            completedAt: new Date().toISOString(),
        };
        setState(newState);
        persistState(newState);
        setIsOpen(false);
        sessionStorage.removeItem('floraiq_active_modal');
        logger.info('[FreeTierOnboarding] Skipped onboarding', {
            tenantId: tenant?.id,
            stepReached: state.currentStep
        });
    }, [state, persistState, tenant?.id]);

    const reset = useCallback(() => {
        setState(initialState);
        localStorage.removeItem(storageKey);
        setIsOpen(false);
    }, [storageKey]);

    const dismiss = useCallback(() => {
        setIsOpen(false);
        sessionStorage.removeItem('floraiq_active_modal');
    }, []);

    return {
        state,
        isOpen,
        shouldShow,
        nextStep,
        prevStep,
        goToStep,
        complete,
        skip,
        reset,
        dismiss,
        isFirstStep: state.stepIndex === 0,
        isLastStep: state.stepIndex === STEPS.length - 1,
        progressPercent: ((state.stepIndex + 1) / STEPS.length) * 100,
    };
}

export default useFreeTierOnboarding;
