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
export { useRealTimeSubscription as useRealtimeSubscription } from './useRealtimeSubscription';
export { useMenuInventorySync } from './useMenuInventorySync';
export type {
  MenuProductStockStatus,
  ProductStockChange,
  UseMenuInventorySyncOptions,
  UseMenuInventorySyncResult,
} from './useMenuInventorySync';

// Sync Status Hooks
export { useSyncStatus } from './useSyncStatus';
export type { SyncStatus, UseSyncStatusReturn } from './useSyncStatus';

// Toast Hook
export { useToast, toast } from './use-toast';

// Navigation Hooks
export {
  useScrollRestoration,
  useSaveScrollPosition,
  clearScrollPositions,
  saveScrollPositionForPath,
} from './useScrollRestoration';

// Keyboard Navigation Hooks
export {
  useKeyboardNavigation,
  useInitialFocus,
  useEnterSubmit,
  useTabOrder,
  getFocusableElements,
  focusFirstElement,
  focusElement,
} from './useKeyboardNavigation';

// Order Lifecycle Hooks
export { usePOSSale } from './usePOSSale';
export { useProcessRefund } from './useProcessRefund';

