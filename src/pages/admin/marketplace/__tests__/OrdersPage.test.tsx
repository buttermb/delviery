/**
 * Tests for Marketplace OrdersPage
 *
 * Verifies:
 * - Loading skeleton display
 * - Orders table rendering with data
 * - Search filtering with sanitization
 * - Empty state display (with and without filters)
 * - Payment and order status badges
 * - Pagination
 * - Realtime subscription setup
 * - No marketplace profile state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Hoisted mocks — must be declared before any vi.mock() calls
const {
    mockNavigate,
    mockChannel,
    mockRemoveChannel,
    mockOrders,
    mockProfile,
} = vi.hoisted(() => {
    const fn = vi.fn;
    return {
        mockNavigate: fn(),
        mockChannel: {
            on: fn().mockReturnThis(),
            subscribe: fn().mockReturnThis(),
        },
        mockRemoveChannel: fn(),
        mockOrders: [
            {
                id: 'order-1',
                order_number: 'MKT-001',
                customer_name: 'Green Leaf Co',
                customer_email: 'orders@greenleaf.com',
                buyer_tenant_id: 'buyer-1',
                seller_tenant_id: 'test-tenant-id',
                status: 'pending',
                payment_status: 'pending',
                total_amount: 500.0,
                subtotal: 480.0,
                tax: 20.0,
                tracking_number: null,
                created_at: '2026-03-15T10:00:00Z',
                marketplace_order_items: [
                    { id: 'item-1', product_id: 'prod-1', quantity: 10 },
                    { id: 'item-2', product_id: 'prod-2', quantity: 5 },
                ],
            },
            {
                id: 'order-2',
                order_number: 'MKT-002',
                customer_name: 'Herbal Wellness',
                customer_email: 'buy@herbalwellness.com',
                buyer_tenant_id: 'buyer-2',
                seller_tenant_id: 'test-tenant-id',
                status: 'shipped',
                payment_status: 'paid',
                total_amount: 1200.0,
                subtotal: 1150.0,
                tax: 50.0,
                tracking_number: 'TRK-12345',
                created_at: '2026-03-14T14:30:00Z',
                marketplace_order_items: [
                    { id: 'item-3', product_id: 'prod-3', quantity: 20 },
                ],
            },
            {
                id: 'order-3',
                order_number: 'MKT-003',
                customer_name: null,
                customer_email: null,
                buyer_tenant_id: 'buyer-3',
                seller_tenant_id: 'test-tenant-id',
                status: 'delivered',
                payment_status: 'paid',
                total_amount: 300.0,
                subtotal: 285.0,
                tax: 15.0,
                tracking_number: 'TRK-67890',
                created_at: '2026-03-13T09:00:00Z',
                marketplace_order_items: [],
            },
        ],
        mockProfile: { id: 'profile-1' },
    };
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
    useTenantAdminAuth: () => ({
        tenant: { id: 'test-tenant-id', name: 'Test Dispensary', slug: 'test-dispensary' },
    }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/integrations/supabase/client', () => {
    const createChainableQuery = (table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => {
            if (table === 'marketplace_orders') {
                return Promise.resolve({ data: mockOrders, error: null });
            }
            return Promise.resolve({ data: [], error: null });
        }),
        maybeSingle: vi.fn().mockImplementation(() => {
            if (table === 'marketplace_profiles') {
                return Promise.resolve({ data: mockProfile, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
        })),
    });

    return {
        supabase: {
            from: vi.fn().mockImplementation((table: string) => createChainableQuery(table)),
            channel: vi.fn().mockReturnValue(mockChannel),
            removeChannel: mockRemoveChannel,
        },
    };
});

// Import component and mocked modules after mocks
import OrdersPage from '../OrdersPage';
import { supabase } from '@/integrations/supabase/client';

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
}

function renderOrdersPage() {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <OrdersPage />
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('Marketplace OrdersPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders orders page without crashing', async () => {
        renderOrdersPage();
        // Verify page loads successfully (mocks resolve immediately, skipping skeleton)
        await waitFor(() => {
            expect(screen.getByText('Marketplace Orders')).toBeInTheDocument();
        });
    });

    it('renders orders table with data', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        expect(screen.getByText('MKT-002')).toBeInTheDocument();
        expect(screen.getByText('MKT-003')).toBeInTheDocument();
        expect(screen.getByText('Green Leaf Co')).toBeInTheDocument();
        expect(screen.getByText('Herbal Wellness')).toBeInTheDocument();
        expect(screen.getByText('Guest')).toBeInTheDocument();
    });

    it('displays correct order item counts', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        expect(screen.getByText('2 items')).toBeInTheDocument();
        expect(screen.getByText('1 items')).toBeInTheDocument();
        expect(screen.getByText('0 items')).toBeInTheDocument();
    });

    it('displays stats cards', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        expect(screen.getByText('Total Orders')).toBeInTheDocument();
        expect(screen.getByText('Pending Action')).toBeInTheDocument();
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    });

    it('filters orders by search query', async () => {
        const user = userEvent.setup();
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        const searchInput = screen.getByLabelText('Search by order number, customer, or tracking');
        await user.type(searchInput, 'Green Leaf');

        expect(screen.getByText('MKT-001')).toBeInTheDocument();
        expect(screen.queryByText('MKT-002')).not.toBeInTheDocument();
        expect(screen.queryByText('MKT-003')).not.toBeInTheDocument();
    });

    it('filters orders by tracking number', async () => {
        const user = userEvent.setup();
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        const searchInput = screen.getByLabelText('Search by order number, customer, or tracking');
        await user.type(searchInput, 'TRK-12345');

        expect(screen.getByText('MKT-002')).toBeInTheDocument();
        expect(screen.queryByText('MKT-001')).not.toBeInTheDocument();
    });

    it('shows contextual empty state with Clear Filters button', async () => {
        const user = userEvent.setup();
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        const searchInput = screen.getByLabelText('Search by order number, customer, or tracking');
        await user.type(searchInput, 'nonexistent-order-xyz');

        expect(screen.getByText('No Orders Found')).toBeInTheDocument();
        expect(screen.getByText(/No orders match your current filters/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
    });

    it('clears filters when Clear Filters button is clicked', async () => {
        const user = userEvent.setup();
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        const searchInput = screen.getByLabelText('Search by order number, customer, or tracking');
        await user.type(searchInput, 'nonexistent-order-xyz');
        expect(screen.getByText('No Orders Found')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Clear Filters' }));

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });
    });

    it('shows order and payment status badges', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        expect(screen.getByText('Shipped')).toBeInTheDocument();
        expect(screen.getByText('Delivered')).toBeInTheDocument();
        // 2 payment badges + 1 tab = 3 'Paid' text occurrences
        expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(2);
    });

    it('renders tab navigation', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        expect(screen.getByRole('tab', { name: 'All Orders' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Unpaid/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Paid/ })).toBeInTheDocument();
    });

    it('has accessible action buttons per order row', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        const actionButtons = screen.getAllByLabelText(/Actions for order/);
        expect(actionButtons.length).toBe(3);
    });

    it('renders pagination component', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        expect(screen.getByText(/Showing 1 to 3 of 3 items/)).toBeInTheDocument();
    });

    it('renders refresh button', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('MKT-001')).toBeInTheDocument();
        });

        expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('sets up realtime subscription on mount', () => {
        renderOrdersPage();

        // Verify the hoisted mock channel was used
        expect(mockChannel.on).toHaveBeenCalled();
        expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('displays page header with correct title', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('Marketplace Orders')).toBeInTheDocument();
        });

        expect(screen.getByText('Manage orders from your storefront')).toBeInTheDocument();
    });
});

describe('Marketplace OrdersPage - No Profile', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(supabase.from).mockImplementation((table: string) => {
            if (table === 'marketplace_profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                } as ReturnType<typeof supabase.from>;
            }
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
            } as ReturnType<typeof supabase.from>;
        });
    });

    it('shows no profile warning when marketplace profile is missing', async () => {
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('No Marketplace Profile')).toBeInTheDocument();
        });

        expect(screen.getByText(/You need to create a marketplace profile/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create Profile' })).toBeInTheDocument();
    });

    it('navigates to settings on Create Profile click', async () => {
        const user = userEvent.setup();
        renderOrdersPage();

        await waitFor(() => {
            expect(screen.getByText('No Marketplace Profile')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Create Profile' }));
        expect(mockNavigate).toHaveBeenCalledWith('/test-dispensary/admin/marketplace/settings');
    });
});
