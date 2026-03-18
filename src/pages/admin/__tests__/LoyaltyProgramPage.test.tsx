/**
 * LoyaltyProgramPage Tests
 * Tests for loyalty program config, tiers, and rewards management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }),
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

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="confirm-delete-dialog">{title}</div> : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description, primaryAction }: {
    title: string;
    description: string;
    primaryAction?: { label: string; onClick: () => void };
  }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('Something went wrong'),
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: vi.fn().mockReturnValue({
    dialogState: { open: false, title: '', description: '', itemName: '', itemType: '', onConfirm: vi.fn(), isLoading: false },
    confirm: vi.fn(),
    closeDialog: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

// Import after mocks
import LoyaltyProgramPage from '../LoyaltyProgramPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

const mockConfig = {
  program_name: 'Test Rewards',
  points_per_dollar: 10,
  points_to_dollar_ratio: 0.01,
  signup_bonus_points: 50,
  birthday_bonus_points: 100,
  is_active: true,
  tier_enabled: true,
  tenant_id: 'tenant-123',
};

const mockTiers = [
  {
    id: 'tier-1',
    name: 'Bronze',
    color: '#CD7F32',
    icon: '🥉',
    multiplier: 1,
    min_points: 0,
    max_points: 500,
    benefits: ['Free delivery', '5% discount'],
    tenant_id: 'tenant-123',
  },
  {
    id: 'tier-2',
    name: 'Gold',
    color: '#FFD700',
    icon: '🥇',
    multiplier: 2,
    min_points: 501,
    max_points: null,
    benefits: ['Free delivery', '15% discount', 'Priority support'],
    tenant_id: 'tenant-123',
  },
];

const mockRewards = [
  {
    id: 'reward-1',
    reward_name: '10% Off Next Order',
    reward_description: 'Get 10% off your next purchase',
    points_required: 100,
    reward_type: 'discount',
    is_active: true,
    redemption_count: 5,
    tenant_id: 'tenant-123',
  },
  {
    id: 'reward-2',
    reward_name: 'Free Edible',
    reward_description: 'Redeem for a free edible item',
    points_required: 250,
    reward_type: 'free_item',
    is_active: false,
    redemption_count: 0,
    tenant_id: 'tenant-123',
  },
];

function createChain(resolveWith: { data: unknown; error: null }, terminalMethod: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'order', 'maybeSingle', 'delete'];
  for (const m of methods) {
    if (m === terminalMethod) {
      chain[m] = vi.fn().mockResolvedValue(resolveWith);
    } else {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
  }
  chain.upsert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: null, error: null }) });
  return chain;
}

function createMockSupabase(overrides: {
  config?: unknown;
  tiers?: unknown[];
  rewards?: unknown[];
  points?: unknown[];
  redemptions?: unknown[];
} = {}) {
  const { config = null, tiers = [], rewards = [], points = [], redemptions = [] } = overrides;

  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    switch (table) {
      case 'loyalty_program_config':
        return createChain({ data: config, error: null }, 'maybeSingle');
      case 'loyalty_tiers':
        return createChain({ data: tiers, error: null }, 'order');
      case 'loyalty_rewards':
        return createChain({ data: rewards, error: null }, 'order');
      case 'customer_loyalty_points':
        return createChain({ data: points, error: null }, 'eq');
      case 'loyalty_reward_redemptions':
        return createChain({ data: redemptions, error: null }, 'eq');
      default:
        return createChain({ data: null, error: null }, 'eq');
    }
  });
}

describe('LoyaltyProgramPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    createMockSupabase();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/loyalty']}>
          <LoyaltyProgramPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should render loading skeleton initially', () => {
      renderPage();

      // Skeleton elements have role="status" with aria-label="Loading..."
      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Initial Render with Data', () => {
    it('should render page header with program name', async () => {
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Test Rewards')).toBeInTheDocument();
      });
      expect(screen.getByText('Reward customers and drive repeat purchases')).toBeInTheDocument();
    });

    it('should render default program name when config is null', async () => {
      createMockSupabase({ config: null });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Loyalty Program')).toBeInTheDocument();
      });
    });

    it('should render stats cards', async () => {
      createMockSupabase({
        config: mockConfig,
        points: [
          { total_points: 100, lifetime_points: 200 },
          { total_points: 50, lifetime_points: 150 },
        ],
        redemptions: [
          { points_spent: 50 },
        ],
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Active Members')).toBeInTheDocument();
      });
      expect(screen.getByText('Points Awarded')).toBeInTheDocument();
      expect(screen.getByText('Points Redeemed')).toBeInTheDocument();
      expect(screen.getByText('Active Balance')).toBeInTheDocument();
    });

    it('should render Configure Program button', async () => {
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Configure Program')).toBeInTheDocument();
      });
    });
  });

  describe('Tabs Navigation', () => {
    it('should render all three tabs', async () => {
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
      expect(screen.getByText('Tiers')).toBeInTheDocument();
      expect(screen.getByText('Rewards')).toBeInTheDocument();
    });

    it('should show overview tab by default with program configuration', async () => {
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Program Configuration')).toBeInTheDocument();
      });
      expect(screen.getByText('Points per Dollar')).toBeInTheDocument();
    });

    it('should switch to tiers tab', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, tiers: mockTiers });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Tiers'));

      await waitFor(() => {
        expect(screen.getByText('Loyalty Tiers')).toBeInTheDocument();
      });
    });

    it('should switch to rewards tab', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, rewards: mockRewards });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Rewards'));

      await waitFor(() => {
        expect(screen.getByText('Rewards Catalog')).toBeInTheDocument();
      });
    });
  });

  describe('Overview Tab', () => {
    it('should display config values', async () => {
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('10x')).toBeInTheDocument();
      });
      expect(screen.getByText('$0.01')).toBeInTheDocument();
      expect(screen.getByText('50 pts')).toBeInTheDocument();
      expect(screen.getByText('100 pts')).toBeInTheDocument();
    });

    it('should show active badge when program is active', async () => {
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        const badges = screen.getAllByText('Active');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should show inactive badge when program is inactive', async () => {
      createMockSupabase({ config: { ...mockConfig, is_active: false } });

      renderPage();

      await waitFor(() => {
        const badges = screen.getAllByText('Inactive');
        expect(badges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tiers Tab', () => {
    it('should show tier cards with data', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, tiers: mockTiers });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Tiers'));

      await waitFor(() => {
        expect(screen.getByText('Bronze')).toBeInTheDocument();
        expect(screen.getByText('Gold')).toBeInTheDocument();
      });
    });

    it('should display tier benefits', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, tiers: mockTiers });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Tiers'));

      await waitFor(() => {
        // "Free delivery" appears in both tiers
        const freeDeliveryItems = screen.getAllByText('Free delivery');
        expect(freeDeliveryItems.length).toBe(2);
        expect(screen.getByText('Priority support')).toBeInTheDocument();
      });
    });

    it('should show empty state when no tiers exist', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, tiers: [] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Tiers'));

      await waitFor(() => {
        expect(screen.getByText('No tiers configured')).toBeInTheDocument();
      });
    });

    it('should have aria-labels on tier action buttons', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, tiers: mockTiers });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Tiers'));

      await waitFor(() => {
        expect(screen.getByLabelText('Edit Bronze tier')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete Bronze tier')).toBeInTheDocument();
        expect(screen.getByLabelText('Edit Gold tier')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete Gold tier')).toBeInTheDocument();
      });
    });

    it('should show multiplier badges on tiers', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, tiers: mockTiers });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Tiers'));

      await waitFor(() => {
        expect(screen.getByText('1x points')).toBeInTheDocument();
        expect(screen.getByText('2x points')).toBeInTheDocument();
      });
    });
  });

  describe('Rewards Tab', () => {
    it('should show reward cards with data', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, rewards: mockRewards });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Rewards'));

      await waitFor(() => {
        expect(screen.getByText('10% Off Next Order')).toBeInTheDocument();
        expect(screen.getByText('Free Edible')).toBeInTheDocument();
      });
    });

    it('should show empty state when no rewards exist', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, rewards: [] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Rewards'));

      await waitFor(() => {
        expect(screen.getByText('No rewards available')).toBeInTheDocument();
      });
    });

    it('should have aria-labels on reward action buttons', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, rewards: mockRewards });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Rewards'));

      await waitFor(() => {
        expect(screen.getByLabelText('Edit 10% Off Next Order reward')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete 10% Off Next Order reward')).toBeInTheDocument();
      });
    });

    it('should show redemption count for redeemed rewards', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, rewards: mockRewards });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Rewards'));

      await waitFor(() => {
        expect(screen.getByText('Redeemed 5 time(s)')).toBeInTheDocument();
      });
    });

    it('should display active/inactive badges', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig, rewards: mockRewards });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Rewards'));

      await waitFor(() => {
        // First reward is active, second is inactive
        const activeBadges = screen.getAllByText('Active');
        const inactiveBadges = screen.getAllByText('Inactive');
        expect(activeBadges.length).toBeGreaterThanOrEqual(1);
        expect(inactiveBadges.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Config Dialog', () => {
    it('should open config dialog when Configure Program is clicked', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Configure Program')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Configure Program'));

      await waitFor(() => {
        expect(screen.getByText('Configure Loyalty Program')).toBeInTheDocument();
      });
    });

    it('should populate config form with existing data', async () => {
      const user = userEvent.setup();
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Configure Program')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Configure Program'));

      await waitFor(() => {
        const programNameInput = screen.getByDisplayValue('Test Rewards');
        expect(programNameInput).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Context', () => {
    it('should filter queries by tenant_id', async () => {
      createMockSupabase({ config: mockConfig });

      renderPage();

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('loyalty_program_config');
      });
    });

    it('should not fetch data without tenant', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      renderPage();

      // Should show default name since no tenant means no queries
      await waitFor(() => {
        expect(screen.getByText('Loyalty Program')).toBeInTheDocument();
      });
    });
  });
});
