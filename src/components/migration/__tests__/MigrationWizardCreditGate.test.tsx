/**
 * MigrationWizard Credit Gate Tests
 *
 * Verifies that the catalog import action in MigrationWizard
 * is gated behind useCreditGatedAction('menu_import_catalog').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockStartImport = vi.fn();
const mockGoToStep = vi.fn();
const mockReset = vi.fn();

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: vi.fn(() => ({
    execute: mockExecute,
    isExecuting: false,
    showOutOfCreditsModal: false,
    closeOutOfCreditsModal: vi.fn(),
    blockedAction: null,
    balance: 1000,
    isFreeTier: true,
  })),
}));

vi.mock('@/hooks/useMigration', () => ({
  useMigration: vi.fn(() => ({
    state: {
      step: 'preview',
      inputFormat: 'csv',
      rawInput: 'test',
      fileName: 'test.csv',
      detectedColumns: null,
      parsedProducts: [
        { name: 'Test Product', category: 'flower', confidence: 0.9 },
      ],
      validationResults: [],
      importProgress: null,
      importResult: null,
      error: null,
      suggestedDefaults: null,
      quickAnswers: null,
      isInformalText: false,
    },
    reset: mockReset,
    goToStep: mockGoToStep,
    handleFileUpload: vi.fn(),
    handleTextPaste: vi.fn(),
    updateColumnMappings: vi.fn(),
    startAIParsing: vi.fn(),
    updateProduct: vi.fn(),
    removeProduct: vi.fn(),
    startImport: mockStartImport,
    getMissingFields: vi.fn(() => []),
    applyQuickAnswers: vi.fn(),
    isParsingLoading: false,
    isImportLoading: false,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: vi.fn((v: number) => `$${v.toFixed(2)}`),
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// Import after mocks
import { MigrationWizard } from '../MigrationWizard';
import { useCreditGatedAction } from '@/hooks/useCredits';

describe('MigrationWizard credit gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ success: true });
  });

  it('calls useCreditGatedAction hook', () => {
    render(<MigrationWizard />, { wrapper: createWrapper() });
    expect(useCreditGatedAction).toHaveBeenCalled();
  });

  it('wraps import action with executeCreditAction("menu_import_catalog")', async () => {
    render(<MigrationWizard />, { wrapper: createWrapper() });

    // Find and click the import button
    const importButton = screen.getByRole('button', { name: /import/i });
    fireEvent.click(importButton);

    // Verify executeCreditAction was called with the correct action key
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(
      'menu_import_catalog',
      expect.any(Function),
    );
  });

  it('calls startImport inside the credit-gated action callback', async () => {
    // Make mockExecute actually invoke the callback
    mockExecute.mockImplementation(
      async (_actionKey: string, callback: () => Promise<void>) => {
        await callback();
        return { success: true };
      },
    );

    render(<MigrationWizard />, { wrapper: createWrapper() });

    const importButton = screen.getByRole('button', { name: /import/i });
    fireEvent.click(importButton);

    // Wait for the async callback chain
    await vi.waitFor(() => {
      expect(mockStartImport).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call startImport directly without credit gate', () => {
    render(<MigrationWizard />, { wrapper: createWrapper() });

    const importButton = screen.getByRole('button', { name: /import/i });
    fireEvent.click(importButton);

    // startImport should NOT be called directly - only through the credit gate
    expect(mockStartImport).not.toHaveBeenCalled();
    // But executeCreditAction should have been called
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
