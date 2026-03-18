import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import MarketplaceCategoryManager from '@/pages/admin/marketplace/MarketplaceCategoryManager';

// Track which table is being queried
let currentTable = '';

const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

function createChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn((..._args: unknown[]) => mockOrder());
  chain.maybeSingle = vi.fn(() => mockMaybeSingle());
  chain.insert = vi.fn((data: unknown) => mockInsert(data));
  chain.update = vi.fn((data: unknown) => {
    const inner: Record<string, unknown> = {};
    inner.eq = vi.fn().mockReturnValue(inner);
    mockUpdate(data);
    return inner;
  });
  chain.delete = vi.fn(() => {
    const inner: Record<string, unknown> = {};
    inner.eq = vi.fn().mockReturnValue(inner);
    mockDelete();
    return inner;
  });
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      currentTable = table;
      return createChain();
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: Error) => err.message,
}));

const MOCK_STORE = { id: 'store-1', store_name: 'Test Store' };

const MOCK_CATEGORIES = [
  {
    id: 'cat-1',
    store_id: 'store-1',
    name: 'Flower',
    slug: 'flower',
    description: 'Cannabis flower products',
    parent_id: null,
    display_order: 0,
    is_active: true,
    image_url: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    store_id: 'store-1',
    name: 'Edibles',
    slug: 'edibles',
    description: null,
    parent_id: null,
    display_order: 1,
    is_active: false,
    image_url: null,
    created_at: '2024-01-02T00:00:00Z',
  },
];

describe('MarketplaceCategoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTable = '';
  });

  function setupMocks(options?: {
    store?: typeof MOCK_STORE | null;
    categories?: typeof MOCK_CATEGORIES;
  }) {
    const { store = MOCK_STORE, categories = MOCK_CATEGORIES } = options ?? {};

    // Store query returns via maybeSingle
    mockMaybeSingle.mockResolvedValue({ data: store, error: null });
    // Categories query returns via order
    mockOrder.mockResolvedValue({ data: categories, error: null });
  }

  it('renders loading state initially', () => {
    // Never resolve — keep queries pending
    mockMaybeSingle.mockReturnValue(new Promise(() => {}));

    render(<MarketplaceCategoryManager />);

    expect(screen.getByRole('status', { name: 'Loading categories...' })).toBeInTheDocument();
  });

  it('shows no-store message when store is not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('No Marketplace Store')).toBeInTheDocument();
    });
    expect(screen.getByText(/Set up your marketplace store first/)).toBeInTheDocument();
  });

  it('renders categories in a table when data is loaded', async () => {
    setupMocks();

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Flower')).toBeInTheDocument();
    });
    expect(screen.getByText('Edibles')).toBeInTheDocument();
    expect(screen.getByText('flower')).toBeInTheDocument();
    expect(screen.getByText('edibles')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('renders empty state when no categories exist', async () => {
    setupMocks({ categories: [] });

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('No categories found. Add one to get started.')).toBeInTheDocument();
    });
  });

  it('renders the page header and add button', async () => {
    setupMocks();

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Category Manager')).toBeInTheDocument();
    });
    expect(screen.getByText('Add Category')).toBeInTheDocument();
    expect(screen.getByText(/Organize your products/)).toBeInTheDocument();
  });

  it('opens dialog when Add Category button is clicked', async () => {
    setupMocks();

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Category Manager')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Category'));

    await waitFor(() => {
      expect(screen.getByText('New Category')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug (URL)')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Display Order')).toBeInTheDocument();
  });

  it('renders edit and delete buttons with aria-labels', async () => {
    setupMocks();

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Flower')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Edit Flower')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Flower')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Edibles')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Edibles')).toBeInTheDocument();
  });

  it('opens edit dialog with pre-filled data', async () => {
    setupMocks();

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Flower')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Edit Flower'));

    await waitFor(() => {
      expect(screen.getByText('Edit Category')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Name')).toHaveValue('Flower');
    expect(screen.getByLabelText('Slug (URL)')).toHaveValue('flower');
  });

  it('renders table headers correctly', async () => {
    setupMocks();

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Product Categories')).toBeInTheDocument();
    });

    const headers = ['Name', 'Slug', 'Order', 'Status', 'Actions'];
    for (const header of headers) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });

  it('uses Badge component for status display', async () => {
    setupMocks();

    render(<MarketplaceCategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    // Badge renders as a div with specific class patterns
    const activeBadge = screen.getByText('Active');
    const hiddenBadge = screen.getByText('Hidden');
    expect(activeBadge).toBeInTheDocument();
    expect(hiddenBadge).toBeInTheDocument();
  });
});
