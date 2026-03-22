/**
 * CreateStoreDialog Tests
 * Tests for the store creation dialog including credit cost indication
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateStoreDialog } from '../CreateStoreDialog';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock useDebounce to return value immediately
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));

// Mock PresetPackSelector
vi.mock('@/components/admin/storefront/PresetPackSelector', () => ({
  PresetPackSelector: ({ onSelectPreset }: { onSelectPreset: (id: string) => void }) => (
    <button data-testid="select-preset" onClick={() => onSelectPreset('preset-1')}>
      Select Preset
    </button>
  ),
}));

// Mock storefrontPresets
vi.mock('@/lib/storefrontPresets', () => ({
  getPresetById: vi.fn().mockReturnValue({
    id: 'preset-1',
    name: 'Test Preset',
    tagline: 'Test tagline',
  }),
  getPresetTheme: vi.fn().mockReturnValue({
    colors: { primary: '#000', secondary: '#fff', accent: '#333', background: '#fff' },
    darkMode: false,
  }),
}));

// Mock useCredits hook - free tier with enough balance
const mockUseCredits = vi.fn().mockReturnValue({
  balance: 5000,
  isFreeTier: true,
  isLoading: false,
});

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => mockUseCredits(),
}));

// Mock credit cost functions
vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn().mockReturnValue(500),
  getCreditCostInfo: vi.fn().mockReturnValue({
    actionKey: 'storefront_create',
    actionName: 'Create Storefront',
    credits: 500,
    category: 'marketplace',
    description: 'Create a new white-label storefront (one-time setup)',
  }),
  HIGH_COST_THRESHOLD: 100,
}));

describe('CreateStoreDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isCreating: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCredits.mockReturnValue({
      balance: 5000,
      isFreeTier: true,
      isLoading: false,
    });
  });

  it('renders the template selection step initially', () => {
    render(<CreateStoreDialog {...defaultProps} />);
    expect(screen.getByText('Choose a Template')).toBeInTheDocument();
  });

  it('shows credit cost indicator on details step for free tier users', async () => {
    const user = userEvent.setup();
    render(<CreateStoreDialog {...defaultProps} />);

    // Select a preset
    await user.click(screen.getByTestId('select-preset'));

    // Proceed to details step
    await user.click(screen.getByText('Next'));

    // Should show the credit cost indicator ("will use 500 credits")
    await waitFor(() => {
      expect(screen.getByText(/will use/)).toBeInTheDocument();
    });
    // Should also show 500 in the button
    const allFiveHundreds = screen.getAllByText('500');
    expect(allFiveHundreds.length).toBeGreaterThanOrEqual(2); // indicator + button
    expect(screen.getByText('Store Details')).toBeInTheDocument();
  });

  it('shows credit cost in submit button for free tier users', async () => {
    const user = userEvent.setup();
    render(<CreateStoreDialog {...defaultProps} />);

    // Navigate to details step
    await user.click(screen.getByTestId('select-preset'));
    await user.click(screen.getByText('Next'));

    // Submit button should show "Create Store" with credit cost
    await waitFor(() => {
      expect(screen.getByText('Create Store')).toBeInTheDocument();
    });
    // Button has a "500" span inside it
    const submitButton = screen.getByRole('button', { name: /Create Store/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton.textContent).toContain('500');
  });

  it('does not show credit indicator for paid tier users', async () => {
    mockUseCredits.mockReturnValue({
      balance: 0,
      isFreeTier: false,
      isLoading: false,
    });

    const user = userEvent.setup();
    render(<CreateStoreDialog {...defaultProps} />);

    // Navigate to details step
    await user.click(screen.getByTestId('select-preset'));
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Store Details')).toBeInTheDocument();
    });

    // CreditCostIndicator should not render for paid tier
    const creditIndicators = screen.queryAllByText(/will use/);
    expect(creditIndicators).toHaveLength(0);
  });

  it('shows insufficient credits warning when balance is too low', async () => {
    mockUseCredits.mockReturnValue({
      balance: 200,
      isFreeTier: true,
      isLoading: false,
    });

    const user = userEvent.setup();
    render(<CreateStoreDialog {...defaultProps} />);

    // Navigate to details step
    await user.click(screen.getByTestId('select-preset'));
    await user.click(screen.getByText('Next'));

    // Should show insufficient credits text in the indicator
    await waitFor(() => {
      expect(screen.getByText(/Requires/)).toBeInTheDocument();
    });
    // 500 should appear in both indicator and button
    const allFiveHundreds = screen.getAllByText(/500/);
    expect(allFiveHundreds.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSubmit with correct data when form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateStoreDialog {...defaultProps} onSubmit={onSubmit} />);

    // Navigate to details step
    await user.click(screen.getByTestId('select-preset'));
    await user.click(screen.getByText('Next'));

    // Fill in form
    await waitFor(() => {
      expect(screen.getByLabelText(/Store Name/)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Store Name/), 'My Test Store');

    // Wait for slug availability check
    await waitFor(() => {
      expect(screen.getByText(/available/i)).toBeInTheDocument();
    });

    // Submit
    await user.click(screen.getByRole('button', { name: /Create Store/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          storeName: 'My Test Store',
          slug: 'my-test-store',
          presetId: 'preset-1',
        })
      );
    });
  });
});
