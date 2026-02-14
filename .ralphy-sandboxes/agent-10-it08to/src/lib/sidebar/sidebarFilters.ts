/**
 * Sidebar Filtering Utilities
 * 
 * Filters sidebar items based on:
 * - User role and permissions
 * - Subscription tier
 * - Feature access flags
 */

import type { SidebarItem, SidebarSection, Permission } from '@/types/sidebar';
import type { SubscriptionTier } from '@/lib/featureConfig';
import type { Role } from '@/lib/permissions/rolePermissions';

/**
 * Filter sidebar items by user role and permissions
 */
export function filterByRole(
  items: SidebarItem[],
  role: Role,
  checkPermission: (permission: Permission) => boolean
): SidebarItem[] {
  return items.filter(item => {
    // If item has no permission requirements, allow it
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }

    // Check if user has any of the required permissions
    return item.permissions.some(permission => checkPermission(permission));
  });
}

/**
 * Filter sidebar items by subscription tier
 */
export function filterByPlan(
  items: SidebarItem[],
  currentTier: SubscriptionTier,
  canAccessFeature: (featureId: string) => boolean
): SidebarItem[] {
  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const currentTierIndex = tierHierarchy.indexOf(currentTier);

  return items.filter(item => {
    // If item has no tier requirement, allow it
    if (!item.minTier) {
      return true;
    }

    // Check feature access if featureId is provided
    if (item.featureId) {
      return canAccessFeature(item.featureId);
    }

    // Otherwise check tier hierarchy
    const requiredTierIndex = tierHierarchy.indexOf(item.minTier);
    return currentTierIndex >= requiredTierIndex;
  });
}

/**
 * Filter sidebar items by feature access
 */
export function filterByFeatureAccess(
  items: SidebarItem[],
  canAccess: (featureId: string) => boolean
): SidebarItem[] {
  return items.filter(item => {
    // If item has no featureId, allow it
    if (!item.featureId) {
      return true;
    }

    // Check feature access
    return canAccess(item.featureId);
  });
}

/**
 * Filter sidebar sections by role and permissions
 */
export function filterSectionsByRole(
  sections: SidebarSection[],
  role: Role,
  checkPermission: (permission: Permission) => boolean
): SidebarSection[] {
  return sections
    .filter(section => {
      // If section has no permission requirements, allow it
      if (!section.permissions || section.permissions.length === 0) {
        return true;
      }

      // Check if user has any of the required permissions
      return section.permissions.some(permission => checkPermission(permission));
    })
    .map(section => ({
      ...section,
      items: filterByRole(section.items, role, checkPermission),
    }));
}

/**
 * Filter sidebar sections by subscription tier
 */
export function filterSectionsByPlan(
  sections: SidebarSection[],
  currentTier: SubscriptionTier,
  canAccessFeature: (featureId: string) => boolean
): SidebarSection[] {
  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const currentTierIndex = tierHierarchy.indexOf(currentTier);

  return sections
    .filter(section => {
      // If section has no tier requirement, allow it
      if (!section.minTier) {
        return true;
      }

      const requiredTierIndex = tierHierarchy.indexOf(section.minTier);
      return currentTierIndex >= requiredTierIndex;
    })
    .map(section => ({
      ...section,
      items: filterByPlan(section.items, currentTier, canAccessFeature),
    }));
}

/**
 * Filter sidebar sections by feature access
 */
export function filterSectionsByFeatureAccess(
  sections: SidebarSection[],
  canAccess: (featureId: string) => boolean
): SidebarSection[] {
  return sections.map(section => ({
    ...section,
    items: filterByFeatureAccess(section.items, canAccess),
  })).filter(section => section.items.length > 0); // Remove empty sections
}

/**
 * Apply all filters to sidebar sections
 */
export function applyAllFilters(
  sections: SidebarSection[],
  options: {
    role: Role;
    currentTier: SubscriptionTier;
    checkPermission: (permission: Permission) => boolean;
    canAccessFeature: (featureId: string) => boolean;
  }
): SidebarSection[] {
  let filtered = sections;

  // Filter by role
  filtered = filterSectionsByRole(filtered, options.role, options.checkPermission);

  // Filter by tier and feature access
  filtered = filterSectionsByPlan(filtered, options.currentTier, options.canAccessFeature);

  // Filter by feature access
  filtered = filterSectionsByFeatureAccess(filtered, options.canAccessFeature);

  return filtered;
}

