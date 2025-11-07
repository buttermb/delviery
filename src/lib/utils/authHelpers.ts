/**
 * Authentication Helper Functions
 * Utilities for working with the three-tier auth system
 */

import { getTenantSlugFromLocation } from "@/middleware/tenantMiddleware";
import { STORAGE_KEYS } from "@/constants/storageKeys";

/**
 * Get the appropriate login URL based on user type and tenant slug
 */
export function getLoginUrl(userType: "super_admin" | "tenant_admin" | "customer" | "courier", tenantSlug?: string): string {
  switch (userType) {
    case "super_admin":
      return "/super-admin/login";
    case "tenant_admin":
      if (!tenantSlug) {
        tenantSlug = getTenantSlugFromLocation() || "";
      }
      return tenantSlug ? `/${tenantSlug}/admin/login` : "/marketing";
    case "customer":
      if (!tenantSlug) {
        tenantSlug = getTenantSlugFromLocation() || "";
      }
      return tenantSlug ? `/${tenantSlug}/shop/login` : "/shop/login";
    case "courier":
      return "/courier/login";
    default:
      return "/";
  }
}

/**
 * Get the appropriate dashboard URL based on user type and tenant slug
 */
export function getDashboardUrl(userType: "super_admin" | "tenant_admin" | "customer" | "courier", tenantSlug?: string): string {
  switch (userType) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "tenant_admin":
      if (!tenantSlug) {
        tenantSlug = getTenantSlugFromLocation() || "";
      }
      return tenantSlug ? `/${tenantSlug}/admin/dashboard` : "/marketing";
    case "customer":
      if (!tenantSlug) {
        tenantSlug = getTenantSlugFromLocation() || "";
      }
      return tenantSlug ? `/${tenantSlug}/shop/dashboard` : "/shop/dashboard";
    case "courier":
      return "/courier/dashboard";
    default:
      return "/";
  }
}

/**
 * Check if user is logged in (any tier)
 */
export function isLoggedIn(): boolean {
  const superAdminToken = localStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_TOKEN);
  const tenantAdminToken = localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
  const customerToken = localStorage.getItem(STORAGE_KEYS.CUSTOMER_TOKEN);
  const courierSession = localStorage.getItem(STORAGE_KEYS.COURIER_PIN_SESSION);
  
  return !!(superAdminToken || tenantAdminToken || customerToken || courierSession);
}

/**
 * Get current user type from localStorage
 */
export function getCurrentUserType(): "super_admin" | "tenant_admin" | "customer" | "courier" | null {
  const tenantToken = localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
  console.log('[AUTH] Checking tenant token:', !!tenantToken);
  
  if (localStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_TOKEN)) return "super_admin";
  if (tenantToken) return "tenant_admin";
  if (localStorage.getItem(STORAGE_KEYS.CUSTOMER_TOKEN)) return "customer";
  if (localStorage.getItem(STORAGE_KEYS.COURIER_PIN_SESSION)) return "courier";
  return null;
}

/**
 * Clear all auth tokens (logout from all tiers)
 */
export function clearAllAuthTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.SUPER_ADMIN_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.SUPER_ADMIN_USER);
  localStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_USER);
  localStorage.removeItem(STORAGE_KEYS.TENANT_DATA);
  localStorage.removeItem(STORAGE_KEYS.CUSTOMER_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.CUSTOMER_USER);
  localStorage.removeItem(STORAGE_KEYS.CUSTOMER_TENANT_DATA);
  localStorage.removeItem(STORAGE_KEYS.COURIER_PIN_SESSION);
}

/**
 * Extract tenant slug from current URL
 */
export function getTenantSlugFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/([^/]+)\/(admin|shop)/);
  return match ? match[1] : null;
}

/**
 * Validate tenant slug format
 */
export function isValidTenantSlug(slug: string): boolean {
  // Allow alphanumeric, hyphens, underscores
  // 3-50 characters
  return /^[a-z0-9_-]{3,50}$/.test(slug);
}

