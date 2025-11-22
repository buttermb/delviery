import { useState, useCallback, useEffect } from 'react';
import { safeStorage } from '@/utils/safeStorage';

export interface TutorialState {
  isActive: boolean;
  currentStep: number;
  tutorialId: string | null;
}

const STORAGE_PREFIX = 'tutorial_completed_';
const LAST_SHOWN_PREFIX = 'tutorial_last_shown_';

export function useTutorial() {
  const [state, setState] = useState<TutorialState>({
    isActive: false,
    currentStep: 0,
    tutorialId: null,
  });

  const isTutorialCompleted = useCallback((tutorialId: string): boolean => {
    return safeStorage.getItem(`${STORAGE_PREFIX}${tutorialId}`) === 'true';
  }, []);

  const markTutorialCompleted = useCallback((tutorialId: string) => {
    safeStorage.setItem(`${STORAGE_PREFIX}${tutorialId}`, 'true');
    safeStorage.setItem(`${LAST_SHOWN_PREFIX}${tutorialId}`, Date.now().toString());
  }, []);

  const startTutorial = useCallback((tutorialId: string, force = false) => {
    // Don't auto-start if completed recently (unless forced)
    if (!force && isTutorialCompleted(tutorialId)) {
      const lastShown = safeStorage.getItem(`${LAST_SHOWN_PREFIX}${tutorialId}`);
      if (lastShown) {
        const daysSince = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) {
          return false;
        }
      }
    }

    setState({
      isActive: true,
      currentStep: 0,
      tutorialId,
    });
    return true;
  }, [isTutorialCompleted]);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: prev.currentStep + 1,
    }));
  }, []);

  const previousStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  const skip = useCallback(() => {
    if (state.tutorialId) {
      // Mark as seen but not completed
      safeStorage.setItem(`${LAST_SHOWN_PREFIX}${state.tutorialId}`, Date.now().toString());
    }
    setState({
      isActive: false,
      currentStep: 0,
      tutorialId: null,
    });
  }, [state.tutorialId]);

  const complete = useCallback(() => {
    if (state.tutorialId) {
      markTutorialCompleted(state.tutorialId);
    }
    setState({
      isActive: false,
      currentStep: 0,
      tutorialId: null,
    });
  }, [state.tutorialId, markTutorialCompleted]);

  const resetTutorial = useCallback((tutorialId: string) => {
    safeStorage.removeItem(`${STORAGE_PREFIX}${tutorialId}`);
    safeStorage.removeItem(`${LAST_SHOWN_PREFIX}${tutorialId}`);
  }, []);

  return {
    state,
    isTutorialCompleted,
    startTutorial,
    nextStep,
    previousStep,
    skip,
    complete,
    resetTutorial,
  };
}

