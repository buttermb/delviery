/**
 * Friction Reduction Components - Barrel Export
 * Complete collection of friction reduction components for admin panel
 */

// ============ STATUS & QUICK ACTIONS ============
// Status dropdown for inline status changes (1 click instead of 3-4)
export {
  StatusDropdown,
  ORDER_STATUSES,
  MENU_ORDER_STATUSES,
  WHOLESALE_ORDER_STATUSES,
  PAYMENT_STATUSES,
} from '../StatusDropdown';
export type { StatusOption } from '../StatusDropdown';

// Quick message button for instant customer communication
export { QuickMessageButton } from '../QuickMessageButton';

// Context menu for right-click order actions
export {
  OrderRowContextMenu,
  useOrderContextActions,
} from '../OrderRowContextMenu';
export type { OrderContextAction, OrderStatus } from '../OrderRowContextMenu';

// Unified status colors and badge
export { STATUS_COLORS, getStatusColors, getStatusBadgeClasses } from '@/constants/statusColors';
export type { StatusKey } from '@/constants/statusColors';
export { StatusBadge, StatusDot } from '@/components/ui/status-badge';
export type { StatusBadgeProps } from '@/components/ui/status-badge';

// ============ DATA ENTRY ============
// Expression calculator for inline math (20%, cost + 30%)
export {
  ExpressionInput,
  DiscountInput,
  MarkupInput,
} from '@/components/ui/expression-input';

// Date picker with quick presets (Today, Tomorrow, etc.)
export { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';

// Unit conversion display (lbs ↔ oz ↔ kg)
export { UnitConversionDisplay, WeightInputWithConversion, convertWeight, convertVolume } from '@/components/ui/unit-conversion-display';

// Field help tooltips
export { FieldHelp, LabelWithHelp, fieldHelpTexts } from '@/components/ui/field-help';

// Searchable filter dropdowns
export { SearchableFilterDropdown } from '@/components/ui/searchable-filter-dropdown';

// Form progress indicators
export { FormProgress, FormStepHeader } from '@/components/ui/form-progress';

// ============ SEARCH & NAVIGATION ============
// Fuzzy search hook with highlighting
export { useFuzzySearch, highlightMatches } from '@/hooks/useFuzzySearch';

// Global data search hook
export { useDataSearch } from '@/hooks/useDataSearch';

// URL-based filter persistence
export { useUrlFilters, useOrderFilters, useCustomerFilters, useProductFilters } from '@/hooks/useUrlFilters';

// ============ PROGRESS & FEEDBACK ============
// Bulk operation progress indicator
export { BulkOperationProgress, useBulkOperation } from '@/components/ui/bulk-operation-progress';

// Feature discovery tips
export {
  FeatureDiscoveryTip,
  FeatureTipManager,
  useFeatureTip,
} from '@/components/ui/feature-discovery-tip';

// Last updated indicator
export { LastUpdated, DataFreshnessIndicator } from '@/components/ui/last-updated';

// ============ VERSION & HISTORY ============
// Version history panel with restore capability
export {
  VersionHistoryPanel,
  useVersionHistory,
} from '@/components/ui/version-history-panel';
export type { VersionEntry } from '@/components/ui/version-history-panel';

// ============ PREDICTIVE & PROACTIVE ============
// Predictive alerts (stock running out, invoices due, etc.)
export { usePredictiveAlerts } from '@/hooks/usePredictiveAlerts';
export type { PredictiveAlert, AlertSeverity, AlertCategory } from '@/hooks/usePredictiveAlerts';
export { PredictiveAlertsPanel, AlertBadge } from '@/components/ui/predictive-alerts-panel';

// ============ COMPARISON ============
// Multi-item comparison view
export {
  ComparisonView,
  ComparisonBar,
  useComparison,
} from '@/components/ui/comparison-view';

// ============ OFFLINE & SYNC ============
// Offline queue for draft recovery
export { useOfflineQueue, useOnlineStatus } from '@/hooks/useOfflineQueue';
export { OfflineIndicator, OfflineBadge } from '@/components/ui/offline-indicator';

// Form draft recovery with auto-save
export { useFormDraftRecovery } from '@/hooks/useFormDraftRecovery';

// ============ SUPPORT ============
// Context-aware support button
export {
  ContextAwareSupportButton,
  SupportLink,
} from '@/components/ui/context-aware-support-button';
