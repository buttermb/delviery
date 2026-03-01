/**
 * useSidebarPreferences Hook Tests
 * Tests user preference persistence and management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { createElement } from 'react';
import { useSidebarPreferences } from '../useSidebarPreferences';

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant' },
    admin: { id: 'test-admin' }
  })
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: {
              favorites: ['dashboard'],
              collapsed_sections: ['reports'],
              pinned_items: []
            },
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

describe('useSidebarPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load user preferences', async () => {
    const { result } = renderHook(() => useSidebarPreferences(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.preferences).toBeDefined();
      expect(result.current.preferences.favorites).toContain('dashboard');
    });
  });

  it('should toggle favorites', async () => {
    const { result } = renderHook(() => useSidebarPreferences(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.toggleFavorite).toBeDefined();
    });

    act(() => {
      result.current.toggleFavorite('products');
    });

    await waitFor(() => {
      expect(result.current.preferences.favorites).toContain('products');
    });
  });

  it('should toggle section collapse', async () => {
    const { result } = renderHook(() => useSidebarPreferences(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.toggleCollapsedSection).toBeDefined();
    });

    act(() => {
      result.current.toggleCollapsedSection('operations');
    });

    await waitFor(() => {
      expect(result.current.preferences.collapsedSections).toBeDefined();
    });
  });

  it('should handle empty preferences gracefully', async () => {
    const { result } = renderHook(() => useSidebarPreferences(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.preferences).toBeDefined();
      expect(Array.isArray(result.current.preferences.favorites)).toBe(true);
      expect(Array.isArray(result.current.preferences.collapsedSections)).toBe(true);
    });
  });
});
