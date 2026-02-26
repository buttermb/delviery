/**
 * TenantAdminCommandPalette Tests
 * Tests for Global Search: Cmd+K opens the palette and search finds orders, customers, products
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TenantAdminCommandPalette, useCommandPaletteStore } from '../CommandPalette';

// Mock scrollIntoView which cmdk uses but jsdom doesn't implement
Element.prototype.scrollIntoView = vi.fn();

// Mock getAnimations for Radix dialog animations
Element.prototype.getAnimations = vi.fn().mockReturnValue([]);

// Mock the command UI components to bypass cmdk's internal filtering.
// cmdk applies its own fuzzy filtering which hides items in jsdom tests.
// We replace with simple wrappers that render all children unconditionally.
vi.mock('@/components/ui/command', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  const CommandDialog = ({ children, open, onOpenChange: _onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => {
    if (!open) return null;
    return React.createElement('div', { 'data-testid': 'command-dialog', role: 'dialog' }, children);
  };

  const CommandInput = React.forwardRef(({ placeholder, value, onValueChange, ...props }: { placeholder?: string; value?: string; onValueChange?: (v: string) => void } & Record<string, unknown>, ref: React.Ref<HTMLInputElement>) => {
    return React.createElement('input', {
      ref,
      role: 'combobox',
      placeholder,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value),
      ...props,
    });
  });

  const CommandList = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'command-list' }, children);

  const CommandEmpty = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'command-empty' }, children);

  const CommandGroup = ({ heading, children }: { heading?: string; children: React.ReactNode }) => {
    return React.createElement('div', { 'data-testid': `command-group-${heading || 'unnamed'}` },
      heading ? React.createElement('div', null, heading) : null,
      children
    );
  };

  const CommandItem = ({ children, onSelect, value }: { children: React.ReactNode; onSelect?: () => void; value?: string }) => {
    return React.createElement('div', {
      'data-testid': `command-item-${value || 'unnamed'}`,
      onClick: onSelect,
      role: 'option',
    }, children);
  };

  const CommandSeparator = () => React.createElement('hr');

  const CommandShortcut = ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children);

  const Command = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);

  return {
    Command,
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
    CommandShortcut,
  };
});

// Mock data
const mockProducts = [
  { id: 'prod-001', name: 'Blue Dream Flower', sku: 'BD-001', category: 'flower' },
  { id: 'prod-002', name: 'OG Kush Preroll', sku: 'OGK-002', category: 'preroll' },
];

const mockClients = [
  { id: 'client-001', business_name: 'Green Valley Dispensary', contact_name: 'John Smith' },
  { id: 'client-002', business_name: 'Herbal Wellness Co', contact_name: 'Jane Doe' },
];

const mockOrders = [
  { id: 'order-001-abcdef12', status: 'pending', total_amount: 450.00, created_at: '2024-01-15T10:00:00Z' },
  { id: 'order-002-bcdef123', status: 'completed', total_amount: 1200.50, created_at: '2024-01-14T09:00:00Z' },
];

// Mock supabase with fluent chain pattern
const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
    },
  };
});

// Mock tenant admin auth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
}

/**
 * Creates a fluent mock chain that resolves with the given data.
 * Each chainable method returns `this` to support method chaining.
 */
function createChainMock(resolvedData: unknown[]) {
  const result = { data: resolvedData, error: null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);

  return chain;
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
        <Routes>
          <Route path="/:tenantSlug/admin/*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Helper to type into the command palette input.
 * Our mock CommandInput uses standard React onChange -> onValueChange.
 */
async function typeInCommandInput(value: string) {
  const input = screen.getByRole('combobox');
  await act(async () => {
    fireEvent.change(input, { target: { value } });
  });
}

describe('TenantAdminCommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Reset zustand store
    useCommandPaletteStore.setState({ open: false });

    // Default mock setup - returns empty data
    mockFrom.mockImplementation(() => createChainMock([]));
  });

  describe('Opening with Cmd+K', () => {
    it('should open the command palette when Cmd+K is pressed', async () => {
      renderWithProviders(<TenantAdminCommandPalette />);

      // The dialog should not be visible initially
      expect(screen.queryByPlaceholderText(/search pages, orders, clients, products/i)).not.toBeInTheDocument();

      // Simulate Cmd+K (metaKey + K)
      await act(async () => {
        fireEvent.keyDown(document, { key: 'k', metaKey: true });
      });

      // The dialog input should now be visible
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search pages, orders, clients, products/i)).toBeInTheDocument();
      });
    });

    it('should open the command palette when Ctrl+K is pressed', async () => {
      renderWithProviders(<TenantAdminCommandPalette />);

      expect(screen.queryByPlaceholderText(/search pages, orders, clients, products/i)).not.toBeInTheDocument();

      // Simulate Ctrl+K (for Windows/Linux)
      await act(async () => {
        fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search pages, orders, clients, products/i)).toBeInTheDocument();
      });
    });

    it('should close the command palette when Cmd+K is pressed again', async () => {
      renderWithProviders(<TenantAdminCommandPalette />);

      // Open the palette
      await act(async () => {
        fireEvent.keyDown(document, { key: 'k', metaKey: true });
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search pages, orders, clients, products/i)).toBeInTheDocument();
      });

      // Close by pressing Cmd+K again (toggle)
      await act(async () => {
        fireEvent.keyDown(document, { key: 'k', metaKey: true });
      });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search pages, orders, clients, products/i)).not.toBeInTheDocument();
      });
    });

    it('should show navigation pages when opened without search', async () => {
      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await waitFor(() => {
        expect(screen.getByText('Pages')).toBeInTheDocument();
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });
    });
  });

  describe('Searching for Products', () => {
    it('should trigger product search query with correct parameters', async () => {
      const productChain = createChainMock(mockProducts);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'products') return productChain;
        return createChainMock([]);
      });

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('Blue Dream');

      // Verify the query was called correctly
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('products');
        expect(productChain.select).toHaveBeenCalledWith('id, name, sku, category');
        expect(productChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
        expect(productChain.ilike).toHaveBeenCalledWith('name', '%Blue Dream%');
        expect(productChain.limit).toHaveBeenCalledWith(5);
      });
    });

    it('should display product results when query returns data', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'products') return createChainMock(mockProducts);
        return createChainMock([]);
      });

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('Blue Dream');

      await waitFor(() => {
        expect(screen.getByText('Blue Dream Flower')).toBeInTheDocument();
        expect(screen.getByText('SKU: BD-001')).toBeInTheDocument();
      });
    });
  });

  describe('Searching for Customers/Clients', () => {
    it('should trigger client search query with correct parameters', async () => {
      const clientChain = createChainMock(mockClients);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'wholesale_clients') return clientChain;
        return createChainMock([]);
      });

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('Green Valley');

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('wholesale_clients');
        expect(clientChain.select).toHaveBeenCalledWith('id, business_name, contact_name');
        expect(clientChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
        expect(clientChain.or).toHaveBeenCalledWith(
          'business_name.ilike.%Green Valley%,contact_name.ilike.%Green Valley%'
        );
        expect(clientChain.limit).toHaveBeenCalledWith(5);
      });
    });

    it('should display client results when query returns data', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'wholesale_clients') return createChainMock(mockClients);
        return createChainMock([]);
      });

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('Green Valley');

      await waitFor(() => {
        expect(screen.getByText('Green Valley Dispensary')).toBeInTheDocument();
        expect(screen.getByText('Contact: John Smith')).toBeInTheDocument();
      });
    });
  });

  describe('Searching for Orders', () => {
    it('should trigger orders search query with correct parameters', async () => {
      const ordersChain = createChainMock(mockOrders);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') return ordersChain;
        return createChainMock([]);
      });

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('order');

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('orders');
        expect(ordersChain.select).toHaveBeenCalledWith('id, status, total_amount, created_at');
        expect(ordersChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
        expect(ordersChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(ordersChain.limit).toHaveBeenCalledWith(5);
      });
    });

    it('should display order results when query returns data', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'orders') return createChainMock(mockOrders);
        return createChainMock([]);
      });

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('order');

      // Both orders have IDs starting with "order-00" (sliced to 8 chars)
      // Verify at least one order result is rendered
      await waitFor(() => {
        const orderItems = screen.getAllByText('Order #order-00');
        expect(orderItems.length).toBe(2);
      });
    });
  });

  describe('Search behavior', () => {
    it('should not trigger queries with fewer than 2 characters', async () => {
      mockFrom.mockImplementation(() => createChainMock(mockProducts));

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('a');

      // Queries should not be called for product search with single char
      // (enabled: search.length >= 2 means queries won't fire)
      // Wait a bit to ensure nothing fires
      await new Promise((r) => setTimeout(r, 100));

      // The from mock should not have been called for search queries
      // (it may be called on mount with empty search, but enabled=false prevents the queryFn)
      expect(screen.queryByText('Blue Dream Flower')).not.toBeInTheDocument();
    });

    it('should search all three tables simultaneously when query is 2+ chars', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'products') return createChainMock(mockProducts);
        if (table === 'wholesale_clients') return createChainMock(mockClients);
        if (table === 'orders') return createChainMock(mockOrders);
        return createChainMock([]);
      });

      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await typeInCommandInput('test search');

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('products');
        expect(mockFrom).toHaveBeenCalledWith('wholesale_clients');
        expect(mockFrom).toHaveBeenCalledWith('orders');
      });
    });
  });

  describe('Footer hints', () => {
    it('should display keyboard shortcut hints', async () => {
      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.setState({ open: true });
      });

      await waitFor(() => {
        expect(screen.getByText('to search')).toBeInTheDocument();
        expect(screen.getByText('to select')).toBeInTheDocument();
      });
    });
  });

  describe('Zustand store', () => {
    it('should open palette when store state is set to open', async () => {
      renderWithProviders(<TenantAdminCommandPalette />);

      expect(screen.queryByPlaceholderText(/search pages, orders, clients, products/i)).not.toBeInTheDocument();

      await act(async () => {
        useCommandPaletteStore.getState().setOpen(true);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search pages, orders, clients, products/i)).toBeInTheDocument();
      });
    });

    it('should toggle palette via store toggle method', async () => {
      renderWithProviders(<TenantAdminCommandPalette />);

      await act(async () => {
        useCommandPaletteStore.getState().toggle();
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search pages, orders, clients, products/i)).toBeInTheDocument();
      });

      await act(async () => {
        useCommandPaletteStore.getState().toggle();
      });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search pages, orders, clients, products/i)).not.toBeInTheDocument();
      });
    });
  });
});
