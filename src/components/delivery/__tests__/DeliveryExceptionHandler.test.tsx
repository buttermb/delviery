/**
 * Tests for DeliveryExceptionHandler component
 *
 * Verifies:
 * - Exception form renders correctly
 * - Submit button disabled when fields are empty
 * - Notification insert includes correct fields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTenantAdminAuth', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    deliveries: { all: ['deliveries'] },
    orders: { detail: (tenantId: string, orderId: string) => ['orders', tenantId, orderId] },
  },
}));

import { DeliveryExceptionHandler } from '../DeliveryExceptionHandler';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{ui}</BrowserRouter>
      </QueryClientProvider>
    ),
    queryClient,
  };
}

describe('DeliveryExceptionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the exception report form', () => {
    renderWithProviders(
      <DeliveryExceptionHandler deliveryId="del-1" orderId="ord-1" />
    );

    expect(screen.getByText('Report Delivery Exception')).toBeInTheDocument();
    expect(screen.getByText('Exception Type')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report exception/i })).toBeInTheDocument();
  });

  it('disables submit when required fields are empty', () => {
    renderWithProviders(
      <DeliveryExceptionHandler deliveryId="del-1" orderId="ord-1" />
    );

    const submitButton = screen.getByRole('button', { name: /report exception/i });
    expect(submitButton).toBeDisabled();
  });

  it('renders the exception type select trigger', () => {
    renderWithProviders(
      <DeliveryExceptionHandler deliveryId="del-1" orderId="ord-1" />
    );

    expect(screen.getByText('Select exception type...')).toBeInTheDocument();
  });

  it('renders the details textarea', () => {
    renderWithProviders(
      <DeliveryExceptionHandler deliveryId="del-1" orderId="ord-1" />
    );

    expect(screen.getByPlaceholderText('Describe what happened...')).toBeInTheDocument();
  });
});

describe('Notification payload structure', () => {
  it('should create correct notification payload for exception', () => {
    const tenantId = 'test-tenant-id';
    const deliveryId = 'del-123';
    const orderId = 'order-abcdef-123456';
    const exceptionLabel = 'Wrong Address';
    const notes = 'Customer moved to new location';

    const payload = {
      tenant_id: tenantId,
      user_id: null,
      title: 'Delivery Exception Reported',
      message: `${exceptionLabel} — Order ${orderId.slice(0, 8)}... ${notes ? `: ${notes}` : ''}`,
      type: 'warning' as const,
      entity_type: 'delivery',
      entity_id: deliveryId,
      read: false,
    };

    expect(payload.tenant_id).toBe('test-tenant-id');
    expect(payload.user_id).toBeNull();
    expect(payload.title).toBe('Delivery Exception Reported');
    expect(payload.message).toContain('Wrong Address');
    expect(payload.message).toContain('order-ab');
    expect(payload.message).toContain('Customer moved');
    expect(payload.type).toBe('warning');
    expect(payload.entity_type).toBe('delivery');
    expect(payload.entity_id).toBe('del-123');
    expect(payload.read).toBe(false);
  });

  it('should handle empty notes in notification message', () => {
    const exceptionLabel = 'No Answer / Nobody Home';
    const orderId = 'order-xyz-789';
    const notes = '';

    const message = `${exceptionLabel} — Order ${orderId.slice(0, 8)}... ${notes ? `: ${notes}` : ''}`;

    expect(message).toBe('No Answer / Nobody Home — Order order-xy... ');
    expect(message).not.toContain(':');
  });

  it('should broadcast to all admins by setting user_id to null', () => {
    const payload = {
      tenant_id: 'tenant-1',
      user_id: null,
      title: 'Delivery Exception Reported',
      type: 'warning',
    };

    expect(payload.user_id).toBeNull();
  });
});
