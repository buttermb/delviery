/**
 * useOperationSize Hook Tests
 * Tests operation size detection and manual override
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { createElement } from 'react';
import { useOperationSize } from '../useOperationSize';

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { 
      id: 'test-tenant',
      detected_operation_size: 'medium',
      monthly_orders: 500,
      team_size: 10
    },
    admin: { id: 'test-admin' }
  })
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { operation_size: 'medium' },
            error: null
          })
        })
      }),
      upsert: () => Promise.resolve({ error: null })
    })
  }
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useOperationSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return operation size', async () => {
    const { result } = renderHook(() => useOperationSize(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.operationSize).toBeDefined();
    });
  });

  it('should handle manual override', async () => {
    const { result } = renderHook(() => useOperationSize(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.setOperationSize).toBeDefined();
    });

    act(() => {
      result.current.setOperationSize('enterprise');
    });

    await waitFor(() => {
      expect(result.current.operationSize).toBe('enterprise');
    });
  });

  it('should detect size based on metrics', async () => {
    const { result } = renderHook(() => useOperationSize(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(['street', 'small', 'medium', 'enterprise']).toContain(result.current.operationSize);
    });
  });
});
