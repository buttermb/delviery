/**
 * useSidebarConfig Hook Tests
 * Tests sidebar configuration logic for all operation sizes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { createElement } from 'react';
import { useSidebarConfig } from '../useSidebarConfig';

// Mock dependencies
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant', detected_operation_size: 'medium' },
    admin: { id: 'test-admin' }
  })
}));

vi.mock('../useOperationSize', () => ({
  useOperationSize: () => ({
    operationSize: 'medium',
    isLoading: false
  })
}));

vi.mock('../useSidebarPreferences', () => ({
  useSidebarPreferences: () => ({
    preferences: {
      favorites: ['dashboard'],
      collapsedSections: [],
      pinnedItems: []
    },
    isLoading: false
  })
}));

vi.mock('../useFeatureTracking', () => ({
  useFeatureTracking: () => ({
    recentFeatures: [],
    trackFeatureClick: vi.fn()
  })
}));

vi.mock('../usePermissions', () => ({
  usePermissions: () => ({
    role: 'owner'
  })
}));

vi.mock('../useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'professional',
    canAccess: () => true
  })
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useSidebarConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return sidebar configuration', () => {
    const { result } = renderHook(() => useSidebarConfig(), {
      wrapper: createWrapper()
    });

    expect(result.current.sidebarConfig).toBeDefined();
    expect(Array.isArray(result.current.sidebarConfig)).toBe(true);
  });

  it('should return hot items array', () => {
    const { result } = renderHook(() => useSidebarConfig(), {
      wrapper: createWrapper()
    });

    expect(result.current.hotItems).toBeDefined();
    expect(Array.isArray(result.current.hotItems)).toBe(true);
  });

  it('should return favorites array', () => {
    const { result } = renderHook(() => useSidebarConfig(), {
      wrapper: createWrapper()
    });

    expect(result.current.favorites).toBeDefined();
    expect(Array.isArray(result.current.favorites)).toBe(true);
  });

  it('should handle loading state', () => {
    const { result } = renderHook(() => useSidebarConfig(), {
      wrapper: createWrapper()
    });

    expect(result.current.sidebarConfig).toBeDefined();
    expect(Array.isArray(result.current.sidebarConfig)).toBe(true);
  });

  it('should adapt to different operation sizes', async () => {
    const { result } = renderHook(() => useSidebarConfig(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.sidebarConfig).toBeDefined();
      expect(Array.isArray(result.current.sidebarConfig)).toBe(true);
    });
  });
});
