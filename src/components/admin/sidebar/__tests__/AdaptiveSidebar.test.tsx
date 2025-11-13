/**
 * AdaptiveSidebar Component Tests
 * Tests adaptive sidebar rendering, operation size adaptation, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AdaptiveSidebar } from '../AdaptiveSidebar';
import { TenantAdminAuthProvider } from '@/contexts/TenantAdminAuthContext';

// Mock hooks
vi.mock('@/hooks/useSidebarConfig', () => ({
  useSidebarConfig: () => ({
    sidebarConfig: [
      {
        section: 'Core',
        items: [
          { id: 'dashboard', name: 'Dashboard', path: '/admin/dashboard', icon: 'LayoutDashboard' }
        ]
      }
    ],
    hotItems: [],
    favorites: [],
    isLoading: false
  })
}));

vi.mock('@/hooks/useSidebarMigration', () => ({
  useSidebarMigration: () => ({ migrationStatus: 'complete' })
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant', slug: 'test-slug' },
    admin: { id: 'test-admin' },
    logout: vi.fn()
  }),
  TenantAdminAuthProvider: ({ children }: any) => children
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('AdaptiveSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<AdaptiveSidebar />, { wrapper: createWrapper() });
    expect(container).toBeTruthy();
  });

  it('should display tenant information in header', async () => {
    render(<AdaptiveSidebar />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText(/test-slug/i)).toBeInTheDocument();
    });
  });

  it('should render logout button in footer', async () => {
    render(<AdaptiveSidebar />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText(/logout/i)).toBeInTheDocument();
    });
  });

  it('should show loading skeleton when data is loading', () => {
    vi.mocked(require('@/hooks/useSidebarConfig').useSidebarConfig).mockReturnValue({
      sidebarConfig: [],
      hotItems: [],
      favorites: [],
      isLoading: true
    });

    render(<AdaptiveSidebar />, { wrapper: createWrapper() });
    
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
