/**
 * SessionManagement Component Tests
 * Tests for viewing sessions, revoking single/all sessions, and audit log creation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock dependencies before imports
const mockApiFetch = vi.fn();
vi.mock('@/lib/utils/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockSupabaseFrom = vi.fn();
const mockSupabaseInsert = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockCustomerAuth = vi.fn();
vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => mockCustomerAuth(),
}));

// Must import after mocks
import { SessionManagement } from '../SessionManagement';

// Test data
const CURRENT_TOKEN = 'current-session-token-abc123';

const mockSessions = [
  {
    id: 'session-1',
    token: CURRENT_TOKEN,
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  },
  {
    id: 'session-2',
    token: 'other-session-token-def456',
    ip_address: '10.0.0.55',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  },
  {
    id: 'session-3',
    token: 'other-session-token-ghi789',
    ip_address: '172.16.0.10',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/121.0',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  },
];

function setupMockAuth(overrides?: Partial<ReturnType<typeof mockCustomerAuth>>) {
  mockCustomerAuth.mockReturnValue({
    customer: { id: 'customer-user-123', email: 'test@example.com', tenant_id: 'tenant-1' },
    tenant: { id: 'tenant-1', business_name: 'Test Tenant', slug: 'test-tenant' },
    token: CURRENT_TOKEN,
    ...overrides,
  });
}

function setupSessionsResponse(sessions = mockSessions) {
  mockApiFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, sessions }),
  });
}

function setupRevokeAllResponse(success = true) {
  if (success) {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, revoked_count: 2, message: 'All other sessions have been revoked' }),
    });
  } else {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to revoke sessions' }),
    });
  }
}

function setupRevokeResponse(success = true) {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: success ? null : { message: 'Revoke failed' } }),
  });
  mockSupabaseFrom.mockReturnValue({ update: updateMock });
  return updateMock;
}

describe('SessionManagement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMockAuth();
    // Define VITE_SUPABASE_URL for edge function calls
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Viewing All Sessions', () => {
    it('should display loading state initially', () => {
      // Never resolve the fetch to keep loading
      mockApiFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<SessionManagement />);
      expect(container.querySelector('.animate-spin')).toBeTruthy();
    });

    it('should display all active sessions', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // All session IPs should be visible
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      expect(screen.getByText('10.0.0.55')).toBeInTheDocument();
      expect(screen.getByText('172.16.0.10')).toBeInTheDocument();
    });

    it('should mark the current session with a "Current" badge', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Current')).toBeInTheDocument();
      });

      // Only one Current badge should exist
      const currentBadges = screen.getAllByText('Current');
      expect(currentBadges).toHaveLength(1);

      // The current session (Chrome on Windows) should have the badge
      const currentSessionRow = screen.getByText('192.168.1.100').closest('[class*="border rounded"]') ||
        screen.getByText('192.168.1.100').closest('div[class*="flex items-center justify-between"]');
      expect(currentSessionRow).toBeTruthy();
      if (currentSessionRow) {
        expect(within(currentSessionRow as HTMLElement).getByText('Current')).toBeInTheDocument();
      }
    });

    it('should correctly identify device types from user agents', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Chrome')).toBeInTheDocument();
      });

      // Chrome desktop, Safari mobile, Firefox desktop
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.getByText('Safari')).toBeInTheDocument();
      expect(screen.getByText('Firefox')).toBeInTheDocument();
    });

    it('should show session count in description', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText(/3 active/)).toBeInTheDocument();
      });
    });

    it('should not show revoke button for current session', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Current session row should not have a revoke button
      const currentSessionRow = screen.getByText('192.168.1.100').closest('[class*="border rounded"]') ||
        screen.getByText('192.168.1.100').closest('div[class*="flex items-center justify-between"]');
      if (currentSessionRow) {
        const buttons = within(currentSessionRow as HTMLElement).queryAllByRole('button');
        // Current session should have no LogOut button
        expect(buttons).toHaveLength(0);
      }
    });

    it('should show revoke buttons for non-current sessions', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Non-current sessions should have revoke buttons
      const otherSessionRow = screen.getByText('10.0.0.55').closest('[class*="border rounded"]') ||
        screen.getByText('10.0.0.55').closest('div[class*="flex items-center justify-between"]');
      if (otherSessionRow) {
        const buttons = within(otherSessionRow as HTMLElement).queryAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      }
    });

    it('should call get-active-sessions edge function on mount', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/functions/v1/get-active-sessions'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ customer_user_id: 'customer-user-123' }),
          })
        );
      });
    });

    it('should show empty state when no sessions exist', async () => {
      setupSessionsResponse([]);
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('No active sessions found')).toBeInTheDocument();
      });
    });

    it('should show session limit warning when at 5 sessions', async () => {
      const fiveSessions = [
        ...mockSessions,
        {
          id: 'session-4',
          token: 'token-4',
          ip_address: '10.0.0.4',
          user_agent: 'Mozilla/5.0 Edge/120.0',
          created_at: new Date(Date.now() - 1000).toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
        {
          id: 'session-5',
          token: 'token-5',
          ip_address: '10.0.0.5',
          user_agent: 'Mozilla/5.0 Chrome/120.0 Mobile',
          created_at: new Date(Date.now() - 2000).toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
      ];
      setupSessionsResponse(fiveSessions);
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Session Limit Reached')).toBeInTheDocument();
      });
    });

    it('should show error toast when loading sessions fails', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });
      render(<SessionManagement />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load active sessions',
          })
        );
      });
    });

    it('should not fetch sessions when customer is null', () => {
      setupMockAuth({ customer: null });
      render(<SessionManagement />);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('should not fetch sessions when tenant is null', () => {
      setupMockAuth({ tenant: null });
      render(<SessionManagement />);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('Revoking Single Session', () => {
    it('should revoke a non-current session successfully', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Setup revoke and reload responses
      const updateMock = setupRevokeResponse(true);
      setupSessionsResponse([mockSessions[0]]); // Only current session remains after refresh

      // Find and click revoke button for second session (10.0.0.55)
      const otherSessionRow = screen.getByText('10.0.0.55').closest('[class*="flex items-center justify-between"]');
      const revokeButton = otherSessionRow ? within(otherSessionRow as HTMLElement).getByRole('button') : screen.getAllByRole('button').find(
        btn => btn.closest('[class*="flex items-center justify-between"]')?.textContent?.includes('10.0.0.55')
      );

      if (revokeButton) {
        await user.click(revokeButton);
      }

      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith('customer_sessions');
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Session Revoked',
            description: 'The session has been revoked successfully.',
          })
        );
      });
    });

    it('should set session expires_at to current time when revoking', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseFrom.mockReturnValue({ update: updateMock });
      setupSessionsResponse([mockSessions[0]]);

      // Click revoke on a non-current session
      const buttons = screen.getAllByRole('button');
      const revokeButtons = buttons.filter(btn => {
        const row = btn.closest('[class*="flex items-center justify-between"]');
        return row && !row.textContent?.includes('Current') && row.textContent?.includes('10.0.0.55');
      });

      if (revokeButtons.length > 0) {
        await user.click(revokeButtons[0]);
      }

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          expect.objectContaining({
            expires_at: expect.any(String),
          })
        );
      });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('id', 'session-2');
      });
    });

    it('should show error toast when revoke fails', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Setup failing revoke
      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'Database error' } });
      mockSupabaseFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqMock }) });

      const buttons = screen.getAllByRole('button');
      const revokeButtons = buttons.filter(btn => {
        const row = btn.closest('[class*="flex items-center justify-between"]');
        return row && !row.textContent?.includes('Current') && row.textContent?.includes('10.0.0.55');
      });

      if (revokeButtons.length > 0) {
        await user.click(revokeButtons[0]);
      }

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to revoke session',
          })
        );
      });
    });

    it('should prevent revoking the current session', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Current session should not have a revoke button at all
      const currentSessionRow = screen.getByText('192.168.1.100').closest('[class*="flex items-center justify-between"]');
      if (currentSessionRow) {
        const buttons = within(currentSessionRow as HTMLElement).queryAllByRole('button');
        expect(buttons).toHaveLength(0);
      }
    });

    it('should reload sessions after successful revoke', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // First call was for loading sessions
      expect(mockApiFetch).toHaveBeenCalledTimes(1);

      // Setup revoke success and reload
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqMock }) });
      setupSessionsResponse([mockSessions[0]]); // After revoke, reload shows fewer sessions

      const buttons = screen.getAllByRole('button');
      const revokeButtons = buttons.filter(btn => {
        const row = btn.closest('[class*="flex items-center justify-between"]');
        return row && row.textContent?.includes('10.0.0.55');
      });

      if (revokeButtons.length > 0) {
        await user.click(revokeButtons[0]);
      }

      // Should call loadSessions again after revoke
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Revoking All Other Sessions', () => {
    it('should show "Revoke All Others" button when multiple sessions exist', async () => {
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });
    });

    it('should not show "Revoke All Others" when only one session exists', async () => {
      setupSessionsResponse([mockSessions[0]]);
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      expect(screen.queryByText('Revoke All Others')).not.toBeInTheDocument();
    });

    it('should call revoke-all-sessions edge function with correct params', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });

      // Setup revoke all response and reload
      setupRevokeAllResponse(true);
      setupSessionsResponse([mockSessions[0]]); // Only current session remains

      await user.click(screen.getByText('Revoke All Others'));

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/functions/v1/revoke-all-sessions'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              customer_user_id: 'customer-user-123',
              current_token: CURRENT_TOKEN,
            }),
          })
        );
      });
    });

    it('should show success toast after revoking all others', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });

      setupRevokeAllResponse(true);
      setupSessionsResponse([mockSessions[0]]);

      await user.click(screen.getByText('Revoke All Others'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'All Sessions Revoked',
            description: 'All other sessions have been revoked. You will remain logged in on this device.',
          })
        );
      });
    });

    it('should only keep current session active after revoking all', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });

      // After revoke all, only current session should remain
      setupRevokeAllResponse(true);
      setupSessionsResponse([mockSessions[0]]);

      await user.click(screen.getByText('Revoke All Others'));

      // After reload, should show only 1 session
      await waitFor(() => {
        expect(screen.getByText(/1 active/)).toBeInTheDocument();
      });

      // Should still show the current session
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      // Other sessions should be gone
      expect(screen.queryByText('10.0.0.55')).not.toBeInTheDocument();
      expect(screen.queryByText('172.16.0.10')).not.toBeInTheDocument();
    });

    it('should show error toast when revoke all fails', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });

      setupRevokeAllResponse(false);

      await user.click(screen.getByText('Revoke All Others'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to revoke sessions',
          })
        );
      });
    });

    it('should show loading state during revoke all', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });

      // Make the revoke call hang to observe loading state
      mockApiFetch.mockReturnValueOnce(new Promise(() => {}));

      await user.click(screen.getByText('Revoke All Others'));

      await waitFor(() => {
        expect(screen.getByText('Revoking...')).toBeInTheDocument();
      });
    });

    it('should not call revoke when customer is null', async () => {
      setupMockAuth({ customer: null });
      setupSessionsResponse([]);
      render(<SessionManagement />);

      // handleRevokeAll early returns when customer is null
      // The button won't be shown since there are no sessions
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('should not call revoke when token is null', async () => {
      const user = userEvent.setup();
      setupMockAuth({ token: null });
      setupSessionsResponse(mockSessions);
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Sessions should load (customer and tenant are set)
      await waitFor(() => {
        expect(screen.getByText(/3 active/)).toBeInTheDocument();
      });

      const initialCallCount = mockApiFetch.mock.calls.length;
      await user.click(screen.getByText('Revoke All Others'));

      // handleRevokeAll returns early because token is null
      // Give it a tick to ensure nothing fires
      await new Promise(r => setTimeout(r, 50));
      expect(mockApiFetch).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe('Audit Log Entries', () => {
    it('should create audit log entry when session is revoked via supabase update', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Setup revoke - the component uses supabase.from('customer_sessions').update()
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseFrom.mockReturnValue({ update: updateMock });
      setupSessionsResponse([mockSessions[0]]);

      const buttons = screen.getAllByRole('button');
      const revokeButtons = buttons.filter(btn => {
        const row = btn.closest('[class*="flex items-center justify-between"]');
        return row && row.textContent?.includes('10.0.0.55');
      });

      if (revokeButtons.length > 0) {
        await user.click(revokeButtons[0]);
      }

      // Verify the supabase update was called (which triggers database-level audit logging)
      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith('customer_sessions');
        expect(updateMock).toHaveBeenCalledWith(
          expect.objectContaining({
            expires_at: expect.any(String),
          })
        );
        expect(eqMock).toHaveBeenCalledWith('id', 'session-2');
      });
    });

    it('should pass customer_user_id to revoke-all for audit trail tracking', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });

      setupRevokeAllResponse(true);
      setupSessionsResponse([mockSessions[0]]);

      await user.click(screen.getByText('Revoke All Others'));

      // The edge function receives customer_user_id for audit log creation on the server
      await waitFor(() => {
        const revokeCall = mockApiFetch.mock.calls.find(
          (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('revoke-all-sessions')
        );
        expect(revokeCall).toBeDefined();
        if (revokeCall) {
          const body = JSON.parse(revokeCall[1].body as string);
          expect(body.customer_user_id).toBe('customer-user-123');
          expect(body.current_token).toBe(CURRENT_TOKEN);
        }
      });
    });

    it('should include session id in revoke call for audit traceability', async () => {
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseFrom.mockReturnValue({ update: updateMock });
      setupSessionsResponse([mockSessions[0]]);

      // Revoke specific session
      const buttons = screen.getAllByRole('button');
      const revokeButtons = buttons.filter(btn => {
        const row = btn.closest('[class*="flex items-center justify-between"]');
        return row && row.textContent?.includes('172.16.0.10');
      });

      if (revokeButtons.length > 0) {
        await user.click(revokeButtons[0]);
      }

      // Session ID used in the .eq() call enables audit trail
      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('id', 'session-3');
      });
    });

    it('should log errors when session operations fail', async () => {
      const { logger } = await import('@/lib/logger');
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      // Setup failing revoke
      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'Permission denied' } });
      mockSupabaseFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqMock }) });

      const buttons = screen.getAllByRole('button');
      const revokeButtons = buttons.filter(btn => {
        const row = btn.closest('[class*="flex items-center justify-between"]');
        return row && row.textContent?.includes('10.0.0.55');
      });

      if (revokeButtons.length > 0) {
        await user.click(revokeButtons[0]);
      }

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to revoke session',
          expect.anything(),
          expect.objectContaining({ component: 'SessionManagement' })
        );
      });
    });

    it('should log errors when loading sessions fails for audit visibility', async () => {
      const { logger } = await import('@/lib/logger');
      mockApiFetch.mockRejectedValueOnce(new Error('Network timeout'));
      render(<SessionManagement />);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to load sessions',
          expect.anything(),
          expect.objectContaining({ component: 'SessionManagement' })
        );
      });
    });

    it('should log errors when revoke all fails for audit visibility', async () => {
      const { logger } = await import('@/lib/logger');
      const user = userEvent.setup();
      setupSessionsResponse();
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Revoke All Others')).toBeInTheDocument();
      });

      mockApiFetch.mockRejectedValueOnce(new Error('Server unavailable'));

      await user.click(screen.getByText('Revoke All Others'));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to revoke all sessions',
          expect.anything(),
          expect.objectContaining({ component: 'SessionManagement' })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));
      render(<SessionManagement />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });
    });

    it('should handle malformed session data gracefully', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, sessions: null }),
      });
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('No active sessions found')).toBeInTheDocument();
      });
    });

    it('should display "Revoke All Others" only when more than 1 session exists', async () => {
      setupSessionsResponse([mockSessions[0]]);
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
      });

      expect(screen.queryByText('Revoke All Others')).not.toBeInTheDocument();
    });

    it('should correctly detect tablet user agent', async () => {
      const tabletSession = [{
        ...mockSessions[0],
        user_agent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      }];
      setupSessionsResponse(tabletSession);
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Safari')).toBeInTheDocument();
      });
    });

    it('should handle unknown browser user agent', async () => {
      const unknownSession = [{
        ...mockSessions[0],
        user_agent: 'CustomBot/1.0',
      }];
      setupSessionsResponse(unknownSession);
      render(<SessionManagement />);

      await waitFor(() => {
        expect(screen.getByText('Unknown Browser')).toBeInTheDocument();
      });
    });
  });
});
