/**
 * VendorContactsManager Credit Gating Tests
 *
 * Verifies that vendor contact interaction logging is properly gated by credits:
 * 1. crm_log_interaction action key is used with the correct cost (5 credits)
 * 2. useCreditGatedAction hook is integrated in VendorContactsManager
 * 3. Credit check blocks logging when insufficient credits
 * 4. Credit check allows logging when sufficient credits
 * 5. CreditCostBadge is shown for free-tier users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockLogInteraction = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
    },
    admin: { id: 'test-admin-id' },
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
  useCredits: () => ({
    balance: 100,
    isFreeTier: true,
    isLoading: false,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@/hooks/useVendorContacts', () => ({
  useVendorContacts: () => ({
    contacts: [
      {
        id: 'contact-1',
        tenant_id: 'test-tenant-id',
        vendor_id: 'vendor-1',
        name: 'John Smith',
        role: 'Sales Manager',
        department: 'sales',
        phone: '555-123-4567',
        email: 'john@vendor.com',
        is_primary: true,
        notes: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    primaryContact: null,
    isLoading: false,
    isError: false,
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
    setPrimary: vi.fn(),
    logInteraction: mockLogInteraction,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isSettingPrimary: false,
  }),
  useVendorContactHistory: () => ({
    data: [],
    isLoading: false,
  }),
  DEPARTMENT_OPTIONS: [
    { value: 'sales', label: 'Sales' },
    { value: 'billing', label: 'Billing' },
  ],
  HISTORY_ACTION_LABELS: {
    call: 'Phone Call',
    email: 'Email',
    meeting: 'Meeting',
    note: 'Note',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('VendorContactsManager Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockLogInteraction.mockResolvedValue({
      id: 'history-1',
      tenant_id: 'test-tenant-id',
      vendor_contact_id: 'contact-1',
      action: 'call',
      summary: 'Called John Smith',
      created_by: 'test-admin-id',
      created_at: '2024-01-01T00:00:00Z',
    });
  });

  it('should render the contacts manager with contacts', async () => {
    const { VendorContactsManager } = await import('../VendorContactsManager');
    renderWithProviders(<VendorContactsManager vendorId="vendor-1" vendorName="Test Vendor" />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('should call executeCreditAction with crm_log_interaction when quick-calling a contact', async () => {
    const user = userEvent.setup();
    const { VendorContactsManager } = await import('../VendorContactsManager');
    renderWithProviders(<VendorContactsManager vendorId="vendor-1" vendorName="Test Vendor" />);

    // Click the phone number link (quick call action)
    const phoneLink = screen.getByText('555-123-4567');
    await user.click(phoneLink);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'crm_log_interaction',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should call executeCreditAction with crm_log_interaction when quick-emailing a contact', async () => {
    const user = userEvent.setup();
    const { VendorContactsManager } = await import('../VendorContactsManager');
    renderWithProviders(<VendorContactsManager vendorId="vendor-1" vendorName="Test Vendor" />);

    // Click the email link (quick email action)
    const emailLink = screen.getByText('john@vendor.com');
    await user.click(emailLink);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'crm_log_interaction',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should not log interaction when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { VendorContactsManager } = await import('../VendorContactsManager');
    renderWithProviders(<VendorContactsManager vendorId="vendor-1" vendorName="Test Vendor" />);

    // Click the phone number link (quick call action)
    const phoneLink = screen.getByText('555-123-4567');
    await user.click(phoneLink);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'crm_log_interaction',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });

    // The logInteraction function was NOT called (because the gate returned null)
    expect(mockLogInteraction).not.toHaveBeenCalled();
  });

  it('should show CreditCostBadge in the history dialog for free-tier users', async () => {
    const user = userEvent.setup();
    const { VendorContactsManager } = await import('../VendorContactsManager');
    renderWithProviders(<VendorContactsManager vendorId="vendor-1" vendorName="Test Vendor" />);

    // Open the dropdown menu
    const actionsButton = screen.getByLabelText('Contact actions');
    await user.click(actionsButton);

    // Click "View History"
    const viewHistoryButton = screen.getByText('View History');
    await user.click(viewHistoryButton);

    await waitFor(() => {
      expect(screen.getByText(/Contact History/)).toBeInTheDocument();
    });

    // CreditCostBadge should show the cost "5"
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for crm_log_interaction
// ============================================================================

describe('CRM Log Interaction Credit Cost Configuration', () => {
  it('crm_log_interaction should cost 5 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('crm_log_interaction')).toBe(5);
  });

  it('crm_log_interaction should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('crm_log_interaction')).toBe(false);
  });

  it('crm_log_interaction should be categorized under crm', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('crm_log_interaction');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('crm');
    expect(info?.actionName).toBe('Log Interaction');
    expect(info?.credits).toBe(5);
  });
});
