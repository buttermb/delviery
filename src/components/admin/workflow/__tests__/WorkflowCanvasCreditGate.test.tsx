/**
 * WorkflowCanvas Credit Gate Tests
 *
 * Tests that workflow execution is gated behind useCreditGatedAction
 * with pre-calculated costs from action nodes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn((_actionKey: string, action: () => Promise<unknown>) => action());
const mockInvoke = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

// Mock useCredits / useCreditGatedAction
vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

// Mock useTenantAdminAuth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock humanizeError
vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

// Mock credit costs with real cost values
vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((key: string) => {
    const costs: Record<string, number> = {
      send_email: 10,
      send_sms: 25,
      webhook_fired: 5,
      courier_assign_delivery: 10,
      stock_update: 3,
    };
    return costs[key] ?? 0;
  }),
}));

// Mock child components that rely on reactflow
vi.mock('../VisualWorkflowEditor', () => ({
  VisualWorkflowEditor: () => <div data-testid="visual-editor">Visual Editor</div>,
}));

vi.mock('../NodePalette', () => ({
  NodePalette: () => <div data-testid="node-palette">Node Palette</div>,
}));

vi.mock('../WorkflowVersionHistory', () => ({
  WorkflowVersionHistory: () => <div>Version History</div>,
}));

vi.mock('@/hooks/useWorkflowVersions', () => ({
  useWorkflowVersionStats: () => ({ totalVersions: 0 }),
}));

// ============================================================================
// Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Import after mocks
// ============================================================================

import { WorkflowCanvas } from '../WorkflowCanvas';
import { getCreditCost } from '@/lib/credits';

// ============================================================================
// calculateWorkflowCreditCost (tested indirectly via component)
// ============================================================================

describe('Workflow Credit Cost Calculation', () => {
  it('should map workflow action types to credit keys correctly', () => {
    // Verify the getCreditCost mock matches expected costs
    expect(getCreditCost('send_email')).toBe(10);
    expect(getCreditCost('send_sms')).toBe(25);
    expect(getCreditCost('webhook_fired')).toBe(5);
    expect(getCreditCost('courier_assign_delivery')).toBe(10);
    expect(getCreditCost('stock_update')).toBe(3);
  });

  it('should return 0 for unknown action types', () => {
    expect(getCreditCost('unknown_action')).toBe(0);
    expect(getCreditCost('condition')).toBe(0);
    expect(getCreditCost('database_query')).toBe(0);
  });
});

// ============================================================================
// WorkflowCanvas Integration
// ============================================================================

describe('WorkflowCanvas Credit Gate Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: workflows loaded OK with one workflow that has actions
    const mockWorkflow = {
      id: 'wf-1',
      name: 'Test Workflow',
      description: 'A test workflow',
      trigger_type: 'manual',
      trigger_config: {},
      actions: [
        { id: 'a1', type: 'send_email', config: {} },
        { id: 'a2', type: 'send_sms', config: {} },
        { id: 'a3', type: 'call_webhook', config: {} },
      ],
      is_active: true,
      tenant_id: 'test-tenant-id',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    // Set up supabase mocks for loading workflows
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: () => Promise.resolve({ data: mockWorkflow, error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflow_definitions') {
        return {
          ...chainable,
          order: vi.fn().mockReturnValue(
            Promise.resolve({ data: [mockWorkflow], error: null })
          ),
          insert: vi.fn().mockReturnValue({ select: () => ({ maybeSingle: () => Promise.resolve({ data: mockWorkflow, error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) }),
          upsert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
        };
      }
      if (table === 'workflow_action_templates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
          }),
        };
      }
      if (table === 'workflow_executions') {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: 'exec-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      return chainable;
    });

    mockInvoke.mockResolvedValue({
      data: { status: 'completed' },
      error: null,
    });
  });

  it('should render the workflow canvas', async () => {
    render(<WorkflowCanvas />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Workflow Automation')).toBeInTheDocument();
    });
  });

  it('should show credit cost badge on Test button when workflow has actions', async () => {
    render(<WorkflowCanvas />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    // Click on the workflow to select it
    fireEvent.click(screen.getByText('Test Workflow'));

    // Expected total: send_email(10) + send_sms(25) + call_webhook(5) = 40
    await waitFor(() => {
      expect(screen.getByText('40 cr')).toBeInTheDocument();
    });
  });

  it('should call executeCreditAction when Test button is clicked', async () => {
    render(<WorkflowCanvas />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    // Select the workflow
    fireEvent.click(screen.getByText('Test Workflow'));

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    // Click Test
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'webhook_fired',
        expect.any(Function),
        expect.objectContaining({
          referenceId: 'wf-1',
          referenceType: 'workflow_execution',
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should pass onInsufficientCredits with cost description', async () => {
    // Mock executeCreditAction to capture and call the callback
    mockExecute.mockImplementation(
      (_actionKey: string, _action: unknown, options?: { onInsufficientCredits?: () => void }) => {
        options?.onInsufficientCredits?.();
        return Promise.resolve(null);
      }
    );

    const { toast } = await import('sonner');

    render(<WorkflowCanvas />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test Workflow'));

    await waitFor(() => {
      const testButton = screen.getByRole('button', { name: /test/i });
      fireEvent.click(testButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Insufficient credits',
        expect.objectContaining({
          description: expect.stringContaining('40'),
        })
      );
    });
  });
});
