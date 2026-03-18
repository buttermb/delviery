import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
    loading: false,
  }),
}));

// Mock child components to isolate page logic
vi.mock('@/components/admin/marketing/CampaignBuilder', () => ({
  CampaignBuilder: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="campaign-builder">
      <button onClick={onClose}>Close Builder</button>
    </div>
  ),
}));

vi.mock('@/components/admin/marketing/WorkflowEditor', () => ({
  WorkflowEditor: () => <div data-testid="workflow-editor">Workflow Editor</div>,
}));

vi.mock('@/components/admin/marketing/CampaignAnalytics', () => ({
  CampaignAnalytics: ({ campaigns }: { campaigns: unknown[] }) => (
    <div data-testid="campaign-analytics">Analytics: {campaigns.length} campaigns</div>
  ),
}));

import MarketingAutomationPage from '../MarketingAutomationPage';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MarketingAutomationPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

function makeChainable(resolvedData: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const resolve = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = resolve;
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  return chain;
}

function setupSupabaseMock(campaigns: unknown[] = []) {
  mockFrom.mockReturnValue(makeChainable(campaigns));
}

describe('MarketingAutomationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('should render the page header', async () => {
    renderPage();

    expect(screen.getByText('Marketing Automation')).toBeInTheDocument();
    expect(screen.getByText(/Create campaigns, automate workflows/)).toBeInTheDocument();
  });

  it('should render tab navigation with Campaigns, Workflows, Analytics', () => {
    renderPage();

    expect(screen.getByRole('tab', { name: /Campaigns/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Workflows/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Analytics/ })).toBeInTheDocument();
  });

  it('should show campaigns tab by default', () => {
    renderPage();

    expect(screen.getByText('Email & SMS Campaigns')).toBeInTheDocument();
  });

  it('should show empty state when no campaigns exist', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No Campaigns Found')).toBeInTheDocument();
    });
  });

  it('should render campaigns when data is returned', async () => {
    setupSupabaseMock([
      {
        id: 'c-1',
        name: 'Summer Sale',
        type: 'email',
        status: 'draft',
        subject: 'Big Deals!',
        content: 'Hello',
        audience: 'all',
        scheduled_at: null,
        sent_count: 0,
        opened_count: 0,
        clicked_count: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Summer Sale').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should open create campaign dialog when New Campaign button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const newBtn = screen.getByRole('button', { name: /New Campaign/ });
    await user.click(newBtn);

    expect(screen.getByTestId('campaign-builder')).toBeInTheDocument();
  });

  it('should switch to workflows tab', async () => {
    const user = userEvent.setup();
    renderPage();

    const workflowsTab = screen.getByRole('tab', { name: /Workflows/ });
    await user.click(workflowsTab);

    expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();
  });

  it('should switch to analytics tab and pass campaigns', async () => {
    const user = userEvent.setup();
    renderPage();

    const analyticsTab = screen.getByRole('tab', { name: /Analytics/ });
    await user.click(analyticsTab);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-analytics')).toBeInTheDocument();
    });
  });

  it('should filter campaigns by search query', async () => {
    setupSupabaseMock([
      {
        id: 'c-1',
        name: 'Summer Sale',
        type: 'email',
        status: 'draft',
        subject: null,
        content: '',
        audience: 'all',
        scheduled_at: null,
        sent_count: 0,
        opened_count: 0,
        clicked_count: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c-2',
        name: 'Winter Promo',
        type: 'sms',
        status: 'sent',
        subject: null,
        content: '',
        audience: 'all',
        scheduled_at: null,
        sent_count: 50,
        opened_count: 0,
        clicked_count: 0,
        created_at: '2026-01-02T00:00:00Z',
      },
    ]);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Summer Sale').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Winter Promo').length).toBeGreaterThanOrEqual(1);
    });

    // Type in the search input
    const searchInput = screen.getByPlaceholderText('Search campaigns...');
    await user.type(searchInput, 'Winter');

    await waitFor(() => {
      expect(screen.queryByText('Summer Sale')).not.toBeInTheDocument();
      expect(screen.getAllByText('Winter Promo').length).toBeGreaterThanOrEqual(1);
    });
  });
});
