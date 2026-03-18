/**
 * AdminNotifications Tests
 * Tests for SMS and email notification testing page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { messageId: 'msg-123' }, error: null }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Cannabis Co' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import AdminNotifications from '../AdminNotifications';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/test-tenant/admin/notifications']}>
    {children}
  </MemoryRouter>
);

describe('AdminNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { messageId: 'msg-123' },
      error: null,
    });
  });

  it('renders page title and tabs', () => {
    render(<AdminNotifications />, { wrapper });
    expect(screen.getByText('Test Notifications')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders SMS tab content by default', () => {
    render(<AdminNotifications />, { wrapper });
    expect(screen.getByText('Test SMS Message')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  describe('SMS validation', () => {
    it('shows error when phone is empty', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Send Test SMS'));

      expect(toast.error).toHaveBeenCalledWith('Phone number required', {
        description: 'Please enter a phone number to send SMS',
      });
    });

    it('shows error for invalid phone format', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.type(screen.getByLabelText('Phone Number'), '123456');
      await user.click(screen.getByText('Send Test SMS'));

      expect(toast.error).toHaveBeenCalledWith('Invalid phone format', {
        description: 'Phone must start with country code (e.g., +1 for US) and contain 10-15 digits',
      });
    });

    it('shows error when message is empty', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.type(screen.getByLabelText('Phone Number'), '+12345678901');
      await user.click(screen.getByText('Send Test SMS'));

      expect(toast.error).toHaveBeenCalledWith('Message required', {
        description: 'Please enter a message to send',
      });
    });

    it('shows warning for long SMS messages', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.type(screen.getByLabelText('Phone Number'), '+12345678901');
      const longMessage = 'A'.repeat(161);
      await user.type(screen.getByLabelText('Message'), longMessage);
      await user.click(screen.getByText('Send Test SMS'));

      expect(toast.warning).toHaveBeenCalledWith('Message may be split', expect.objectContaining({
        description: expect.stringContaining('161 characters'),
      }));
    });

    it('displays character count and SMS segment info', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.type(screen.getByLabelText('Message'), 'Hello');
      expect(screen.getByText('5/1600 characters')).toBeInTheDocument();
    });
  });

  describe('SMS sending', () => {
    it('sends SMS successfully and clears form', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.type(screen.getByLabelText('Phone Number'), '+12345678901');
      await user.type(screen.getByLabelText('Message'), 'Test message');
      await user.click(screen.getByText('Send Test SMS'));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('send-klaviyo-sms', {
          body: {
            phone: '+12345678901',
            message: 'Test message',
            metadata: expect.objectContaining({ test: true }),
          },
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('SMS sent successfully!', {
          description: 'Message ID: msg-123',
        });
      });
    });

    it('handles SMS API error', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: new Error('Network failure'),
      });

      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.type(screen.getByLabelText('Phone Number'), '+12345678901');
      await user.type(screen.getByLabelText('Message'), 'Test');
      await user.click(screen.getByText('Send Test SMS'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe('Email tab', () => {
    it('switches to email tab and renders fields', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));

      await waitFor(() => {
        expect(screen.getByText('Test Email')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('To Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Subject')).toBeInTheDocument();
      expect(screen.getByLabelText('HTML Content')).toBeInTheDocument();
      expect(screen.getByLabelText('Plain Text Content')).toBeInTheDocument();
    });
  });

  describe('Email validation', () => {
    it('shows error when recipient email is empty', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));
      await user.click(screen.getByText('Send Test Email'));

      expect(toast.error).toHaveBeenCalledWith('Recipient required', {
        description: 'Please enter a recipient email address',
      });
    });

    it('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));
      await user.type(screen.getByLabelText('To Email'), 'not-an-email');
      await user.click(screen.getByText('Send Test Email'));

      expect(toast.error).toHaveBeenCalledWith('Invalid email format', {
        description: 'Please enter a valid email address',
      });
    });

    it('shows error when subject is empty', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));
      await user.type(screen.getByLabelText('To Email'), 'test@example.com');
      await user.click(screen.getByText('Send Test Email'));

      expect(toast.error).toHaveBeenCalledWith('Subject required', {
        description: 'Please enter an email subject line',
      });
    });

    it('shows error when both content fields are empty', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));
      await user.type(screen.getByLabelText('To Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test Subject');
      await user.click(screen.getByText('Send Test Email'));

      expect(toast.error).toHaveBeenCalledWith('Content required', {
        description: 'Please enter HTML or plain text content',
      });
    });
  });

  describe('Email sending', () => {
    it('sends email with tenant business name as fromName', async () => {
      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));
      await user.type(screen.getByLabelText('To Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test Subject');
      await user.type(screen.getByLabelText('Plain Text Content'), 'Hello world');
      await user.click(screen.getByText('Send Test Email'));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('send-klaviyo-email', {
          body: expect.objectContaining({
            to: 'test@example.com',
            subject: 'Test Subject',
            text: 'Hello world',
            fromEmail: 'noreply@floraiq.com',
            fromName: 'Test Cannabis Co',
          }),
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Email sent successfully!', {
          description: 'Message ID: msg-123',
        });
      });
    });

    it('handles email API error with categorized message', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: new Error('Klaviyo API rate limit exceeded'),
      });

      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));
      await user.type(screen.getByLabelText('To Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test');
      await user.type(screen.getByLabelText('Plain Text Content'), 'Hello');
      await user.click(screen.getByText('Send Test Email'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('handles error in response body', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Invalid API key' },
        error: null,
      });

      const user = userEvent.setup();
      render(<AdminNotifications />, { wrapper });

      await user.click(screen.getByText('Email'));
      await user.type(screen.getByLabelText('To Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Subject'), 'Test');
      await user.type(screen.getByLabelText('Plain Text Content'), 'Hello');
      await user.click(screen.getByText('Send Test Email'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });
});
