/**
 * PricingTiersPage Tests
 * Tests for pricing tier CRUD, form validation, loading/error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        from: (...args: unknown[]) => {
            mockFrom(...args);
            return {
                select: (...sArgs: unknown[]) => {
                    mockSelect(...sArgs);
                    return {
                        eq: (...eArgs: unknown[]) => {
                            mockEq(...eArgs);
                            return {
                                maybeSingle: () => mockMaybeSingle(),
                            };
                        },
                    };
                },
                update: (...uArgs: unknown[]) => {
                    mockUpdate(...uArgs);
                    return {
                        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                    };
                },
            };
        },
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

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@/contexts/ThemeContext', () => ({
    ThemeProvider: ({ children }: { children: ReactNode }) => children,
    useTheme: vi.fn().mockReturnValue({
        theme: 'light',
        toggleTheme: vi.fn(),
    }),
}));

// Import after mocks
import PricingTiersPage from '../wholesale/PricingTiersPage';

const mockTiers = [
    {
        id: 'tier-bronze',
        name: 'Bronze',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        discount_percentage: 0,
        min_order_amount: 0,
        description: 'Standard pricing',
        active: true,
    },
    {
        id: 'tier-silver',
        name: 'Silver',
        color: 'bg-slate-100 text-slate-800 border-slate-200',
        discount_percentage: 5,
        min_order_amount: 1000,
        description: '5% discount for orders over $1,000',
        active: true,
    },
    {
        id: 'tier-gold',
        name: 'Gold',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        discount_percentage: 10,
        min_order_amount: 5000,
        description: '10% discount',
        active: false,
    },
];

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false, retryDelay: 0 },
        },
    });

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/test-tenant/admin/wholesale/pricing']}>
            {children}
        </MemoryRouter>
    </QueryClientProvider>
);

describe('PricingTiersPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMaybeSingle.mockResolvedValue({
            data: {
                integration_settings: {
                    wholesale_pricing_tiers: { tiers: mockTiers },
                },
            },
            error: null,
        });
    });

    describe('Page Header', () => {
        it('should render page title', async () => {
            render(<PricingTiersPage />, { wrapper });
            expect(screen.getByText('Pricing Tiers')).toBeInTheDocument();
        });

        it('should render page description', async () => {
            render(<PricingTiersPage />, { wrapper });
            expect(screen.getByText('Manage wholesale pricing tiers, discounts, and order minimums.')).toBeInTheDocument();
        });

        it('should render Add Tier button', async () => {
            render(<PricingTiersPage />, { wrapper });
            expect(screen.getByRole('button', { name: /add tier/i })).toBeInTheDocument();
        });
    });

    describe('Tier Cards', () => {
        it('should display all tiers from the query', async () => {
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
                expect(screen.getByText('Silver')).toBeInTheDocument();
                expect(screen.getByText('Gold')).toBeInTheDocument();
            });
        });

        it('should display discount percentages', async () => {
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('0%')).toBeInTheDocument();
                expect(screen.getByText('5%')).toBeInTheDocument();
                expect(screen.getByText('10%')).toBeInTheDocument();
            });
        });

        it('should display minimum order amounts', async () => {
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('$0')).toBeInTheDocument();
                expect(screen.getByText('$1,000')).toBeInTheDocument();
                expect(screen.getByText('$5,000')).toBeInTheDocument();
            });
        });

        it('should show active/inactive status', async () => {
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                // Two active (Bronze, Silver), one inactive (Gold)
                const activeLabels = screen.getAllByText('Active');
                const inactiveLabels = screen.getAllByText('Inactive');
                expect(activeLabels).toHaveLength(2);
                expect(inactiveLabels).toHaveLength(1);
            });
        });

        it('should render Create New Tier card', async () => {
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Create New Tier')).toBeInTheDocument();
            });
        });
    });

    describe('Loading State', () => {
        it('should show skeleton cards while loading', () => {
            // Make the query hang by never resolving
            mockMaybeSingle.mockReturnValue(new Promise(() => {}));

            render(<PricingTiersPage />, { wrapper });

            const skeletons = screen.getAllByLabelText('Loading card...');
            expect(skeletons.length).toBe(3);
        });
    });

    describe('Error State', () => {
        it('should display error message when query fails', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            mockMaybeSingle.mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' },
            });

            render(<PricingTiersPage />, { wrapper });

            // Advance past retry delays (retry: 2 = 3 total attempts)
            await vi.advanceTimersByTimeAsync(10000);

            await waitFor(() => {
                expect(screen.getByText('Failed to load pricing tiers')).toBeInTheDocument();
            });

            vi.useRealTimers();
        });

        it('should display Try Again button on error', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            mockMaybeSingle.mockResolvedValue({
                data: null,
                error: { message: 'Network error' },
            });

            render(<PricingTiersPage />, { wrapper });

            // Advance past retry delays
            await vi.advanceTimersByTimeAsync(10000);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
            });

            vi.useRealTimers();
        });
    });

    describe('Add Tier Dialog', () => {
        it('should open dialog when Add Tier button is clicked', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /add tier/i }));

            expect(screen.getByText('New Pricing Tier')).toBeInTheDocument();
        });

        it('should render all form fields', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /add tier/i }));

            expect(screen.getByLabelText('Tier Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Discount Percentage')).toBeInTheDocument();
            expect(screen.getByLabelText('Minimum Order ($)')).toBeInTheDocument();
            expect(screen.getByLabelText('Description')).toBeInTheDocument();
            expect(screen.getByLabelText('Active')).toBeInTheDocument();
        });

        it('should render color picker with options', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /add tier/i }));

            // Color options should be visible
            expect(screen.getByText('Tier Color')).toBeInTheDocument();
        });

        it('should show validation errors for empty name', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /add tier/i }));

            // Submit without filling name
            await user.click(screen.getByRole('button', { name: /save tier/i }));

            await waitFor(() => {
                expect(screen.getByText('Tier name is required')).toBeInTheDocument();
            });
        });
    });

    describe('Edit Tier', () => {
        it('should open edit dialog with pre-filled values', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            // Open the first tier's actions menu
            const actionButtons = screen.getAllByRole('button', { name: /actions for/i });
            await user.click(actionButtons[0]);

            // Click Edit
            await user.click(await screen.findByText('Edit'));

            // Dialog should show "Edit Tier"
            expect(screen.getByText('Edit Tier')).toBeInTheDocument();

            // Form should be pre-filled
            const nameInput = screen.getByLabelText('Tier Name') as HTMLInputElement;
            expect(nameInput.value).toBe('Bronze');
        });
    });

    describe('Dropdown Menu Actions', () => {
        it('should show Edit, Activate/Deactivate, and Delete actions', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            // Open the first tier's actions menu (active tier = shows Deactivate)
            const actionButtons = screen.getAllByRole('button', { name: /actions for/i });
            await user.click(actionButtons[0]);

            expect(await screen.findByText('Edit')).toBeInTheDocument();
            expect(screen.getByText('Deactivate')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });

        it('should show Activate for inactive tiers', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Gold')).toBeInTheDocument();
            });

            // Open Gold tier's actions menu (inactive tier = shows Activate)
            const actionButtons = screen.getAllByRole('button', { name: /actions for gold/i });
            await user.click(actionButtons[0]);

            expect(await screen.findByText('Activate')).toBeInTheDocument();
        });
    });

    describe('Delete Tier', () => {
        it('should open confirmation dialog when Delete is clicked', async () => {
            const user = userEvent.setup();
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            // Open the first tier's actions menu
            const actionButtons = screen.getAllByRole('button', { name: /actions for/i });
            await user.click(actionButtons[0]);

            // Click Delete
            await user.click(await screen.findByText('Delete'));

            // Confirmation dialog should appear
            await waitFor(() => {
                expect(screen.getByText('Delete Pricing Tier')).toBeInTheDocument();
            });
        });
    });

    describe('Data Path Alignment', () => {
        it('should read tiers from wholesale_pricing_tiers.tiers path', async () => {
            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            // Verify it called the correct table
            expect(mockFrom).toHaveBeenCalledWith('account_settings');
            expect(mockSelect).toHaveBeenCalledWith('integration_settings');
            expect(mockEq).toHaveBeenCalledWith('account_id', 'tenant-123');
        });

        it('should save tiers to wholesale_pricing_tiers.tiers path', async () => {
            const user = userEvent.setup();

            // Reset mock for the save call
            mockMaybeSingle.mockResolvedValue({
                data: {
                    integration_settings: {
                        wholesale_pricing_tiers: { tiers: mockTiers },
                        other_setting: 'preserved',
                    },
                },
                error: null,
            });

            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
            });

            // Open add dialog and fill in form
            await user.click(screen.getByRole('button', { name: /add tier/i }));

            const nameInput = screen.getByLabelText('Tier Name');
            await user.type(nameInput, 'Platinum');

            await user.click(screen.getByRole('button', { name: /save tier/i }));

            // Verify the update was called with correct structure
            await waitFor(() => {
                expect(mockUpdate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        integration_settings: expect.objectContaining({
                            other_setting: 'preserved',
                            wholesale_pricing_tiers: expect.objectContaining({
                                tiers: expect.any(Array),
                            }),
                        }),
                    })
                );
            });
        });
    });

    describe('Default Tiers', () => {
        it('should show default tiers when no tiers are saved', async () => {
            mockMaybeSingle.mockResolvedValue({
                data: { integration_settings: {} },
                error: null,
            });

            render(<PricingTiersPage />, { wrapper });

            await waitFor(() => {
                expect(screen.getByText('Bronze')).toBeInTheDocument();
                expect(screen.getByText('Silver')).toBeInTheDocument();
                expect(screen.getByText('Gold')).toBeInTheDocument();
            });
        });
    });
});
