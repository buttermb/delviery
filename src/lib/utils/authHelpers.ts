/**
 * Authentication Helper Functions
 * Utilities for working with the three-tier auth system
 */

import { getTenantSlugFromLocation } from "@/middleware/tenantMiddleware";

/**
 * Get the appropriate login URL based on user type and tenant slug
 */
export function getLoginUrl(userType: "super_admin" | "tenant_admin" | "customer", tenantSlug?: string): string {
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
    default:
      return "/";
  }
}

/**
 * Get the appropriate dashboard URL based on user type and tenant slug
 */
export function getDashboardUrl(userType: "super_admin" | "tenant_admin" | "customer", tenantSlug?: string): string {
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
    default:
      return "/";
  }
}

/**
 * Check if user is logged in (any tier)
 */
export function isLoggedIn(): boolean {
  const superAdminToken = localStorage.getItem("super_admin_token");
  const tenantAdminToken = localStorage.getItem("tenant_admin_token");
  const customerToken = localStorage.getItem("customer_token");
  
  return !!(superAdminToken || tenantAdminToken || customerToken);
}

/**
 * Get current user type from localStorage
 */
export function getCurrentUserType(): "super_admin" | "tenant_admin" | "customer" | null {
  if (localStorage.getItem("super_admin_token")) return "super_admin";
  if (localStorage.getItem("tenant_admin_token")) return "tenant_admin";
  if (localStorage.getItem("customer_token")) return "customer";
  return null;
}

/**
 * Clear all auth tokens (logout from all tiers)
 */
export function clearAllAuthTokens(): void {
  localStorage.removeItem("super_admin_token");
  localStorage.removeItem("super_admin_user");
  localStorage.removeItem("tenant_admin_token");
  localStorage.removeItem("tenant_admin_user");
  localStorage.removeItem("tenant_data");
  localStorage.removeItem("customer_token");
  localStorage.removeItem("customer_user");
  localStorage.removeItem("customer_tenant_data");
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

