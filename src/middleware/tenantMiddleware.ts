/**
 * Tenant Middleware
 * Extracts tenant slug from URL or subdomain and validates tenant context
 */

export interface TenantContext {
  tenantSlug: string;
  tenantId: string;
  tenant: any;
}

/**
 * Extract tenant slug from URL path
 * Examples:
 * - /bigmike/admin/dashboard -> "bigmike"
 * - /bigmike/shop/login -> "bigmike"
 */
export function extractTenantSlugFromPath(pathname: string): string | null {
  // Match pattern: /{slug}/admin/* or /{slug}/shop/*
  const match = pathname.match(/^\/([^/]+)\/(admin|shop)/);
  return match ? match[1] : null;
}

/**
 * Extract tenant slug from subdomain
 * Examples:
 * - bigmike.platform.com -> "bigmike"
 * - joes-wholesale.platform.com -> "joes-wholesale"
 */
export function extractTenantSlugFromSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Check if it's a subdomain (at least 2 parts before .platform.com or similar)
  const parts = host.split('.');
  
  // For localhost or IP addresses, return null
  if (parts.length <= 1 || parts[0] === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  
  // If we have subdomain.example.com, return the subdomain
  if (parts.length >= 3) {
    return parts[0];
  }
  
  // For domain.com (no subdomain), check if first part is a tenant slug
  // This would require checking against database, so return null for now
  return null;
}

/**
 * Get tenant slug from current location
 * Checks both URL path and subdomain
 */
export function getTenantSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  
  // First, try to extract from path
  const pathSlug = extractTenantSlugFromPath(window.location.pathname);
  if (pathSlug) return pathSlug;
  
  // Then, try to extract from subdomain
  const subdomainSlug = extractTenantSlugFromSubdomain(window.location.hostname);
  if (subdomainSlug) return subdomainSlug;
  
  return null;
}

/**
 * Validate tenant exists and is active
 * This should be called from an API endpoint or Edge Function
 */
export async function validateTenant(tenantSlug: string): Promise<{ valid: boolean; tenant?: any; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await window.fetch(`${supabaseUrl}/functions/v1/validate-tenant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantSlug }),
    });

    if (!response.ok) {
      return { valid: false, error: 'Tenant validation failed' };
    }

    const data = await response.json();
    return { valid: data.valid, tenant: data.tenant };
  } catch (error) {
    console.error('Tenant validation error:', error);
    return { valid: false, error: 'Failed to validate tenant' };
  }
}
