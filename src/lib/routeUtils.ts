/**
 * Route Classification Utilities
 * 
 * Centralized logic for determining route types and extracting tenant slugs.
 * This ensures consistent behavior across the application.
 */

export type RouteType = 
  | 'tenant-admin'    // /:tenantSlug/admin/*
  | 'customer-portal' // /:tenantSlug/shop/*
  | 'super-admin'     // /super-admin/*
  | 'saas'            // /saas/*, /signup, /select-plan, etc.
  | 'auth'            // /auth/*, /callback/*
  | 'public'          // Everything else
  | 'unknown';

export interface RouteInfo {
  type: RouteType;
  tenantSlug: string | null;
  isProtected: boolean;
  requiresTenantContext: boolean;
}

// Route patterns with named groups for extraction
const ROUTE_PATTERNS: Array<{ pattern: RegExp; type: RouteType; hasTenantSlug: boolean }> = [
  // Super Admin routes (no tenant slug)
  { pattern: /^\/super-admin(\/.*)?$/, type: 'super-admin', hasTenantSlug: false },
  
  // SaaS/Global routes (no tenant slug)
  { pattern: /^\/saas(\/.*)?$/, type: 'saas', hasTenantSlug: false },
  { pattern: /^\/signup\/?$/, type: 'saas', hasTenantSlug: false },
  { pattern: /^\/select-plan\/?(\?.*)?$/, type: 'saas', hasTenantSlug: false },
  { pattern: /^\/verify-email\/?$/, type: 'saas', hasTenantSlug: false },
  { pattern: /^\/pricing\/?$/, type: 'saas', hasTenantSlug: false },
  
  // Auth callback routes (no tenant slug)
  { pattern: /^\/auth(\/.*)?$/, type: 'auth', hasTenantSlug: false },
  { pattern: /^\/callback(\/.*)?$/, type: 'auth', hasTenantSlug: false },
  
  // Tenant Admin routes (/:tenantSlug/admin/*)
  { pattern: /^\/([^/]+)\/admin(\/.*)?$/, type: 'tenant-admin', hasTenantSlug: true },

  // Customer Portal routes (/:tenantSlug/shop/*)
  { pattern: /^\/([^/]+)\/shop(\/.*)?$/, type: 'customer-portal', hasTenantSlug: true },

  // Legacy/alternative customer routes (/:tenantSlug/menu, /:tenantSlug/order)
  { pattern: /^\/([^/]+)\/(menu|order|checkout)(\/.*)?$/, type: 'customer-portal', hasTenantSlug: true },
];

/**
 * Classify a route and extract tenant information
 */
export function classifyRoute(pathname: string): RouteInfo {
  // Normalize pathname (remove trailing slash except for root)
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  
  for (const { pattern, type, hasTenantSlug } of ROUTE_PATTERNS) {
    const match = normalizedPath.match(pattern);
    if (match) {
      return {
        type,
        tenantSlug: hasTenantSlug ? match[1] : null,
        isProtected: type === 'tenant-admin' || type === 'super-admin',
        requiresTenantContext: type === 'tenant-admin' || type === 'customer-portal',
      };
    }
  }
  
  // Default to public/unknown
  return {
    type: 'public',
    tenantSlug: null,
    isProtected: false,
    requiresTenantContext: false,
  };
}

/**
 * Check if a route is a tenant admin route
 */
export function isTenantAdminRoute(pathname: string): boolean {
  return classifyRoute(pathname).type === 'tenant-admin';
}

/**
 * Check if a route requires tenant context (admin or customer portal)
 */
export function requiresTenantContext(pathname: string): boolean {
  return classifyRoute(pathname).requiresTenantContext;
}

/**
 * Extract tenant slug from a route (if present)
 */
export function extractTenantSlug(pathname: string): string | null {
  return classifyRoute(pathname).tenantSlug;
}

/**
 * Check if two tenant slugs match (case-insensitive)
 */
export function tenantSlugsMatch(slug1: string | null | undefined, slug2: string | null | undefined): boolean {
  if (!slug1 || !slug2) return false;
  return slug1.toLowerCase() === slug2.toLowerCase();
}

/**
 * Build a tenant admin route
 */
export function buildTenantAdminRoute(tenantSlug: string, path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${tenantSlug}/admin${cleanPath ? `/${cleanPath}` : ''}`;
}

/**
 * Build a customer portal route
 */
export function buildCustomerRoute(tenantSlug: string, path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${tenantSlug}/shop${cleanPath ? `/${cleanPath}` : ''}`;
}

