/**
 * SelectPlanPage Tests
 *
 * Verifies that the SaaS SelectPlanPage:
 * 1. Redirects to /saas/login when unauthenticated (no signup flow)
 * 2. Allows access when coming from signup flow (tenant_id param)
 * 3. Allows access when coming from signup flow (fromSignup state)
 * 4. Shows loading state while checking auth
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/components/marketing/ForceLightMode', () => ({
  ForceLightMode: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/FloraIQLogo', () => ({
  default: () => <div data-testid="logo">FloraIQ</div>,
}));

// Mock supabase with controllable session
const mockGetSession = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// --- Helpers ---

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      <span data-testid="location-pathname">{location.pathname}</span>
      <span data-testid="location-search">{location.search}</span>
    </div>
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

interface TestAppProps {
  initialEntries: string[];
  children: ReactNode;
}

function TestApp({ initialEntries, children }: TestAppProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Import component and mocked modules after mocks
import SelectPlanPage from '../SelectPlanPage';
import { toast } from 'sonner';

// --- Tests ---

describe('SelectPlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Default: no session
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Default: from() returns chain
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Unauthenticated access without signup flow', () => {
    it('should redirect to /saas/login when unauthenticated and not from signup', async () => {
      render(
        <TestApp initialEntries={['/select-plan']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
            <Route
              path="/saas/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      // Advance through the retry delays (3 retries × 300ms)
      await vi.advanceTimersByTimeAsync(1000);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/saas/login?returnUrl=/select-plan'
        );
      });
    });

    it('should show error toast before redirecting', async () => {
      render(
        <TestApp initialEntries={['/select-plan']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
          </Routes>
        </TestApp>
      );

      await vi.advanceTimersByTimeAsync(1000);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Please log in to select a plan'
        );
      });
    });

    it('should not render plan cards when unauthenticated', async () => {
      render(
        <TestApp initialEntries={['/select-plan']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
          </Routes>
        </TestApp>
      );

      // During auth check, loading spinner should be shown
      expect(screen.getByText('Loading plans...')).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(1000);

      // After redirect, plan content should not be visible
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });

      expect(
        screen.queryByText('Simple, Transparent Pricing')
      ).not.toBeInTheDocument();
    });
  });

  describe('Authenticated access', () => {
    it('should render plan cards when authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: { user: { id: 'user-123' }, access_token: 'token' },
        },
        error: null,
      });

      render(
        <TestApp initialEntries={['/select-plan?tenant_id=tenant-123']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
          </Routes>
        </TestApp>
      );

      // Advance through signup flow delay (500ms) + session check
      await vi.advanceTimersByTimeAsync(600);

      await waitFor(() => {
        expect(
          screen.getByText('Simple, Transparent Pricing')
        ).toBeInTheDocument();
      });

      // Should not redirect
      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/saas/login')
      );
    });
  });

  describe('Signup flow access (unauthenticated but allowed)', () => {
    it('should allow access when tenant_id is in search params', async () => {
      // Session eventually resolves (signup flow session becomes available)
      mockGetSession.mockResolvedValue({
        data: {
          session: { user: { id: 'user-123' }, access_token: 'token' },
        },
        error: null,
      });

      render(
        <TestApp initialEntries={['/select-plan?tenant_id=new-tenant-456']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
          </Routes>
        </TestApp>
      );

      // Advance through signup flow delay (500ms) + session check
      await vi.advanceTimersByTimeAsync(600);

      await waitFor(() => {
        expect(
          screen.getByText('Simple, Transparent Pricing')
        ).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/saas/login')
      );
    });

    it('should not redirect even without session when tenant_id is present', async () => {
      // No session at all, but tenant_id present = signup flow
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(
        <TestApp initialEntries={['/select-plan?tenant_id=new-tenant-456']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
          </Routes>
        </TestApp>
      );

      // Advance through signup flow delay (500ms) + retries (3 × 300ms)
      await vi.advanceTimersByTimeAsync(1500);

      await waitFor(() => {
        expect(
          screen.getByText('Simple, Transparent Pricing')
        ).toBeInTheDocument();
      });

      // Should NOT redirect to login
      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.stringContaining('/saas/login')
      );
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner during auth check', () => {
      // Slow session response
      mockGetSession.mockReturnValue(new Promise(() => {}));

      render(
        <TestApp initialEntries={['/select-plan']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
          </Routes>
        </TestApp>
      );

      expect(screen.getByText('Loading plans...')).toBeInTheDocument();
      expect(
        screen.queryByText('Simple, Transparent Pricing')
      ).not.toBeInTheDocument();
    });
  });

  describe('Session retry logic', () => {
    it('should retry session check up to 3 times', async () => {
      // First 2 calls return null, third returns session
      mockGetSession
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({
          data: {
            session: { user: { id: 'user-123' }, access_token: 'token' },
          },
          error: null,
        });

      render(
        <TestApp initialEntries={['/select-plan?tenant_id=t-123']}>
          <Routes>
            <Route path="/select-plan" element={<SelectPlanPage />} />
          </Routes>
        </TestApp>
      );

      // Advance through signup delay + retry delays
      await vi.advanceTimersByTimeAsync(1200);

      await waitFor(() => {
        expect(mockGetSession).toHaveBeenCalledTimes(3);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Simple, Transparent Pricing')
        ).toBeInTheDocument();
      });
    });
  });
});
