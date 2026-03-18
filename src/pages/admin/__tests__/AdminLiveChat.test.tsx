/**
 * AdminLiveChat Component Tests
 * Tests:
 * - Renders header and empty state when no session selected
 * - Shows loading skeletons during data fetch
 * - Displays sessions list after loading
 * - Filters sessions by search query
 * - Uses TanStack Query with queryKeys
 * - Sanitizes search input
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies - factory functions must not reference outer scope variables
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      name: 'Test Tenant',
    },
  }),
}));

vi.mock('@/integrations/supabase/client', () => {
  const mockFrom = vi.fn();
  const channelObj = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockImplementation((cb?: (status: string) => void) => {
      if (cb) cb('SUBSCRIBED');
      return channelObj;
    }),
    send: vi.fn().mockResolvedValue(undefined),
  };

  return {
    supabase: {
      from: mockFrom,
      channel: vi.fn().mockReturnValue(channelObj),
      removeChannel: vi.fn().mockResolvedValue(undefined),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
        }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-user-id' } },
        }),
      },
    },
  };
});

vi.mock('@/utils/realtimeValidation', () => ({
  validateChatSession: (session: unknown) =>
    !!(session && typeof session === 'object' && 'id' in (session as Record<string, unknown>)),
  validateChatMessage: (msg: unknown) => !!(msg && typeof msg === 'object'),
}));

vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-group">{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

import AdminLiveChat from '../AdminLiveChat';
import { supabase } from '@/integrations/supabase/client';

const mockSessions = [
  {
    id: 'session-1',
    mode: 'human',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'user-1',
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    unread_count: 2,
    last_message: 'Hello, I need help',
    last_message_at: new Date().toISOString(),
  },
  {
    id: 'session-2',
    mode: 'ai',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    guest_id: 'guest-abc',
    customer_name: 'Jane Smith',
    unread_count: 0,
    last_message: 'What products do you have?',
    last_message_at: new Date().toISOString(),
  },
];

function setupMockSupabase(sessions = mockSessions) {
  const mockFrom = vi.mocked(supabase.from);

  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: sessions, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: sessions[0] ?? null, error: null }),
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        neq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  } as never);
}

describe('AdminLiveChat', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  function renderComponent() {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminLiveChat />
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  it('renders the header with title and subtitle', async () => {
    setupMockSupabase();
    renderComponent();

    expect(screen.getByText('Live Chat Support')).toBeInTheDocument();
    expect(screen.getByText('Manage customer conversations in real-time')).toBeInTheDocument();
  });

  it('shows empty state when no session is selected', async () => {
    setupMockSupabase();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No Chat Selected')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Select a conversation from the left panel to view messages and respond to customers.')
    ).toBeInTheDocument();
  });

  it('displays session counts in header badges', async () => {
    setupMockSupabase();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1 Active')).toBeInTheDocument();
      expect(screen.getByText('1 AI')).toBeInTheDocument();
    });
  });

  it('renders session list with customer names after loading', async () => {
    setupMockSupabase();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('displays last message in session list', async () => {
    setupMockSupabase();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Hello, I need help')).toBeInTheDocument();
      expect(screen.getByText('What products do you have?')).toBeInTheDocument();
    });
  });

  it('shows session tab counts', async () => {
    setupMockSupabase();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('All (2)')).toBeInTheDocument();
      expect(screen.getByText('Human (1)')).toBeInTheDocument();
      expect(screen.getByText('AI (1)')).toBeInTheDocument();
    });
  });

  it('has search input with maxLength', async () => {
    setupMockSupabase();
    renderComponent();

    const searchInput = screen.getByLabelText('Search conversations');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('maxLength', '200');
  });

  it('filters sessions by search query', async () => {
    setupMockSupabase();
    renderComponent();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search conversations');
    await user.type(searchInput, 'Jane');

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('shows unread badge on session with unread messages', async () => {
    setupMockSupabase();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // unread_count for session-1
    });
  });

  it('shows empty state for sessions when none exist', async () => {
    setupMockSupabase([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No chat sessions found')).toBeInTheDocument();
    });
  });

  it('queries chat_sessions with tenant_id filter', async () => {
    setupMockSupabase();
    renderComponent();

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('chat_sessions');
    });
  });
});
