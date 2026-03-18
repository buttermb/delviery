import { useCallback } from 'react';
import { haptics } from '@/utils/haptics';

/**
 * Hook to easily integrate haptic feedback into components
 */
export function useHapticFeedback() {
  const triggerLight = useCallback(() => haptics.light(), []);
  const triggerMedium = useCallback(() => haptics.medium(), []);
  const triggerHeavy = useCallback(() => haptics.heavy(), []);
  const triggerSuccess = useCallback(() => haptics.success(), []);
  const triggerError = useCallback(() => haptics.error(), []);
  const triggerSelection = useCallback(() => haptics.selection(), []);

  // Wrapper for onClick handlers
  const withHaptic = useCallback((callback: () => void, type: 'light' | 'medium' | 'heavy' = 'light') => {
    return () => {
      haptics[type]();
      callback();
    };
  }, []);

  return {
    triggerLight,
    triggerMedium,
    triggerHeavy,
    triggerSuccess,
    triggerError,
    triggerSelection,
    withHaptic,
  };
}
