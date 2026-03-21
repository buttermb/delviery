/**
 * SelectPlanPage Loading State Tests
 *
 * Verifies:
 * - Initial loading spinner displays while checking auth and loading plans
 * - Button spinners display during plan selection
 * - Loading text content is correct
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams('tenant_id=test-tenant-123');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
    useLocation: () => ({ state: null, pathname: '/select-plan' }),
  };
});

const mockGetSession = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/components/marketing/ForceLightMode', () => ({
  ForceLightMode: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/FloraIQLogo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

// Import AFTER mocks
import SelectPlanPage from '../../saas/SelectPlanPage';

describe('SelectPlanPage Loading States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading spinner during initial auth check', () => {
    // Make getSession hang so we stay in loading state
    mockGetSession.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(
      <MemoryRouter>
        <SelectPlanPage />
      </MemoryRouter>
    );

    // Should show spinner via animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Should show loading text
    expect(screen.getByText('Loading plans...')).toBeInTheDocument();
  });

  it('should show plan cards after auth check completes', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
    });

    render(
      <MemoryRouter>
        <SelectPlanPage />
      </MemoryRouter>
    );

    // After auth resolves, should show plan selection UI
    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    // Should no longer show loading spinner text
    expect(screen.queryByText('Loading plans...')).not.toBeInTheDocument();
  });

  it('should show button spinner when selecting a plan', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
    });

    // Make the invoke call hang to keep the button in loading state
    mockInvoke.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(
      <MemoryRouter>
        <SelectPlanPage />
      </MemoryRouter>
    );

    // Wait for plans to load
    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    // Click a plan button
    const trialButtons = screen.getAllByText('Start 14-Day Free Trial');
    fireEvent.click(trialButtons[0]);

    // Should show processing spinner on the clicked button
    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      const spinner = document.querySelector('button .animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('should show button spinner when selecting free tier', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
    });

    // Make the invoke call hang
    mockInvoke.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(
      <MemoryRouter>
        <SelectPlanPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    // Click the free tier button
    const freeButton = screen.getByRole('button', { name: /Start Free/i });
    fireEvent.click(freeButton);

    // Should show processing spinner
    await waitFor(() => {
      expect(screen.getByText('Setting up...')).toBeInTheDocument();
      const spinner = document.querySelector('button .animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('should disable all buttons when any plan is loading', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
    });

    mockInvoke.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(
      <MemoryRouter>
        <SelectPlanPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    });

    // Click one plan button
    const trialButtons = screen.getAllByText('Start 14-Day Free Trial');
    fireEvent.click(trialButtons[0]);

    // All plan buttons should be disabled
    await waitFor(() => {
      const allButtons = screen.getAllByRole('button');
      const planButtons = allButtons.filter(
        (btn) => btn.textContent?.includes('Trial') ||
                 btn.textContent?.includes('Free') ||
                 btn.textContent?.includes('Processing')
      );
      planButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });
});
