/**
 * RouteOptimizer Credit Gate Tests
 *
 * Verifies that route optimization is gated behind useCreditGatedAction:
 * 1. Button shows "50 Credits" cost
 * 2. Clicking Optimize calls executeCreditAction with 'route_optimize'
 * 3. Insufficient credits shows OutOfCreditsModal
 * 4. Button is disabled while credit action is performing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Track mock calls
const mockExecute = vi.fn();
const mockUseCreditGatedAction = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: (...args: unknown[]) => mockUseCreditGatedAction(...args),
  useCredits: () => ({
    balance: 100,
    isFreeTier: true,
    lifetimeSpent: 0,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) =>
    open ? <div data-testid="out-of-credits-modal">Out of Credits - {actionAttempted}</div> : null,
}));

// Mock Mapbox and map components
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));
vi.mock('react-map-gl/mapbox', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: () => null,
  Source: () => null,
  Layer: () => null,
  NavigationControl: () => null,
}));

vi.mock('@/components/ui/address-autocomplete', () => ({
  AddressAutocomplete: ({ placeholder }: { placeholder: string }) => (
    <input placeholder={placeholder} />
  ),
}));

vi.mock('framer-motion', () => ({
  Reorder: {
    Group: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  useDragControls: () => ({ start: vi.fn() }),
}));

vi.mock('@/components/admin/routing/AssignRouteDialog', () => ({
  AssignRouteDialog: () => null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) => (
    <div data-testid="empty-state">
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

// Import after mocks are set up (vi.mock is hoisted)
import { RouteOptimizer } from '../RouteOptimizer';

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteOptimizer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('RouteOptimizer Credit Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      (_actionKey: string, action: () => Promise<unknown>) => action()
    );
    mockUseCreditGatedAction.mockReturnValue({
      execute: mockExecute,
      isPerforming: false,
      isFreeTier: true,
    });
  });

  it('should display "Optimize (50 Credits)" on the button', () => {
    renderComponent();

    const button = screen.getByRole('button', { name: /optimize/i });
    expect(button).toHaveTextContent('Optimize (50 Credits)');
  });

  it('should disable button when fewer than 2 stops', () => {
    renderComponent();

    const button = screen.getByRole('button', { name: /optimize/i });
    expect(button).toBeDisabled();
  });

  it('should call executeCreditAction with route_optimize action key', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Add 2 stops (use the first "Add Stop" button which is in the header)
    const addButtons = screen.getAllByRole('button', { name: /add stop/i });
    await user.click(addButtons[0]);
    await user.click(addButtons[0]);

    // Click optimize
    const optimizeButton = screen.getByRole('button', { name: /optimize/i });
    await user.click(optimizeButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'route_optimize',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should show OutOfCreditsModal when credits are insufficient', async () => {
    const user = userEvent.setup();

    // Override execute to trigger insufficient credits callback
    mockExecute.mockImplementation(
      (_actionKey: string, _action: () => Promise<unknown>, options?: { onInsufficientCredits?: () => void }) => {
        options?.onInsufficientCredits?.();
        return Promise.resolve(null);
      }
    );

    renderComponent();

    // Add 2 stops
    const addButtons = screen.getAllByRole('button', { name: /add stop/i });
    await user.click(addButtons[0]);
    await user.click(addButtons[0]);

    // Click optimize
    const optimizeButton = screen.getByRole('button', { name: /optimize/i });
    await user.click(optimizeButton);

    await waitFor(() => {
      expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
      expect(screen.getByTestId('out-of-credits-modal')).toHaveTextContent('route_optimize');
    });
  });

  it('should show "Optimizing..." and disable button while performing', () => {
    mockUseCreditGatedAction.mockReturnValue({
      execute: mockExecute,
      isPerforming: true,
      isFreeTier: true,
    });

    renderComponent();

    const button = screen.getByRole('button', { name: /optimizing/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Optimizing...');
  });

  it('should not call executeCreditAction with fewer than 2 stops', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Add only 1 stop
    const addButtons = screen.getAllByRole('button', { name: /add stop/i });
    await user.click(addButtons[0]);

    // Optimize button should be disabled
    const optimizeButton = screen.getByRole('button', { name: /optimize/i });
    expect(optimizeButton).toBeDisabled();

    expect(mockExecute).not.toHaveBeenCalled();
  });
});
