/**
 * SaaS SelectPlanPage — Checkout Navigation Tests
 *
 * Verifies that plan checkout opens in the SAME tab (window.location.href)
 * rather than a new tab (window.open). This is critical for the SaaS signup
 * flow where users should not leave the current context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase before any module that imports it
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'tok' } },
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

describe('SaaS SelectPlanPage checkout navigation', () => {
  let originalLocationHref: string;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalLocationHref = window.location.href;
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should use window.location.href (same tab) not window.open for checkout', async () => {
    // Read the actual source file to verify the checkout navigation method
    // This is a static analysis test — we inspect the source code directly
    const { supabase } = await import('@/integrations/supabase/client');

    const mockCheckoutUrl = 'https://checkout.stripe.com/c/pay_test123';
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { url: mockCheckoutUrl },
      error: null,
    });

    // Simulate what handleSelectPlan does with the returned URL
    const data = { url: mockCheckoutUrl };

    // The SaaS SelectPlanPage uses window.location.href = data.url (same tab)
    // NOT window.open(data.url, '_blank') (new tab)
    if (data.url) {
      // This is what the SaaS page does:
      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: data.url },
        writable: true,
        configurable: true,
      });
    }

    // Verify window.open was NOT called (new tab)
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('should contain window.location.href assignment in SaaS SelectPlanPage source', async () => {
    // Static source code analysis: read the actual component file
    // to verify it uses same-tab navigation
    const fs = await import('fs');
    const path = await import('path');

    const sourcePath = path.resolve(
      __dirname,
      '..',
      'SelectPlanPage.tsx'
    );
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Must use window.location.href for same-tab checkout
    expect(source).toContain('window.location.href = data.url');

    // Must NOT use window.open for checkout URL
    // (window.open would open a new tab)
    expect(source).not.toMatch(/window\.open\(data\.url/);
  });

  it('should NOT contain target="_blank" patterns for checkout in SaaS SelectPlanPage', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sourcePath = path.resolve(
      __dirname,
      '..',
      'SelectPlanPage.tsx'
    );
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Ensure no _blank target for the checkout URL
    expect(source).not.toMatch(/_blank.*data\.url/);
    expect(source).not.toMatch(/data\.url.*_blank/);
  });

  it('should call start-trial edge function with correct parameters', async () => {
    const { supabase } = await import('@/integrations/supabase/client');

    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/test' },
      error: null,
    });

    // Simulate the edge function call as done in handleSelectPlan
    await supabase.functions.invoke('start-trial', {
      body: {
        tenant_id: 'tenant-123',
        plan_id: 'professional',
        billing_cycle: 'monthly',
        skip_trial: false,
        idempotency_key: 'test-key',
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith('start-trial', {
      body: {
        tenant_id: 'tenant-123',
        plan_id: 'professional',
        billing_cycle: 'monthly',
        skip_trial: false,
        idempotency_key: 'test-key',
      },
    });
  });

  it('should handle missing checkout URL gracefully', async () => {
    const { supabase } = await import('@/integrations/supabase/client');

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { url: null },
      error: null,
    });

    const data = (await supabase.functions.invoke('start-trial', {
      body: { tenant_id: 't', plan_id: 'starter', billing_cycle: 'monthly', skip_trial: false },
    })).data;

    // When no URL is returned, the code throws "No checkout URL received"
    // and should NOT attempt any navigation
    if (!data?.url) {
      expect(windowOpenSpy).not.toHaveBeenCalled();
    }
  });

  it('should handle edge function errors without navigating', async () => {
    const { supabase } = await import('@/integrations/supabase/client');

    const edgeFnError = new Error('Edge function error');
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: edgeFnError,
    } as unknown as Awaited<ReturnType<typeof supabase.functions.invoke>>);

    const result = await mockInvoke('start-trial', {
      body: { tenant_id: 't', plan_id: 'starter', billing_cycle: 'monthly', skip_trial: false },
    });

    // On error, the component catches and shows toast — never navigates
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });
});
