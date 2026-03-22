/**
 * MenuShareDialogEnhanced Credit Gating Tests
 *
 * Verifies that menu link sharing actions are tracked through useCreditGatedAction:
 * 1. menu_share_link action key is used (0 credits - FREE but tracked)
 * 2. Copy URL action triggers credit tracking
 * 3. WhatsApp share triggers credit tracking
 * 4. Email share triggers credit tracking
 * 5. Share actions still execute even when tracked
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn().mockResolvedValue({ success: true, creditsCost: 0, wasBlocked: false }),
}));

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: vi.fn().mockReturnValue({
    execute: mockExecute,
    showOutOfCreditsModal: false,
    closeOutOfCreditsModal: vi.fn(),
    blockedAction: null,
    isExecuting: false,
    balance: 1000,
    isFreeTier: true,
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
    },
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useWholesaleData', () => ({
  useWholesaleClients: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useDisposableMenus', () => ({
  useMenuWhitelist: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('@/utils/menuHelpers', () => ({
  formatMenuUrl: (token?: string, accessToken?: string) =>
    `https://example.com/menu/${token ?? 'test'}${accessToken ? `?t=${accessToken}` : ''}`,
}));

vi.mock('@/lib/utils/qrCode', () => ({
  generateQRCodeDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test'),
  downloadQRCodePNG: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => date,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// Mock window.open
const mockWindowOpen = vi.fn();
vi.stubGlobal('open', mockWindowOpen);

import { MenuShareDialogEnhanced } from '../MenuShareDialogEnhanced';

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

const defaultMenu = {
  id: 'menu-123',
  tenant_id: 'test-tenant-id',
  encrypted_url_token: 'enc-token-abc',
  access_code: '1234',
  name: 'Test Menu',
  expiration_date: '2026-12-31',
  status: 'active',
  security_settings: null,
};

// ============================================================================
// Tests
// ============================================================================

describe('MenuShareDialogEnhanced Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls useCreditGatedAction.execute with menu_share_link when copying URL', async () => {
    const user = userEvent.setup();

    render(
      <MenuShareDialogEnhanced
        open={true}
        onOpenChange={vi.fn()}
        menu={defaultMenu}
      />,
      { wrapper: createWrapper() },
    );

    // Find and click the copy button (first one in the URL row)
    const copyButtons = screen.getAllByRole('button');
    const copyButton = copyButtons.find(btn => btn.querySelector('.lucide-copy'));
    expect(copyButton).toBeTruthy();

    await user.click(copyButton!);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: 'menu_share_link',
        referenceId: 'menu-123',
        referenceType: 'menu_share_copy',
      }),
    );
  });

  it('calls useCreditGatedAction.execute with menu_share_link when sharing via WhatsApp', async () => {
    const user = userEvent.setup();

    render(
      <MenuShareDialogEnhanced
        open={true}
        onOpenChange={vi.fn()}
        menu={defaultMenu}
      />,
      { wrapper: createWrapper() },
    );

    const whatsappButton = screen.getByRole('button', { name: /whatsapp/i });
    await user.click(whatsappButton);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: 'menu_share_link',
        referenceId: 'menu-123',
        referenceType: 'menu_share_whatsapp',
      }),
    );
  });

  it('calls useCreditGatedAction.execute with menu_share_link when sharing via Email', async () => {
    const user = userEvent.setup();

    render(
      <MenuShareDialogEnhanced
        open={true}
        onOpenChange={vi.fn()}
        menu={defaultMenu}
      />,
      { wrapper: createWrapper() },
    );

    const emailButton = screen.getByRole('button', { name: /email/i });
    await user.click(emailButton);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: 'menu_share_link',
        referenceId: 'menu-123',
        referenceType: 'menu_share_email',
      }),
    );
  });

  it('executes the share action even though credits cost is 0 (FREE)', async () => {
    const user = userEvent.setup();

    // Mock execute to call the action callback
    mockExecute.mockImplementation(async (options: { action: () => Promise<void> }) => {
      await options.action();
      return { success: true, creditsCost: 0, wasBlocked: false };
    });

    render(
      <MenuShareDialogEnhanced
        open={true}
        onOpenChange={vi.fn()}
        menu={defaultMenu}
      />,
      { wrapper: createWrapper() },
    );

    const whatsappButton = screen.getByRole('button', { name: /whatsapp/i });
    await user.click(whatsappButton);

    // Verify the actual share action executed (window.open for WhatsApp)
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('passes an action function to execute for copy operations', async () => {
    const user = userEvent.setup();

    render(
      <MenuShareDialogEnhanced
        open={true}
        onOpenChange={vi.fn()}
        menu={defaultMenu}
      />,
      { wrapper: createWrapper() },
    );

    const copyButtons = screen.getAllByRole('button');
    const copyButton = copyButtons.find(btn => btn.querySelector('.lucide-copy'));
    await user.click(copyButton!);

    // Verify execute was called with the correct action key and an action function
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: 'menu_share_link',
        action: expect.any(Function),
        referenceType: 'menu_share_copy',
      }),
    );
  });

  it('passes menu id as referenceId for all share tracking', async () => {
    const user = userEvent.setup();

    render(
      <MenuShareDialogEnhanced
        open={true}
        onOpenChange={vi.fn()}
        menu={{ ...defaultMenu, id: 'specific-menu-id' }}
      />,
      { wrapper: createWrapper() },
    );

    const whatsappButton = screen.getByRole('button', { name: /whatsapp/i });
    await user.click(whatsappButton);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: 'specific-menu-id',
      }),
    );
  });
});
