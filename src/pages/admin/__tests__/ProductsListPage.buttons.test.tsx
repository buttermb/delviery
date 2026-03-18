/**
 * ProductsListPage Button Audit Tests
 * Tests for button accessibility, XSS prevention, loading states, and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));
vi.mock('@/hooks/useTenantNavigate', () => ({
  useTenantNavigate: vi.fn().mockReturnValue(mockNavigate),
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: vi.fn((value: string) => value),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description, primaryAction }: { title?: string; description?: string; primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode } }) => (
    <div data-testid="empty-state">
      {title && <span>{title}</span>}
      {description && <span>{description}</span>}
      {primaryAction && (
        <button onClick={primaryAction.onClick} data-testid="empty-state-action">{primaryAction.label}</button>
      )}
    </div>
  ),
}));

// Import after mocks
import { ProductsListPage } from '../ProductsListPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

const createMockProducts = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `product-${i}`,
    name: `Product ${i}`,
    sku: `SKU${String(i).padStart(3, '0')}`,
    category: ['flower', 'edibles', 'concentrates', 'topicals'][i % 4],
    vendor_name: `Vendor ${i % 3}`,
    description: `Description for product ${i}`,
    wholesale_price: 10 + (i % 50),
    retail_price: 20 + (i % 50),
    available_quantity: 50 + (i % 100),
    cost_per_unit: 5 + (i % 25),
    low_stock_alert: 10,
    menu_visibility: i % 2 === 0,
    tenant_id: 'tenant-123',
    image_url: `https://example.com/product-${i}.jpg`,
    coa_url: null,
    lab_results_url: null,
    created_at: new Date().toISOString(),
  }));
};

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <TooltipProvider>
      <MemoryRouter initialEntries={['/test-tenant/admin/products']}>
        {children}
      </MemoryRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const setupWithProducts = (count = 5) => {
  const mockProducts = createMockProducts(count);
  const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: orderMock,
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  });
  return mockProducts;
};

const setupWithError = () => {
  const orderMock = vi.fn().mockRejectedValue(new Error('Network error'));
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: orderMock,
  });
};

describe('ProductsListPage - Button Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  describe('Add Product Button', () => {
    it('should render with correct text and icon', async () => {
      setupWithProducts();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /add product/i });
        expect(button).toBeInTheDocument();
      });
    });

    it('should navigate to add product page on click', async () => {
      setupWithProducts();
      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add product/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/inventory-hub?tab=products&new=true');
    });
  });

  describe('View Toggle Buttons', () => {
    it('should have accessible aria-labels for grid and table view', async () => {
      setupWithProducts();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
        expect(screen.getByLabelText('Table view')).toBeInTheDocument();
      });
    });

    it('should toggle between grid and table view', async () => {
      setupWithProducts(10);
      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(/)).toBeInTheDocument();
      });

      // Grid view is default (pressed)
      expect(screen.getByLabelText('Grid view')).toHaveAttribute('data-state', 'on');
      expect(screen.getByLabelText('Table view')).toHaveAttribute('data-state', 'off');

      // Switch to table view
      await user.click(screen.getByLabelText('Table view'));
      expect(screen.getByLabelText('Table view')).toHaveAttribute('data-state', 'on');
      expect(screen.getByLabelText('Grid view')).toHaveAttribute('data-state', 'off');
    });
  });

  describe('Sort Controls', () => {
    it('should render sort dropdown with Name selected by default', async () => {
      setupWithProducts(5);
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(/)).toBeInTheDocument();
      });

      // The sort dropdown shows "Name" by default (the default sortBy is 'name')
      // SelectValue renders the selected text
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe('Actions Dropdown Button', () => {
    it('should have aria-label on dropdown trigger', async () => {
      setupWithProducts(3);
      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(/)).toBeInTheDocument();
      });

      // Switch to table view to see action buttons
      await user.click(screen.getByLabelText('Table view'));

      await waitFor(() => {
        const actionButtons = screen.getAllByLabelText('More options');
        expect(actionButtons.length).toBeGreaterThan(0);
      });
    });

    it('should not have redundant sizing classes on dropdown trigger', async () => {
      setupWithProducts(3);
      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(/)).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Table view'));

      await waitFor(() => {
        const actionButtons = screen.getAllByLabelText('More options');
        // size="icon" already applies h-11 w-11, so className should not duplicate it
        const firstButton = actionButtons[0];
        const classNames = firstButton.className.split(' ');
        const h11Count = classNames.filter((c: string) => c === 'h-11').length;
        // Should only have h-11 once (from size="icon" variant)
        expect(h11Count).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Error Retry Buttons', () => {
    it('should render retry button when query fails with no data', async () => {
      setupWithError();

      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/failed to load products/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
      // When not fetching, the button should not be disabled
      expect(retryButton).not.toBeDisabled();
    });
  });

  describe('Compare Button', () => {
    it('should show compare button when 2-4 products are selected', async () => {
      setupWithProducts(5);
      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(/)).toBeInTheDocument();
      });

      // Switch to table view to access checkboxes
      await user.click(screen.getByLabelText('Table view'));

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(2);
      });

      // Select 2 products by clicking individual checkboxes (skip select-all which is first)
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      await waitFor(() => {
        const compareButton = screen.getByRole('button', { name: /compare/i });
        expect(compareButton).toBeInTheDocument();
      });
    });
  });

  describe('XSS Prevention in Print Label', () => {
    it('should escape HTML entities in product names for print labels', async () => {
      // Create products with XSS payloads
      const xssProducts = [{
        id: 'xss-1',
        name: '<script>alert("xss")</script>',
        sku: '"><img src=x onerror=alert(1)>',
        category: '<b>malicious</b>',
        vendor_name: 'Normal Vendor',
        description: 'Normal description',
        wholesale_price: 25,
        retail_price: 50,
        available_quantity: 100,
        cost_per_unit: 10,
        low_stock_alert: 10,
        menu_visibility: true,
        tenant_id: 'tenant-123',
        image_url: null,
        coa_url: null,
        lab_results_url: null,
        created_at: new Date().toISOString(),
      }];

      const orderMock = vi.fn().mockResolvedValue({ data: xssProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      });

      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(/)).toBeInTheDocument();
      });

      // Switch to table view to access dropdown
      await user.click(screen.getByLabelText('Table view'));

      await waitFor(() => {
        const actionButtons = screen.getAllByLabelText('More options');
        expect(actionButtons.length).toBeGreaterThan(0);
      });

      // Mock window.open to capture what gets written
      const mockPrintWindow = {
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        print: vi.fn(),
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window);

      // Open dropdown and click Print Label
      const actionButton = screen.getAllByLabelText('More options')[0];
      await user.click(actionButton);

      await waitFor(() => {
        expect(screen.getByText(/print label/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/print label/i));

      // Verify that the HTML was escaped
      expect(mockPrintWindow.document.write).toHaveBeenCalledTimes(1);
      const writtenHtml = mockPrintWindow.document.write.mock.calls[0][0] as string;

      // The raw script tag should NOT appear — it should be escaped
      expect(writtenHtml).not.toContain('<script>');
      expect(writtenHtml).toContain('&lt;script&gt;');

      // The img tag with onerror should be escaped (no raw <img> tag)
      expect(writtenHtml).not.toContain('<img src=x');
      expect(writtenHtml).toContain('&lt;img');

      // Bold tag in category should be escaped
      expect(writtenHtml).not.toContain('<b>malicious</b>');
      expect(writtenHtml).toContain('&lt;b&gt;');

      // Clean up spy
      vi.restoreAllMocks();
    });
  });
});
