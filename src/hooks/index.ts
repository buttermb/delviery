/**
 * Hooks Barrel Export
 * 
 * Export commonly used hooks for easier imports
 */

// Credit System Hooks
export { useCredits } from './useCredits';
export { useCreditTransactions } from './useCreditTransactions';
export { usePurchaseCredits, usePurchaseSuccess } from './usePurchaseCredits';
export { useCreditPromo } from './useCreditPromo';
export { useCreditSubscription } from './useCreditSubscription';
export { useFreeTierLimits } from './useFreeTierLimits';
export { useSmartUpgradeNudge } from './useSmartUpgradeNudge';
export { useCreditUpgradeTriggers } from './useCreditUpgradeTriggers';

// Feature Hooks
export { useFeatureAccess } from './useFeatureAccess';
export { useFeatureTracking } from './useFeatureTracking';

// Auth Hooks
export { useTenantLimits } from './useTenantLimits';
export { usePermissions } from './usePermissions';
export { useAuthGuard } from './useAuthGuard';

// Realtime Hooks
export { useRealtimeSubscription } from './useRealtimeSubscription';

// Toast Hook
export { useToast, toast } from './use-toast';

// Navigation Hooks
export {
  useScrollRestoration,
  useSaveScrollPosition,
  clearScrollPositions,
  saveScrollPositionForPath,
} from './useScrollRestoration';





