/**
 * Empty State Components Library
 *
 * Centralized exports for all empty state components.
 *
 * ## Usage
 *
 * ```tsx
 * // Import the base component for custom empty states
 * import { EmptyState, EmptyStateCompact, ErrorState } from '@/components/empty-states';
 *
 * // Import domain-specific presets for zero-config empty states
 * import { OrdersEmptyState, ProductsEmptyState, SearchEmptyState } from '@/components/empty-states';
 *
 * // Import the enhanced variant with design-system theming
 * import { EnhancedEmptyState } from '@/components/empty-states';
 * ```
 *
 * ## Component Layers
 *
 * 1. **Base Components** (@/components/ui/empty-state)
 *    EmptyState — full-featured with illustrations, actions, and variants
 *    EmptyStateCompact — smaller inline version for cards/constrained spaces
 *    ErrorState — specialized variant for error scenarios with retry
 *
 * 2. **Domain Presets** (./presets)
 *    OrdersEmptyState, ProductsEmptyState, CustomersEmptyState, VendorsEmptyState,
 *    MenusEmptyState, DeliveriesEmptyState, PaymentsEmptyState, InventoryEmptyState,
 *    StorefrontEmptyState, SearchEmptyState, AnalyticsEmptyState, NotificationsEmptyState,
 *    ScheduleEmptyState, CommentsEmptyState, ComplianceEmptyState, TicketsEmptyState,
 *    InvoicesEmptyState, CouponsEmptyState, LocationsEmptyState, DriversEmptyState,
 *    GenericEmptyState
 *
 * 3. **Enhanced Variant** (@/components/shared/EnhancedEmptyState)
 *    EnhancedEmptyState — type-based config with design-system theming
 */

// ─── Base Components ───────────────────────────────────────────────────────
export {
  EmptyState,
  EmptyStateCompact,
  ErrorState,
  illustrations,
} from '@/components/ui/empty-state';

export type {
  EmptyStateProps,
  EmptyStateCompactProps,
  ErrorStateProps,
  IllustrationType,
} from '@/components/ui/empty-state';

// ─── Domain-Specific Presets ───────────────────────────────────────────────
export {
  OrdersEmptyState,
  ProductsEmptyState,
  CustomersEmptyState,
  VendorsEmptyState,
  MenusEmptyState,
  DeliveriesEmptyState,
  PaymentsEmptyState,
  InventoryEmptyState,
  StorefrontEmptyState,
  SearchEmptyState,
  AnalyticsEmptyState,
  NotificationsEmptyState,
  ScheduleEmptyState,
  CommentsEmptyState,
  ComplianceEmptyState,
  TicketsEmptyState,
  InvoicesEmptyState,
  CouponsEmptyState,
  LocationsEmptyState,
  DriversEmptyState,
  GenericEmptyState,
} from './presets';

export type { EmptyStatePresetProps } from './presets';

// ─── Enhanced Variant ──────────────────────────────────────────────────────
export { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

export type {
  EnhancedEmptyStateProps,
  EmptyStateType,
} from '@/components/shared/EnhancedEmptyState';
