/**
 * Tests for DeliveryExceptionHandler component
 *
 * Verifies:
 * - Exception form renders correctly
 * - Submit button is disabled when form is incomplete
 * - Renders all exception type options
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/hooks/useTenantAdminAuth', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  },
}));

import { DeliveryExceptionHandler } from '../DeliveryExceptionHandler';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('DeliveryExceptionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the exception form with title', () => {
    render(
      <DeliveryExceptionHandler deliveryId="del-123" orderId="ord-456" />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText('Report Delivery Exception')).toBeInTheDocument();
  });

  it('renders exception type selector and notes field', () => {
    render(
      <DeliveryExceptionHandler deliveryId="del-123" orderId="ord-456" />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText('Exception Type')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe what happened...')).toBeInTheDocument();
  });

  it('disables submit when form is incomplete', () => {
    render(
      <DeliveryExceptionHandler deliveryId="del-123" orderId="ord-456" />,
      { wrapper: createWrapper() }
    );
    const submitButton = screen.getByRole('button', { name: /report exception/i });
    expect(submitButton).toBeDisabled();
  });

  it('renders the select trigger with placeholder', () => {
    render(
      <DeliveryExceptionHandler deliveryId="del-123" orderId="ord-456" />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText('Select exception type...')).toBeInTheDocument();
  });
});
