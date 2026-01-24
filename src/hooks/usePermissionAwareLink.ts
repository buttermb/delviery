/**
 * usePermissionAwareLink Hook
 *
 * Provides permission-aware link rendering for cross-module navigation.
 * Links only render (or render as disabled) if the user has permission
 * to access the target module.
 *
 * @example
 * ```tsx
 * // Single permission check
 * const ordersLink = usePermissionAwareLink({
 *   to: 'orders',
 *   permission: 'orders:view',
 * });
 *
 * if (ordersLink.visible) {
 *   return <Link to={ordersLink.href}>Orders</Link>;
 * }
 *
 * // Multiple permissions (any of them grants access)
 * const financeLink = usePermissionAwareLink({
 *   to: 'finance',
 *   permission: ['finance:view', 'finance:reports'],
 * });
 *
 * // Multiple permissions (all required)
 * const settingsLink = usePermissionAwareLink({
 *   to: 'settings/billing',
 *   permission: ['settings:view', 'settings:billing'],
 *   requireAll: true,
 * });
 * ```
 */

import { useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import type { Permission } from '@/lib/permissions/rolePermissions';

interface UsePermissionAwareLinkOptions {
  /** Admin route path (e.g., 'orders', 'finance/reports', 'settings/billing') */
  to: string;
  /** Permission(s) required to access the target route */
  permission: Permission | Permission[];
  /** When permission is an array, require all permissions (default: false = any) */
  requireAll?: boolean;
}

interface UsePermissionAwareLinkResult {
  /** The full tenant-aware URL for the link */
  href: string;
  /** Whether the user has permission to access the target */
  hasAccess: boolean;
  /** Whether the link should be visible (alias for hasAccess for convenience) */
  visible: boolean;
  /** Whether permissions are still loading */
  isLoading: boolean;
}

export function usePermissionAwareLink({
  to,
  permission,
  requireAll = false,
}: UsePermissionAwareLinkOptions): UsePermissionAwareLinkResult {
  const { checkPermission, checkAnyPermission, checkAllPermissions, isLoading } = usePermissions();
  const { buildAdminUrl } = useTenantNavigation();

  const hasAccess = useMemo(() => {
    if (isLoading) return false;

    if (Array.isArray(permission)) {
      return requireAll
        ? checkAllPermissions(permission)
        : checkAnyPermission(permission);
    }

    return checkPermission(permission);
  }, [permission, requireAll, checkPermission, checkAnyPermission, checkAllPermissions, isLoading]);

  const href = useMemo(() => buildAdminUrl(to), [buildAdminUrl, to]);

  return {
    href,
    hasAccess,
    visible: hasAccess,
    isLoading,
  };
}
