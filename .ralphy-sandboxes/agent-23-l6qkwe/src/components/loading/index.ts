/**
 * Skeleton Loader Components Library
 *
 * Centralized exports for all skeleton/loading components.
 *
 * ## Usage
 *
 * ```tsx
 * // Import base primitives
 * import { Skeleton, SkeletonText, SkeletonAvatar } from '@/components/ui/skeleton';
 *
 * // Import composite skeletons from this library
 * import {
 *   PageHeaderSkeleton,
 *   TabsSkeleton,
 *   SearchBarSkeleton,
 *   DashboardSkeleton,
 *   AnalyticsSkeleton,
 * } from '@/components/loading';
 * ```
 *
 * ## Component Layers
 *
 * 1. **Base Primitives** (@/components/ui/skeleton)
 *    Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonTable,
 *    SkeletonTableRow, SkeletonListItem, SkeletonButton, SkeletonInput
 *
 * 2. **Common Patterns** (./skeletons)
 *    PageHeaderSkeleton, TabsSkeleton, SearchBarSkeleton, BadgeGroupSkeleton,
 *    MetricRowSkeleton, TimelineSkeleton, SidebarSkeleton, HubPageSkeleton,
 *    SwitchRowSkeleton, InlineStatSkeleton
 *
 * 3. **Page-Level Skeletons** (./DashboardSkeleton, ./AnalyticsSkeleton, etc.)
 *    Full page loading states for dashboard, analytics, admin, storefront, courier
 *
 * 4. **Composite Table/Card/Grid** (@/components/ui/TableSkeleton)
 *    TableSkeleton, CardSkeleton, ListSkeleton, StatSkeleton, ProductGridSkeleton,
 *    FormSkeleton, GridSkeleton, DetailPageSkeleton
 */

// ─── Common Pattern Skeletons ───────────────────────────────────────────────
export {
  PageHeaderSkeleton,
  TabsSkeleton,
  SearchBarSkeleton,
  BadgeGroupSkeleton,
  MetricRowSkeleton,
  TimelineSkeleton,
  SidebarSkeleton,
  HubPageSkeleton,
  SwitchRowSkeleton,
  InlineStatSkeleton,
} from './skeletons';

// ─── Page-Level Skeletons ───────────────────────────────────────────────────
export { SkeletonAdminLayout } from './SkeletonAdminLayout';
export { SkeletonDashboard } from './SkeletonDashboard';
export { SkeletonStorefront } from './SkeletonStorefront';
export { SkeletonCourier } from './SkeletonCourier';

// ─── Dashboard Skeletons ────────────────────────────────────────────────────
export {
  DashboardSkeleton,
  DashboardHeaderSkeleton,
  StatCardSkeleton,
  StatCardWithTrendSkeleton,
  SectionHeaderSkeleton,
  StatsSectionSkeleton,
  ChartSkeleton,
  PieChartSkeleton,
  QuickActionsSkeleton,
  RealtimeSalesSkeleton,
  StorefrontSummarySkeleton,
  InventoryForecastSkeleton,
  RevenueForecastSkeleton,
  RecentOrdersSkeleton,
  MobileStatsCarouselSkeleton,
  DashboardHubSkeleton,
  WidgetSkeleton as DashboardWidgetSkeleton,
  WidgetListSkeleton,
} from './DashboardSkeleton';

// ─── Analytics Skeletons ────────────────────────────────────────────────────
export {
  AnalyticsSkeleton,
  AnalyticsPeriodSelectorSkeleton,
  AnalyticsKPICardSkeleton,
  AnalyticsKPIGridSkeleton,
  AnalyticsChartSkeleton,
} from './AnalyticsSkeleton';
