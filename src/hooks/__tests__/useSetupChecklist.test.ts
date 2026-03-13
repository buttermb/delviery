/**
 * useSetupChecklist Hook Tests
 * Tests for setup checklist link hrefs and completion detection logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { useSetupChecklist } from '../useSetupChecklist';

// ── Mocks ──────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/hooks/useTenantContext', () => ({
  useTenantContext: vi.fn(() => ({
    tenantId: 'tenant-123',
    tenantSlug: 'acme',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    setupChecklist: {
      byTenant: (id?: string) => ['setup-checklist', id] as const,
    },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────

/** Build a chainable Supabase query mock that resolves to the given value */
function chainable(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  // For head/count queries, the chain itself is a thenable
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

/** Default table responses — everything empty/null */
function defaultResponses(): Record<string, ReturnType<typeof chainable>> {
  return {
    tenants: chainable({ data: null, error: null }),
    products: chainable({ count: 0, error: null }),
    delivery_zones: chainable({ count: 0, error: null }),
    couriers: chainable({ count: 0, error: null }),
    orders: chainable({ count: 0, error: null }),
    storefront_settings: chainable({ data: null, error: null }),
    marketplace_stores: chainable({ data: null, error: null }),
    tenant_payment_settings: chainable({ data: null, error: null }),
  };
}

function setupMockFrom(responses: Record<string, ReturnType<typeof chainable>>) {
  mockFrom.mockImplementation((table: string) => {
    return responses[table] ?? chainable({ data: null, error: null });
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('useSetupChecklist', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  // ── Href correctness ──────────────────────────────────────────

  describe('checklist hrefs', () => {
    it('links profile to settings?tab=business', async () => {
      setupMockFrom(defaultResponses());
      const { result } = renderHook(() => useSetupChecklist(), { wrapper });

      await waitFor(() => expect(result.current.data).toBeDefined());

      const profile = result.current.data!.items.find((i) => i.id === 'profile');
      expect(profile?.href).toBe('/acme/admin/settings?tab=business');
    });

    it('links products to inventory-hub?tab=products', async () => {
      setupMockFrom(defaultResponses());
      const { result } = renderHook(() => useSetupChecklist(), { wrapper });

      await waitFor(() => expect(result.current.data).toBeDefined());

      const product = result.current.data!.items.find((i) => i.id === 'product');
      expect(product?.href).toBe('/acme/admin/inventory-hub?tab=products');
    });

    it('links driver to fulfillment-hub?tab=couriers', async () => {
      setupMockFrom(defaultResponses());
      const { result } = renderHook(() => useSetupChecklist(), { wrapper });

      await waitFor(() => expect(result.current.data).toBeDefined());

      const driver = result.current.data!.items.find((i) => i.id === 'driver');
      expect(driver?.href).toBe('/acme/admin/fulfillment-hub?tab=couriers');
    });

    it('links payment to settings?tab=payments', async () => {
      setupMockFrom(defaultResponses());
      const { result } = renderHook(() => useSetupChecklist(), { wrapper });

      await waitFor(() => expect(result.current.data).toBeDefined());

      const payment = result.current.data!.items.find((i) => i.id === 'payment');
      expect(payment?.href).toBe('/acme/admin/settings?tab=payments');
    });

    it('links delivery zone correctly', async () => {
      setupMockFrom(defaultResponses());
      const { result } = renderHook(() => useSetupChecklist(), { wrapper });

      await waitFor(() => expect(result.current.data).toBeDefined());

      const zone = result.current.data!.items.find((i) => i.id === 'delivery-zone');
      expect(zone?.href).toBe('/acme/admin/delivery-zones');
    });
  });

  // ── Completion detection ──────────────────────────────────────

  describe('storefront customization detection', () => {
    it('detects legacy storefront_settings (logo_url)', async () => {
      const responses = defaultResponses();
      responses.storefront_settings = chainable({
        data: { logo_url: 'https://img.example.com/logo.png', primary_color: null },
        error: null,
      });
      setupMockFrom(responses);

      const { result } = renderHook(() => useSetupChecklist(), { wrapper });
      await waitFor(() => expect(result.current.data).toBeDefined());

      const storefront = result.current.data!.items.find((i) => i.id === 'storefront');
      expect(storefront?.completed).toBe(true);
    });

    it('detects legacy storefront_settings (primary_color)', async () => {
      const responses = defaultResponses();
      responses.storefront_settings = chainable({
        data: { logo_url: null, primary_color: '#16a34a' },
        error: null,
      });
      setupMockFrom(responses);

      const { result } = renderHook(() => useSetupChecklist(), { wrapper });
      await waitFor(() => expect(result.current.data).toBeDefined());

      const storefront = result.current.data!.items.find((i) => i.id === 'storefront');
      expect(storefront?.completed).toBe(true);
    });

    it('detects new marketplace_stores theme_config', async () => {
      const responses = defaultResponses();
      responses.marketplace_stores = chainable({
        data: { theme_config: { primaryColor: '#000' }, layout_config: null },
        error: null,
      });
      setupMockFrom(responses);

      const { result } = renderHook(() => useSetupChecklist(), { wrapper });
      await waitFor(() => expect(result.current.data).toBeDefined());

      const storefront = result.current.data!.items.find((i) => i.id === 'storefront');
      expect(storefront?.completed).toBe(true);
    });

    it('detects new marketplace_stores layout_config', async () => {
      const responses = defaultResponses();
      responses.marketplace_stores = chainable({
        data: { theme_config: null, layout_config: { sections: [] } },
        error: null,
      });
      setupMockFrom(responses);

      const { result } = renderHook(() => useSetupChecklist(), { wrapper });
      await waitFor(() => expect(result.current.data).toBeDefined());

      const storefront = result.current.data!.items.find((i) => i.id === 'storefront');
      expect(storefront?.completed).toBe(true);
    });

    it('is incomplete when neither legacy nor new config exists', async () => {
      setupMockFrom(defaultResponses());

      const { result } = renderHook(() => useSetupChecklist(), { wrapper });
      await waitFor(() => expect(result.current.data).toBeDefined());

      const storefront = result.current.data!.items.find((i) => i.id === 'storefront');
      expect(storefront?.completed).toBe(false);
    });
  });

  // ── Aggregate completion ──────────────────────────────────────

  describe('completion summary', () => {
    it('reports 0% when nothing is done', async () => {
      setupMockFrom(defaultResponses());

      const { result } = renderHook(() => useSetupChecklist(), { wrapper });
      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data!.completedCount).toBe(0);
      expect(result.current.data!.totalCount).toBe(7);
      expect(result.current.data!.percentage).toBe(0);
      expect(result.current.data!.allComplete).toBe(false);
    });

    it('reports 100% when everything is done', async () => {
      const responses = defaultResponses();
      responses.tenants = chainable({
        data: { business_name: 'Acme', phone: '555-1234' },
        error: null,
      });
      responses.products = chainable({ count: 3, error: null });
      responses.delivery_zones = chainable({ count: 1, error: null });
      responses.couriers = chainable({ count: 2, error: null });
      responses.orders = chainable({ count: 5, error: null });
      responses.storefront_settings = chainable({
        data: { logo_url: 'logo.png', primary_color: '#fff' },
        error: null,
      });
      responses.tenant_payment_settings = chainable({
        data: { accept_cash: true },
        error: null,
      });
      setupMockFrom(responses);

      const { result } = renderHook(() => useSetupChecklist(), { wrapper });
      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data!.completedCount).toBe(7);
      expect(result.current.data!.percentage).toBe(100);
      expect(result.current.data!.allComplete).toBe(true);
    });
  });
});
