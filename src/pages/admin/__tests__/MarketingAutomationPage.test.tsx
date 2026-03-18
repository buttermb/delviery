/**
 * MarketingAutomationPage Button Audit Tests
 *
 * Verifies that all buttons use proper size props, variants,
 * and accessibility attributes instead of inline style overrides.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    admin: { id: 'admin-1' },
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false }),
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    marketing: {
      campaigns: () => ['marketing', 'campaigns'],
    },
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
  CardDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    loading,
    disabled,
    'aria-label': ariaLabel,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    loading?: boolean;
    disabled?: boolean;
    'aria-label'?: string;
    [k: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      data-variant={variant || 'default'}
      data-size={size || 'default'}
      data-loading={loading}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: { children?: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="tabs" data-value={value} data-on-change={!!onValueChange}>{children}</div>
  ),
  TabsContent: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
  TabsList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <button data-testid={`tab-${value}`}>{children}</button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dropdown-trigger" data-as-child={asChild}>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <div role="menuitem" onClick={onClick}>{children}</div>
  ),
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/components/shared/ResponsiveTable', () => ({
  ResponsiveTable: ({ emptyState }: { emptyState?: { primaryAction?: { label: string; onClick: () => void } }; [k: string]: unknown }) => (
    <div data-testid="responsive-table">
      {emptyState?.primaryAction && (
        <button data-testid="empty-state-action" onClick={emptyState.primaryAction.onClick}>
          {emptyState.primaryAction.label}
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/components/shared/SearchInput', () => ({
  SearchInput: () => <input data-testid="search-input" />,
}));

vi.mock('@/components/admin/marketing/CampaignBuilder', () => ({
  CampaignBuilder: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="campaign-builder">
      <button onClick={onClose}>Close Builder</button>
    </div>
  ),
}));

vi.mock('@/components/admin/marketing/WorkflowEditor', () => ({
  WorkflowEditor: () => <div data-testid="workflow-editor" />,
}));

vi.mock('@/components/admin/marketing/CampaignAnalytics', () => ({
  CampaignAnalytics: () => <div data-testid="campaign-analytics" />,
}));

vi.mock('date-fns', () => ({
  format: (d: Date, f: string) => `formatted-${f}`,
}));

vi.mock('lucide-react', () => ({
  Mail: () => <span data-testid="icon-mail" />,
  Zap: () => <span data-testid="icon-zap" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Plus: () => <span data-testid="icon-plus" />,
  Calendar: () => <span data-testid="icon-calendar" />,
  MoreHorizontal: () => <span data-testid="icon-more" />,
}));

// --- Import Component Under Test ---

import MarketingAutomationPage from '../MarketingAutomationPage';

describe('MarketingAutomationPage button audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page with header buttons', () => {
    render(<MarketingAutomationPage />);

    const newWorkflowBtn = screen.getByText('New Workflow').closest('button');
    const newCampaignBtn = screen.getByText('New Campaign').closest('button');

    expect(newWorkflowBtn).toBeTruthy();
    expect(newCampaignBtn).toBeTruthy();
  });

  it('New Workflow button uses size="lg" and variant="outline"', () => {
    render(<MarketingAutomationPage />);

    const btn = screen.getByText('New Workflow').closest('button');
    expect(btn?.getAttribute('data-size')).toBe('lg');
    expect(btn?.getAttribute('data-variant')).toBe('outline');
  });

  it('New Campaign button uses size="lg" and default variant', () => {
    render(<MarketingAutomationPage />);

    const btn = screen.getByText('New Campaign').closest('button');
    expect(btn?.getAttribute('data-size')).toBe('lg');
    expect(btn?.getAttribute('data-variant')).toBe('default');
  });

  it('header buttons do not have inline min-height overrides', () => {
    render(<MarketingAutomationPage />);

    const newWorkflowBtn = screen.getByText('New Workflow').closest('button');
    const newCampaignBtn = screen.getByText('New Campaign').closest('button');

    // Buttons should not have hardcoded min-height or bg-emerald classes
    const workflowClasses = newWorkflowBtn?.className ?? '';
    const campaignClasses = newCampaignBtn?.className ?? '';

    expect(workflowClasses).not.toContain('min-h-[44px]');
    expect(campaignClasses).not.toContain('min-h-[44px]');
    expect(campaignClasses).not.toContain('bg-emerald');
  });

  it('New Campaign button does not use hardcoded color classes', () => {
    render(<MarketingAutomationPage />);

    const btn = screen.getByText('New Campaign').closest('button');
    const classes = btn?.className ?? '';

    expect(classes).not.toContain('bg-emerald-500');
    expect(classes).not.toContain('hover:bg-emerald-600');
  });

  it('empty state has a Create Campaign action button', () => {
    render(<MarketingAutomationPage />);

    const emptyAction = screen.getByTestId('empty-state-action');
    expect(emptyAction).toBeTruthy();
    expect(emptyAction.textContent).toBe('Create Campaign');
  });
});
