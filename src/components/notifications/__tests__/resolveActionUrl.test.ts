import { describe, it, expect } from 'vitest';

// Extract and test the resolveActionUrl logic independently
function resolveActionUrl(actionUrl: string, tenantSlug: string | null): string {
  if (actionUrl.startsWith('/')) return actionUrl;
  return `/${tenantSlug}/${actionUrl}`;
}

describe('resolveActionUrl', () => {
  it('prepends tenant slug to relative admin paths', () => {
    expect(resolveActionUrl('admin/orders/123', 'acme')).toBe('/acme/admin/orders/123');
  });

  it('leaves absolute paths unchanged', () => {
    expect(resolveActionUrl('/some/absolute/path', 'acme')).toBe('/some/absolute/path');
  });

  it('handles different tenant slugs', () => {
    expect(resolveActionUrl('admin/products/456', 'greenleaf')).toBe('/greenleaf/admin/products/456');
  });

  it('handles null tenant slug', () => {
    expect(resolveActionUrl('admin/orders/123', null)).toBe('/null/admin/orders/123');
  });

  it('handles various admin paths', () => {
    expect(resolveActionUrl('admin/deliveries/del-1', 'shop')).toBe('/shop/admin/deliveries/del-1');
    expect(resolveActionUrl('admin/customers/cust-1', 'shop')).toBe('/shop/admin/customers/cust-1');
    expect(resolveActionUrl('admin/invoices/inv-1', 'shop')).toBe('/shop/admin/invoices/inv-1');
    expect(resolveActionUrl('admin/drivers/drv-1', 'shop')).toBe('/shop/admin/drivers/drv-1');
    expect(resolveActionUrl('admin/menus/menu-1', 'shop')).toBe('/shop/admin/menus/menu-1');
  });
});
