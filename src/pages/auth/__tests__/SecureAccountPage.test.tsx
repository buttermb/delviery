/**
 * Tests for SecureAccountPage component
 * Tests token handling, status rendering, and error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SecureAccountPage } from '../SecureAccountPage';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock supabase client
const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/auth/secure-account${search}`]}>
      <SecureAccountPage />
    </MemoryRouter>,
  );
}

describe('SecureAccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error when no token is provided', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Security Action Failed')).toBeInTheDocument();
    });
    expect(screen.getByText('No security token provided.')).toBeInTheDocument();
  });

  it('shows loading state initially with a valid token', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage('?token=test-token');

    expect(screen.getByText('Securing Your Account...')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we secure your account.')).toBeInTheDocument();
  });

  it('shows success state when account is secured', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, message: 'Account secured.' },
      error: null,
    });

    renderPage('?token=valid-token');

    await waitFor(() => {
      expect(screen.getByText('Account Secured')).toBeInTheDocument();
    });
    expect(screen.getByText('Your account has been secured successfully.')).toBeInTheDocument();
    expect(screen.getByText('All sessions have been terminated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In & Change Password/i })).toBeInTheDocument();
  });

  it('calls supabase.functions.invoke with correct args', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    renderPage('?token=my-security-token');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('secure-account', {
        body: { action: 'secure', token: 'my-security-token' },
      });
    });
  });

  it('shows error state on function error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Function invocation failed' },
    });

    renderPage('?token=bad-token');

    await waitFor(() => {
      expect(screen.getByText('Security Action Failed')).toBeInTheDocument();
    });
  });

  it('shows expired state when error includes "expired"', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Token has expired' },
      error: null,
    });

    renderPage('?token=expired-token');

    await waitFor(() => {
      expect(screen.getByText('Link Expired')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/This security link has expired/)
    ).toBeInTheDocument();
  });

  it('shows generic error when response is unsuccessful without "expired"', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Invalid or expired security token' },
      error: null,
    });

    renderPage('?token=invalid-token');

    await waitFor(() => {
      // "expired" is in the error message, so it should show "expired" state
      expect(screen.getByText('Link Expired')).toBeInTheDocument();
    });
  });

  it('navigates to /login when clicking Sign In button after success', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    renderPage('?token=valid-token');

    await waitFor(() => {
      expect(screen.getByText('Account Secured')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Sign In & Change Password/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('navigates to /login when clicking Go to Sign In button after error', async () => {
    renderPage(); // no token → error state

    await waitFor(() => {
      expect(screen.getByText('Security Action Failed')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Go to Sign In/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows recommendation to change password on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    renderPage('?token=valid-token');

    await waitFor(() => {
      expect(
        screen.getByText(/recommend changing your password immediately/)
      ).toBeInTheDocument();
    });
  });
});
