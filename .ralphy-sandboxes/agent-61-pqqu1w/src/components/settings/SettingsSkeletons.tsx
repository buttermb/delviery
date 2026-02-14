/**
 * Settings Page Skeleton Loaders
 *
 * Provides skeleton loading states for each settings tab while data loads
 */

import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonInput, SkeletonButton } from '@/components/ui/skeleton';

/**
 * Skeleton for a switch/toggle row with label and description
 */
function SkeletonSwitchRow() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  );
}

/**
 * General Settings Tab Skeleton
 * Shows loading state for company info form
 */
export function GeneralSettingsSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="space-y-4">
        {/* Company Name field */}
        <SkeletonInput hasLabel />

        {/* Email and Phone fields (2 column grid) */}
        <div>
          <Skeleton className="h-4 w-16 mb-2" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <SkeletonInput hasLabel />
            <SkeletonInput hasLabel />
          </div>
        </div>

        {/* Address field (textarea) */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>

        {/* Timezone and Currency fields (2 column grid) */}
        <div className="grid grid-cols-2 gap-4">
          <SkeletonInput hasLabel />
          <SkeletonInput hasLabel />
        </div>

        {/* Save button */}
        <SkeletonButton size="default" />

        {/* Team Management section */}
        <div className="pt-4 border-t mt-6 space-y-2">
          <Skeleton className="h-4 w-32" />
          <SkeletonButton size="default" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Security Settings Tab Skeleton
 * Shows loading state for security preferences form
 */
export function SecuritySettingsSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="space-y-4">
        {/* Two-Factor Authentication toggle */}
        <SkeletonSwitchRow />

        {/* Require Password Change toggle */}
        <SkeletonSwitchRow />

        {/* Session Timeout input */}
        <SkeletonInput hasLabel />

        {/* Minimum Password Length input */}
        <SkeletonInput hasLabel />

        {/* Save button */}
        <SkeletonButton size="default" />
      </div>
    </Card>
  );
}

/**
 * Notification Settings Tab Skeleton
 * Shows loading state for notification preferences form
 */
export function NotificationSettingsSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-44" />
      </div>
      <div className="space-y-4">
        {/* Email Notifications toggle */}
        <SkeletonSwitchRow />

        {/* SMS Notifications toggle */}
        <SkeletonSwitchRow />

        {/* Alert toggles section */}
        <div className="pt-4 border-t space-y-3">
          {/* Low Stock Alerts */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>

          {/* Overdue Payment Alerts */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>

          {/* Order Alerts */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>

        {/* Save button */}
        <SkeletonButton size="default" />
      </div>
    </Card>
  );
}

/**
 * Printing Settings Tab Skeleton
 * Shows loading state for printing preferences (placeholder tab)
 */
export function PrintingSettingsSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="p-4 border rounded-lg bg-muted/20">
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-3 w-48 mx-auto mt-2" />
      </div>
    </Card>
  );
}

/**
 * Skeleton for an integration card (QuickBooks, Twilio, etc.)
 */
function SkeletonIntegrationCard() {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <SkeletonButton size="sm" />
      </div>
    </div>
  );
}

/**
 * Integrations Settings Tab Skeleton
 * Shows loading state for integration cards
 */
export function IntegrationsSettingsSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="space-y-4">
        {/* QuickBooks card */}
        <SkeletonIntegrationCard />

        {/* Stripe Connect card (larger) */}
        <div className="border rounded-lg">
          <div className="p-6">
            <div className="space-y-1 mb-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <Skeleton className="h-5 w-5 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <SkeletonButton size="default" />
            </div>
          </div>
        </div>

        {/* Twilio card */}
        <SkeletonIntegrationCard />
      </div>
    </Card>
  );
}

/**
 * Sidebar Settings Tab Skeleton
 * Shows loading state for operation size selector
 */
export function SidebarSettingsSkeleton() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="space-y-4">
        {/* Title and description */}
        <div className="space-y-1">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Auto-detected badge */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Radio group options */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start space-x-2">
              <Skeleton className="h-4 w-4 rounded-full mt-1" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Sidebar Customization Tab Skeleton
 * Shows loading state for sidebar customizer with tabs
 */
export function SidebarCustomizationSkeleton() {
  return (
    <Card>
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-44" />
        </div>
        <Skeleton className="h-4 w-72 mb-4" />
      </div>
      <div className="p-6">
        {/* Tabs list */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>

        {/* Tab content placeholder */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Appearance Settings Tab Skeleton
 * Shows loading state for theme selection cards
 */
export function AppearanceSettingsSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-1 mb-6">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-12" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-4">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Skeleton for a payment method card
 */
function SkeletonPaymentCard({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className="border rounded-lg">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <SkeletonInput hasLabel />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Payment Settings Tab Skeleton
 * Shows loading state for payment methods configuration
 */
export function PaymentSettingsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>

      {/* Payment cards */}
      <div className="space-y-4">
        <SkeletonPaymentCard expanded />
        <SkeletonPaymentCard />
        <SkeletonPaymentCard />
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t">
        <SkeletonButton size="default" />
      </div>
    </div>
  );
}
