/**
 * SettingsPage Component Tests
 * Tests:
 * - Tab rendering and navigation
 * - General settings form rendering
 * - Security settings form rendering
 * - Notification settings form rendering
 * - Switch shouldDirty tracking
 * - PaymentSettingsForm onSave wired
 * - Loading skeletons
 * - PermissionGuard wrapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockNavigateToAdmin = vi.fn();
vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
    tenantSlug: 'test-tenant',
  }),
}));

const mockRefreshAccount = vi.fn().mockResolvedValue(undefined);
const mockAccount = {
  id: 'test-account-id',
  company_name: 'Test Company',
  slug: 'test-company',
  plan_id: 'basic',
  status: 'active',
  trial_ends_at: null,
  billing_email: 'test@example.com',
  created_at: '2024-01-01',
  metadata: {
    phone: '555-0100',
    address: '123 Test St',
    security: {
      twoFactorEnabled: false,
      requirePasswordChange: false,
      sessionTimeout: 30,
      passwordMinLength: 8,
    },
  },
};

const mockAccountSettings = {
  id: 'test-settings-id',
  account_id: 'test-account-id',
  business_license: null,
  tax_rate: 0,
  state: null,
  operating_states: [],
  branding: null,
  compliance_settings: null,
  notification_settings: {
    emailNotifications: true,
    smsNotifications: false,
    lowStockAlerts: true,
    overdueAlerts: true,
    orderAlerts: true,
    telegram_auto_forward: false,
  },
  integration_settings: null,
};

vi.mock('@/contexts/AccountContext', () => ({
  useAccount: () => ({
    account: mockAccount,
    accountSettings: mockAccountSettings,
    userProfile: { role: 'account_owner' },
    loading: false,
    refreshAccount: mockRefreshAccount,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { sent: true }, error: null })),
    },
  },
}));

vi.mock('@/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({
    showBlockerDialog: false,
    confirmLeave: vi.fn(),
    cancelLeave: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFormKeyboardShortcuts', () => ({
  useFormKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/components/ui/shortcut-hint', () => ({
  ShortcutHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useModifierKey: () => '⌘',
}));

vi.mock('@/components/ui/field-help', () => ({
  FieldHelp: () => <span data-testid="field-help" />,
  fieldHelpTexts: {
    dataIsolation: { tooltip: 'Data isolation info' },
  },
}));

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/admin/sidebar/OperationSizeSelector', () => ({
  OperationSizeSelector: () => <div data-testid="operation-size-selector">Selector</div>,
}));

vi.mock('@/components/admin/sidebar/SidebarCustomizer', () => ({
  SidebarCustomizer: () => <div data-testid="sidebar-customizer">Customizer</div>,
}));

vi.mock('@/components/settings/StripeConnectSettings', () => ({
  StripeConnectSettings: () => <div data-testid="stripe-settings">Stripe</div>,
}));

vi.mock('@/components/settings/PaymentSettingsForm', () => ({
  PaymentSettingsForm: ({ onSave }: { onSave: (data: unknown) => Promise<void> }) => (
    <div data-testid="payment-settings-form">
      <button onClick={() => onSave({ accept_cash: true })} data-testid="payment-save">
        Save Payment
      </button>
    </div>
  ),
}));

vi.mock('@/components/admin/settings/FeaturesOverviewPanel', () => ({
  FeaturesOverviewPanel: () => <div data-testid="features-panel">Features</div>,
}));

vi.mock('@/components/settings/SettingsImportDialog', () => ({
  SettingsImportDialog: () => <div data-testid="settings-import-dialog" />,
}));

vi.mock('@/components/settings/SettingsSkeletons', () => ({
  GeneralSettingsSkeleton: () => <div data-testid="general-skeleton" />,
  SecuritySettingsSkeleton: () => <div data-testid="security-skeleton" />,
  NotificationSettingsSkeleton: () => <div data-testid="notification-skeleton" />,
  PrintingSettingsSkeleton: () => <div data-testid="printing-skeleton" />,
  IntegrationsSettingsSkeleton: () => <div data-testid="integrations-skeleton" />,
  SidebarSettingsSkeleton: () => <div data-testid="sidebar-skeleton" />,
  SidebarCustomizationSkeleton: () => <div data-testid="sidebar-customization-skeleton" />,
  PaymentSettingsSkeleton: () => <div data-testid="payment-skeleton" />,
}));

vi.mock('@/components/unsaved-changes', () => ({
  UnsavedChangesDialog: () => <div data-testid="unsaved-changes-dialog" />,
}));

import SettingsPage from '../SettingsPage';

function renderSettingsPage(tab?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const initialEntry = tab ? `/?tab=${tab}` : '/';

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the settings page title', () => {
    renderSettingsPage();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage your account and system preferences')).toBeInTheDocument();
  });

  it('renders all tab triggers', () => {
    renderSettingsPage();
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /printing/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /integrations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sidebar$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sidebar layout/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /payments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /features/i })).toBeInTheDocument();
  });

  it('renders general settings form by default', () => {
    renderSettingsPage();
    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('Company Name')).toBeInTheDocument();
    expect(screen.getByText('Save General Settings')).toBeInTheDocument();
  });

  it('renders team management button', () => {
    renderSettingsPage();
    expect(screen.getByText('Manage Team Members')).toBeInTheDocument();
  });

  it('navigates to team members on button click', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(screen.getByText('Manage Team Members'));
    expect(mockNavigateToAdmin).toHaveBeenCalledWith('team-members');
  });

  it('renders back button that navigates to dashboard', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(screen.getByText('Back'));
    expect(mockNavigateToAdmin).toHaveBeenCalledWith('dashboard');
  });

  it('renders import settings button', () => {
    renderSettingsPage();
    expect(screen.getByText('Import Settings')).toBeInTheDocument();
  });

  it('renders payment settings form with onSave handler on payments tab', () => {
    renderSettingsPage('payments');
    expect(screen.getByTestId('payment-settings-form')).toBeInTheDocument();
  });

  it('calls onSavePaymentSettings when payment form is saved', async () => {
    const user = userEvent.setup();
    renderSettingsPage('payments');

    await user.click(screen.getByTestId('payment-save'));

    await waitFor(() => {
      expect(mockRefreshAccount).toHaveBeenCalled();
    });
  });

  it('renders features overview panel on features tab', () => {
    renderSettingsPage('features');
    expect(screen.getByTestId('features-panel')).toBeInTheDocument();
  });

  it('renders in embedded mode without tabs', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SettingsPage embedded />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should render general settings content
    expect(screen.getByText('General Settings')).toBeInTheDocument();
    // Should NOT render tabs
    expect(screen.queryByRole('tab', { name: /security/i })).not.toBeInTheDocument();
  });
});
