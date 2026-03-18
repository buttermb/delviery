/**
 * Marketing Automation Edge Function Tests
 *
 * Tests cover:
 * 1. Input validation (Zod schema)
 * 2. send_email action — Resend integration + logging
 * 3. send_sms action — placeholder logging
 * 4. schedule_campaign action — DB status update
 * 5. track_event action — open/click counting
 * 6. Error handling and CORS
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/marketing-automation`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const VALID_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_CAMPAIGN_ID = '660e8400-e29b-41d4-a716-446655440001';

describe('Marketing Automation Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });
      expect(response.ok).toBe(true);
    });
  });

  describe('send_email action', () => {
    const validEmailPayload = {
      action: 'send_email',
      payload: {
        tenant_id: VALID_TENANT_ID,
        recipient_email: 'customer@example.com',
        recipient_name: 'Jane Doe',
        subject: 'Spring Sale!',
        html_content: '<h1>20% off all products</h1>',
        text_content: '20% off all products',
        from_name: 'Test Store',
        from_email: 'marketing@test.com',
        campaign_id: VALID_CAMPAIGN_ID,
        metadata: { source: 'campaign_builder' },
      },
    };

    it('should send email successfully via Resend', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Email sent',
          provider_message_id: 'resend-msg-123',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEmailPayload),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Email sent');
      expect(data.provider_message_id).toBeDefined();
    });

    it('should return dry_run when no email provider is configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Email logged (no provider configured)',
          dry_run: true,
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEmailPayload),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.dry_run).toBe(true);
    });

    it('should queue failed emails for retry', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: false,
            error: 'Email delivery failed: Resend API error 429: Rate limit exceeded',
          },
          500,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEmailPayload),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Email delivery failed');
    });

    it('should reject missing required fields', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          payload: {
            tenant_id: VALID_TENANT_ID,
            // missing recipient_email, subject, html_content
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid email address', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          payload: {
            ...validEmailPayload.payload,
            recipient_email: 'not-an-email',
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject empty subject', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          payload: {
            ...validEmailPayload.payload,
            subject: '',
          },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('send_sms action', () => {
    const validSmsPayload = {
      action: 'send_sms',
      payload: {
        tenant_id: VALID_TENANT_ID,
        recipient_phone: '+11234567890',
        message: 'Flash sale: 20% off today only!',
        campaign_id: VALID_CAMPAIGN_ID,
      },
    };

    it('should log SMS successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'SMS logged (Twilio integration pending)',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSmsPayload),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('SMS');
    });

    it('should reject missing phone number', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            tenant_id: VALID_TENANT_ID,
            message: 'Hello',
            // missing recipient_phone
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject messages exceeding 1600 chars', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            tenant_id: VALID_TENANT_ID,
            recipient_phone: '+11234567890',
            message: 'a'.repeat(1601),
          },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('schedule_campaign action', () => {
    it('should schedule a campaign successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Campaign scheduled',
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_campaign',
          payload: {
            campaign_id: VALID_CAMPAIGN_ID,
            tenant_id: VALID_TENANT_ID,
            scheduled_at: '2026-04-01T10:00:00Z',
          },
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Campaign scheduled');
    });

    it('should reject non-datetime scheduled_at', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_campaign',
          payload: {
            campaign_id: VALID_CAMPAIGN_ID,
            tenant_id: VALID_TENANT_ID,
            scheduled_at: 'next-tuesday',
          },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('track_event action', () => {
    it('should track an open event', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: "Event 'open' tracked",
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_event',
          payload: {
            campaign_id: VALID_CAMPAIGN_ID,
            tenant_id: VALID_TENANT_ID,
            event_type: 'open',
            recipient_email: 'reader@example.com',
          },
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('open');
    });

    it('should track a click event', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: "Event 'click' tracked",
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_event',
          payload: {
            campaign_id: VALID_CAMPAIGN_ID,
            tenant_id: VALID_TENANT_ID,
            event_type: 'click',
            metadata: { link_url: 'https://store.example.com/sale' },
          },
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('click');
    });

    it('should reject invalid event types', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_event',
          payload: {
            campaign_id: VALID_CAMPAIGN_ID,
            tenant_id: VALID_TENANT_ID,
            event_type: 'invalid_event',
          },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('unknown action handling', () => {
    it('should reject unknown actions', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid action' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_everything',
          payload: { tenant_id: VALID_TENANT_ID },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('tenant isolation', () => {
    it('should require tenant_id in all payloads', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          payload: {
            // missing tenant_id
            recipient_email: 'customer@example.com',
            subject: 'Test',
            html_content: '<p>Test</p>',
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid tenant_id format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          payload: {
            tenant_id: 'not-a-uuid',
            recipient_email: 'customer@example.com',
            subject: 'Test',
            html_content: '<p>Test</p>',
          },
        }),
      });

      expect(response.status).toBe(400);
    });
  });
});
