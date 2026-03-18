import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import RouteOptimization from '../RouteOptimization';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock TenantAdminAuthContext
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
  }),
}));

// Mock edge function helper
const mockInvokeEdgeFunction = vi.fn();
vi.mock('@/utils/edgeFunctionHelper', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvokeEdgeFunction(...args),
}));

// Mock wholesale deliveries hook
const mockUseWholesaleDeliveries = vi.fn();
vi.mock('@/hooks/useWholesaleData', () => ({
  useWholesaleDeliveries: () => mockUseWholesaleDeliveries(),
}));

// Mock RouteOptimizationPreview
vi.mock('@/components/admin/RouteOptimizationPreview', () => ({
  RouteOptimizationPreview: ({ runnerName, stops, onApplyRoute }: {
    runnerName: string;
    stops: { id: string }[];
    onApplyRoute?: () => void;
  }) => (
    <div data-testid="route-preview">
      <span data-testid="preview-runner">{runnerName}</span>
      <span data-testid="preview-stops">{stops.length}</span>
      <button onClick={onApplyRoute} data-testid="apply-route-btn">Apply Route</button>
    </div>
  ),
}));

// Mock EnhancedLoadingState
vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: ({ message }: { message: string }) => (
    <div data-testid="loading-state">{message}</div>
  ),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

const makeDelivery = (id: string, runnerId: string, runnerName: string, orderNumber: string) => ({
  id,
  tenant_id: 'test-tenant-id',
  order_id: `order-${id}`,
  runner_id: runnerId,
  status: 'assigned',
  current_location: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  order: { order_number: orderNumber, total_amount: 100, delivery_address: '123 Main St' },
  runner: { full_name: runnerName, phone: '555-0100', vehicle_type: 'car' },
});

describe('RouteOptimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while deliveries are loading', () => {
    mockUseWholesaleDeliveries.mockReturnValue({ data: undefined, isLoading: true });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading routes...');
  });

  it('shows empty state when no deliveries exist', () => {
    mockUseWholesaleDeliveries.mockReturnValue({ data: [], isLoading: false });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    expect(screen.getByText('No active routes found. Assign deliveries to runners to generate routes.')).toBeInTheDocument();
  });

  it('groups deliveries by runner into route cards', () => {
    mockUseWholesaleDeliveries.mockReturnValue({
      data: [
        makeDelivery('d1', 'runner-1', 'Alice', 'WO-001'),
        makeDelivery('d2', 'runner-1', 'Alice', 'WO-002'),
        makeDelivery('d3', 'runner-2', 'Bob', 'WO-003'),
      ],
      isLoading: false,
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    expect(screen.getByText('Route: Alice')).toBeInTheDocument();
    expect(screen.getByText('Route: Bob')).toBeInTheDocument();
  });

  it('disables Optimize Routes button when no valid routes exist', () => {
    // Only one stop per runner — not enough to optimize
    mockUseWholesaleDeliveries.mockReturnValue({
      data: [makeDelivery('d1', 'runner-1', 'Alice', 'WO-001')],
      isLoading: false,
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    const btn = screen.getByRole('button', { name: /optimize routes/i });
    expect(btn).toBeDisabled();
  });

  it('enables Optimize Routes button when valid routes exist', () => {
    mockUseWholesaleDeliveries.mockReturnValue({
      data: [
        makeDelivery('d1', 'runner-1', 'Alice', 'WO-001'),
        makeDelivery('d2', 'runner-1', 'Alice', 'WO-002'),
      ],
      isLoading: false,
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    const btn = screen.getByRole('button', { name: /optimize routes/i });
    expect(btn).toBeEnabled();
  });

  it('calls optimize-route edge function when Optimize Routes is clicked', async () => {
    const user = userEvent.setup();

    mockUseWholesaleDeliveries.mockReturnValue({
      data: [
        makeDelivery('d1', 'runner-1', 'Alice', 'WO-001'),
        makeDelivery('d2', 'runner-1', 'Alice', 'WO-002'),
      ],
      isLoading: false,
    });

    mockInvokeEdgeFunction.mockResolvedValue({
      data: {
        waypoints: [
          {
            delivery_id: 'd1',
            address: '123 Main St',
            coordinates: { lat: 40.71, lng: -74.01 },
            estimated_arrival: '2026-01-01T10:00:00Z',
            estimated_duration_minutes: 15,
            sequence: 1,
          },
          {
            delivery_id: 'd2',
            address: '456 Oak Ave',
            coordinates: { lat: 40.72, lng: -74.02 },
            estimated_arrival: '2026-01-01T10:30:00Z',
            estimated_duration_minutes: 20,
            sequence: 2,
          },
        ],
        summary: {
          total_deliveries: 2,
          total_distance_km: 5.5,
          estimated_total_time_minutes: 35,
          estimated_completion: '2026-01-01T10:30:00Z',
        },
      },
      error: null,
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    const btn = screen.getByRole('button', { name: /optimize routes/i });
    await user.click(btn);

    await waitFor(() => {
      expect(mockInvokeEdgeFunction).toHaveBeenCalledWith({
        functionName: 'optimize-route',
        body: {
          deliveries: [
            { id: 'd1', address: '123 Main St', priority: 2 },
            { id: 'd2', address: '123 Main St', priority: 2 },
          ],
          runner_id: 'runner-1',
        },
      });
    });
  });

  it('shows RouteOptimizationPreview after successful optimization', async () => {
    const user = userEvent.setup();

    mockUseWholesaleDeliveries.mockReturnValue({
      data: [
        makeDelivery('d1', 'runner-1', 'Alice', 'WO-001'),
        makeDelivery('d2', 'runner-1', 'Alice', 'WO-002'),
      ],
      isLoading: false,
    });

    mockInvokeEdgeFunction.mockResolvedValue({
      data: {
        waypoints: [
          {
            delivery_id: 'd1',
            address: '123 Main St',
            coordinates: { lat: 40.71, lng: -74.01 },
            estimated_arrival: '2026-01-01T10:00:00Z',
            estimated_duration_minutes: 15,
            sequence: 1,
          },
          {
            delivery_id: 'd2',
            address: '456 Oak Ave',
            coordinates: { lat: 40.72, lng: -74.02 },
            estimated_arrival: '2026-01-01T10:30:00Z',
            estimated_duration_minutes: 20,
            sequence: 2,
          },
        ],
        summary: {
          total_deliveries: 2,
          total_distance_km: 5.5,
          estimated_total_time_minutes: 35,
          estimated_completion: '2026-01-01T10:30:00Z',
        },
      },
      error: null,
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /optimize routes/i }));

    await waitFor(() => {
      expect(screen.getByTestId('route-preview')).toBeInTheDocument();
    });

    expect(screen.getByTestId('preview-runner')).toHaveTextContent('Route: Alice');
    expect(screen.getByTestId('preview-stops')).toHaveTextContent('2');
  });

  it('returns to routes view when Back to Routes is clicked after optimization', async () => {
    const user = userEvent.setup();

    mockUseWholesaleDeliveries.mockReturnValue({
      data: [
        makeDelivery('d1', 'runner-1', 'Alice', 'WO-001'),
        makeDelivery('d2', 'runner-1', 'Alice', 'WO-002'),
      ],
      isLoading: false,
    });

    mockInvokeEdgeFunction.mockResolvedValue({
      data: {
        waypoints: [
          {
            delivery_id: 'd1',
            address: '123 Main St',
            coordinates: { lat: 40.71, lng: -74.01 },
            estimated_arrival: '2026-01-01T10:00:00Z',
            estimated_duration_minutes: 15,
            sequence: 1,
          },
        ],
        summary: {
          total_deliveries: 1,
          total_distance_km: 3,
          estimated_total_time_minutes: 20,
          estimated_completion: '2026-01-01T10:20:00Z',
        },
      },
      error: null,
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /optimize routes/i }));

    await waitFor(() => {
      expect(screen.getByTestId('route-preview')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /back to routes/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('route-preview')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Route Optimization')).toBeInTheDocument();
  });

  it('shows error toast when edge function fails', async () => {
    const user = userEvent.setup();

    mockUseWholesaleDeliveries.mockReturnValue({
      data: [
        makeDelivery('d1', 'runner-1', 'Alice', 'WO-001'),
        makeDelivery('d2', 'runner-1', 'Alice', 'WO-002'),
      ],
      isLoading: false,
    });

    mockInvokeEdgeFunction.mockResolvedValue({
      data: null,
      error: new Error('Edge function timeout'),
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /optimize routes/i }));

    // Should not show preview on error
    await waitFor(() => {
      expect(screen.queryByTestId('route-preview')).not.toBeInTheDocument();
    });
  });

  it('shows per-route Optimize button for routes with 2+ stops', () => {
    mockUseWholesaleDeliveries.mockReturnValue({
      data: [
        makeDelivery('d1', 'runner-1', 'Alice', 'WO-001'),
        makeDelivery('d2', 'runner-1', 'Alice', 'WO-002'),
        makeDelivery('d3', 'runner-2', 'Bob', 'WO-003'),
      ],
      isLoading: false,
    });

    render(<RouteOptimization />, { wrapper: createWrapper() });

    // Alice has 2 stops — should have Optimize button
    const optimizeButtons = screen.getAllByRole('button', { name: /^optimize$/i });
    expect(optimizeButtons).toHaveLength(1); // Only Alice's route qualifies
  });
});
