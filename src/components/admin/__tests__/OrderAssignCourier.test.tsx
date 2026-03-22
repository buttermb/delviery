/**
 * OrderAssignCourier Tests
 *
 * Verifies:
 * - Credit gate wraps courier assignment (both manual and auto-assign)
 * - CreditCostBadge renders in dialog title
 * - Assignment is blocked when credits are insufficient
 * - Assignment proceeds when credits are sufficient
 * - Loading states include credit checking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrderAssignCourier } from '../OrderAssignCourier';

// --- Mutable mock state ---
let mockExecute: ReturnType<typeof vi.fn>;
let mockIsPerforming = false;
let mockIsFreeTier = true;
let mockTenantId: string | undefined = 'tenant-123';
let mockCouriers: Array<{
  id: string;
  full_name: string;
  phone: string;
  email: string;
  vehicle_type: string;
  vehicle_plate: string;
  is_online: boolean;
  is_active: boolean;
  rating: number | null;
  total_deliveries: number;
  current_lat: number | null;
  current_lng: number | null;
}> = [];
let mockMutateAsync: ReturnType<typeof vi.fn>;
let mockIsPending = false;

// --- Mocks ---

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({ data: mockCouriers, error: null })),
            })),
          })),
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { access_token: 'test-token' } },
        })
      ),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenantId ? { id: mockTenantId } : null,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: mockIsPerforming,
    isFreeTier: mockIsFreeTier,
  }),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriers: {
      list: (params: unknown) => ['couriers', 'list', params],
    },
    orders: { all: ['orders'] },
    deliveries: { all: ['deliveries'] },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/utils/apiClient', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) =>
    err instanceof Error ? err.message : String(err),
}));

vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ actionKey, compact }: { actionKey: string; compact?: boolean }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey} data-compact={compact}>
      10 cr
    </span>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockCouriers,
    isLoading: false,
    error: null,
  }),
  useMutation: ({ mutationFn, onSuccess, onError }: {
    mutationFn: (args: unknown) => Promise<unknown>;
    onSuccess?: (data: unknown) => void;
    onError?: (error: Error) => void;
  }) => ({
    mutate: vi.fn((args: unknown) => {
      mutationFn(args).then(onSuccess).catch(onError);
    }),
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

vi.mock('@/components/ui/dialog-footer-actions', () => ({
  DialogFooterActions: ({
    primaryLabel,
    onPrimary,
    primaryDisabled,
    primaryLoading,
    secondaryLabel,
    onSecondary,
  }: {
    primaryLabel?: string;
    onPrimary?: () => void;
    primaryDisabled?: boolean;
    primaryLoading?: boolean;
    secondaryLabel?: string;
    onSecondary?: () => void;
  }) => (
    <div data-testid="dialog-footer">
      {secondaryLabel && (
        <button onClick={onSecondary} data-testid="cancel-button">
          {secondaryLabel}
        </button>
      )}
      {primaryLabel && (
        <button
          onClick={onPrimary}
          disabled={primaryDisabled}
          data-testid="assign-button"
          data-loading={primaryLoading}
        >
          {primaryLabel}
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, variant }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span className={className} data-variant={variant}>{children}</span>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | boolean | undefined | null>) =>
    classes.filter(Boolean).join(' '),
}));

// Mock lucide-react icons - each factory must be fully inline for vi.mock hoisting
vi.mock('lucide-react/dist/esm/icons/truck', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/map-pin', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/phone', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/star', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/zap', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/check-circle-2', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/user', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/alert-circle', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/loader-2', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon" {...props} />,
}));

// --- Test setup ---

const defaultProps = {
  orderId: 'order-123',
  orderAddress: '123 Main St',
  orderNumber: 'ORD-001',
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
};

function makeCourier(overrides: Partial<typeof mockCouriers[0]> = {}): typeof mockCouriers[0] {
  return {
    id: 'courier-1',
    full_name: 'John Doe',
    phone: '+1234567890',
    email: 'john@example.com',
    vehicle_type: 'motorcycle',
    vehicle_plate: 'ABC-123',
    is_online: true,
    is_active: true,
    rating: 4.5,
    total_deliveries: 50,
    current_lat: 40.7128,
    current_lng: -74.006,
    ...overrides,
  };
}

describe('OrderAssignCourier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute = vi.fn((_actionKey: string, action: () => Promise<unknown>) => action());
    mockIsPerforming = false;
    mockIsFreeTier = true;
    mockTenantId = 'tenant-123';
    mockCouriers = [makeCourier()];
    mockMutateAsync = vi.fn().mockResolvedValue({ courier: { name: 'John Doe' } });
    mockIsPending = false;
  });

  it('renders CreditCostBadge in dialog title', () => {
    render(<OrderAssignCourier {...defaultProps} />);
    const badge = screen.getByTestId('credit-cost-badge');
    expect(badge).toBeDefined();
    expect(badge.getAttribute('data-action-key')).toBe('courier_assign_delivery');
  });

  it('calls executeCreditAction with correct actionKey when assigning selected courier', async () => {
    render(<OrderAssignCourier {...defaultProps} />);

    // Select the courier
    const courierName = screen.getByText('John Doe');
    fireEvent.click(courierName.closest('button')!);

    // Click Assign Selected
    const assignButton = screen.getByTestId('assign-button');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'courier_assign_delivery',
        expect.any(Function),
        { referenceId: 'order-123', referenceType: 'order' }
      );
    });
  });

  it('calls executeCreditAction with correct actionKey when auto-assigning', async () => {
    render(<OrderAssignCourier {...defaultProps} />);

    // Find and click auto-assign button
    const autoAssignButton = screen.getByText('Auto-assign nearest available courier')
      .closest('button')!;
    fireEvent.click(autoAssignButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'courier_assign_delivery',
        expect.any(Function),
        { referenceId: 'order-123', referenceType: 'order' }
      );
    });
  });

  it('calls mutateAsync with courierId when manually assigning', async () => {
    render(<OrderAssignCourier {...defaultProps} />);

    // Select the courier
    const courierName = screen.getByText('John Doe');
    fireEvent.click(courierName.closest('button')!);

    // Click Assign Selected
    const assignButton = screen.getByTestId('assign-button');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ courierId: 'courier-1' });
    });
  });

  it('calls mutateAsync with autoAssign flag when auto-assigning', async () => {
    render(<OrderAssignCourier {...defaultProps} />);

    const autoAssignButton = screen.getByText('Auto-assign nearest available courier')
      .closest('button')!;
    fireEvent.click(autoAssignButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ autoAssign: true });
    });
  });

  it('does not call mutateAsync when credit gate returns null', async () => {
    mockExecute = vi.fn().mockResolvedValue(null);

    render(<OrderAssignCourier {...defaultProps} />);

    const autoAssignButton = screen.getByText('Auto-assign nearest available courier')
      .closest('button')!;
    fireEvent.click(autoAssignButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('disables buttons when credit check is in progress', () => {
    mockIsPerforming = true;

    render(<OrderAssignCourier {...defaultProps} />);

    const assignButton = screen.getByTestId('assign-button');
    expect(assignButton.getAttribute('disabled')).not.toBeNull();
    expect(assignButton.getAttribute('data-loading')).toBe('true');
  });

  it('disables auto-assign button when credit check is in progress', () => {
    mockIsPerforming = true;

    render(<OrderAssignCourier {...defaultProps} />);

    const autoAssignButton = screen.getByText('Auto-assign nearest available courier')
      .closest('button')!;
    expect(autoAssignButton.disabled).toBe(true);
  });

  it('disables courier cards when credit check is in progress', () => {
    mockIsPerforming = true;

    render(<OrderAssignCourier {...defaultProps} />);

    const courierButton = screen.getByText('John Doe').closest('button')!;
    expect(courierButton.disabled).toBe(true);
  });

  it('shows "Assigning..." label when credit check is in progress', () => {
    mockIsPerforming = true;

    render(<OrderAssignCourier {...defaultProps} />);

    expect(screen.getByText('Assigning...')).toBeDefined();
  });

  it('does not call credit gate when no courier is selected', () => {
    render(<OrderAssignCourier {...defaultProps} />);

    // Click Assign Selected without selecting a courier
    const assignButton = screen.getByTestId('assign-button');
    fireEvent.click(assignButton);

    expect(mockExecute).not.toHaveBeenCalled();
  });
});
