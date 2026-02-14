import { describe, it, expect } from 'vitest';
import { 
  classifyRoute, 
  isTenantAdminRoute, 
  extractTenantSlug,
  tenantSlugsMatch,
  buildTenantAdminRoute,
  buildCustomerRoute,
} from '../routeUtils';

describe('routeUtils', () => {
  describe('classifyRoute', () => {
    it('should classify tenant admin routes', () => {
      const result = classifyRoute('/my-tenant/admin/dashboard');
      expect(result.type).toBe('tenant-admin');
      expect(result.tenantSlug).toBe('my-tenant');
      expect(result.isProtected).toBe(true);
      expect(result.requiresTenantContext).toBe(true);
    });

    it('should classify customer portal routes', () => {
      const result = classifyRoute('/my-tenant/shop/products');
      expect(result.type).toBe('customer-portal');
      expect(result.tenantSlug).toBe('my-tenant');
      expect(result.isProtected).toBe(false);
      expect(result.requiresTenantContext).toBe(true);
    });

    it('should classify super admin routes', () => {
      const result = classifyRoute('/super-admin/dashboard');
      expect(result.type).toBe('super-admin');
      expect(result.tenantSlug).toBe(null);
      expect(result.isProtected).toBe(true);
      expect(result.requiresTenantContext).toBe(false);
    });

    it('should classify saas routes', () => {
      expect(classifyRoute('/saas/login').type).toBe('saas');
      expect(classifyRoute('/signup').type).toBe('saas');
      expect(classifyRoute('/select-plan').type).toBe('saas');
      expect(classifyRoute('/select-plan?tenant_id=123').type).toBe('saas');
      expect(classifyRoute('/verify-email').type).toBe('saas');
    });

    it('should classify auth callback routes', () => {
      expect(classifyRoute('/auth/callback').type).toBe('auth');
      expect(classifyRoute('/callback/google').type).toBe('auth');
    });

    it('should handle edge cases', () => {
      expect(classifyRoute('/').type).toBe('public');
      expect(classifyRoute('/unknown-route').type).toBe('public');
      expect(classifyRoute('/my-tenant/admin').type).toBe('tenant-admin'); // No trailing path
      expect(classifyRoute('/my-tenant/admin/').type).toBe('tenant-admin'); // Trailing slash
    });
  });

  describe('isTenantAdminRoute', () => {
    it('should return true for tenant admin routes', () => {
      expect(isTenantAdminRoute('/my-tenant/admin/dashboard')).toBe(true);
      expect(isTenantAdminRoute('/test-slug/admin/settings')).toBe(true);
    });

    it('should return false for non-admin routes', () => {
      expect(isTenantAdminRoute('/select-plan')).toBe(false);
      expect(isTenantAdminRoute('/super-admin/dashboard')).toBe(false);
      expect(isTenantAdminRoute('/my-tenant/shop/products')).toBe(false);
    });
  });

  describe('extractTenantSlug', () => {
    it('should extract tenant slug from admin routes', () => {
      expect(extractTenantSlug('/my-tenant/admin/dashboard')).toBe('my-tenant');
      expect(extractTenantSlug('/test-store/admin/products')).toBe('test-store');
    });

    it('should extract tenant slug from customer portal routes', () => {
      expect(extractTenantSlug('/my-tenant/shop/cart')).toBe('my-tenant');
    });

    it('should return null for global routes', () => {
      expect(extractTenantSlug('/select-plan')).toBe(null);
      expect(extractTenantSlug('/super-admin/dashboard')).toBe(null);
      expect(extractTenantSlug('/saas/login')).toBe(null);
    });
  });

  describe('tenantSlugsMatch', () => {
    it('should match identical slugs', () => {
      expect(tenantSlugsMatch('my-tenant', 'my-tenant')).toBe(true);
    });

    it('should match case-insensitively', () => {
      expect(tenantSlugsMatch('My-Tenant', 'my-tenant')).toBe(true);
      expect(tenantSlugsMatch('MY-TENANT', 'my-tenant')).toBe(true);
    });

    it('should return false for different slugs', () => {
      expect(tenantSlugsMatch('tenant-a', 'tenant-b')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(tenantSlugsMatch(null, 'my-tenant')).toBe(false);
      expect(tenantSlugsMatch('my-tenant', null)).toBe(false);
      expect(tenantSlugsMatch(null, null)).toBe(false);
      expect(tenantSlugsMatch(undefined, 'my-tenant')).toBe(false);
    });
  });

  describe('buildTenantAdminRoute', () => {
    it('should build correct admin routes', () => {
      expect(buildTenantAdminRoute('my-tenant', 'dashboard')).toBe('/my-tenant/admin/dashboard');
      expect(buildTenantAdminRoute('my-tenant', '/dashboard')).toBe('/my-tenant/admin/dashboard');
      expect(buildTenantAdminRoute('my-tenant', '')).toBe('/my-tenant/admin');
      expect(buildTenantAdminRoute('my-tenant')).toBe('/my-tenant/admin');
    });
  });

  describe('buildCustomerRoute', () => {
    it('should build correct customer portal routes', () => {
      expect(buildCustomerRoute('my-tenant', 'products')).toBe('/my-tenant/shop/products');
      expect(buildCustomerRoute('my-tenant', '/products')).toBe('/my-tenant/shop/products');
      expect(buildCustomerRoute('my-tenant', '')).toBe('/my-tenant/shop');
      expect(buildCustomerRoute('my-tenant')).toBe('/my-tenant/shop');
    });
  });
});

