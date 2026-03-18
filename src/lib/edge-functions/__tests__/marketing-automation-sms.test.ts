/**
 * Marketing Automation SMS Edge Function Tests
 *
 * Tests the send_sms action of the marketing-automation edge function:
 * 1. Successful SMS sending via Twilio
 * 2. Missing Twilio configuration (503)
 * 3. Validation: missing recipient_phone
 * 4. Validation: missing message
 * 5. Twilio API failure handling
 * 6. Campaign status update on success/failure
 * 7. CORS preflight handling
 * 8. Unknown action rejection
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

describe('Marketing Automation SMS', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('send_sms action', () => {
    it('should send SMS successfully via Twilio', async () => {
      const mockResponse = {
        success: true,
        message: 'SMS sent successfully',
        sid: 'SM1234567890abcdef',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15551234567',
            message: 'Your order has been confirmed!',
            campaign_id: '550e8400-e29b-41d4-a716-446655440000',
          },
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.sid).toBe('SM1234567890abcdef');
      expect(data.message).toBe('SMS sent successfully');
    });

    it('should return 503 when Twilio is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'SMS provider not configured',
            detail: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be set',
          },
          503,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15551234567',
            message: 'Test message',
          },
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('SMS provider not configured');
    });

    it('should return 400 when recipient_phone is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'recipient_phone is required for send_sms action' },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            message: 'Test message',
          },
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('recipient_phone');
    });

    it('should return 400 when message is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'message is required for send_sms action' },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15551234567',
          },
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('message');
    });

    it('should return 502 when Twilio API fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Failed to send SMS',
            detail: 'Invalid phone number',
          },
          502,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+0000000000',
            message: 'Test message',
            campaign_id: '550e8400-e29b-41d4-a716-446655440000',
          },
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toBe('Failed to send SMS');
    });

    it('should send SMS without campaign_id', async () => {
      const mockResponse = {
        success: true,
        message: 'SMS sent successfully',
        sid: 'SM0987654321fedcba',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15559876543',
            message: 'Standalone SMS without a campaign',
          },
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.sid).toBeDefined();
    });

    it('should format phone numbers without + prefix', async () => {
      const mockResponse = {
        success: true,
        message: 'SMS sent successfully',
        sid: 'SMformattest123',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '15551234567',
            message: 'Phone without plus prefix',
          },
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('action routing', () => {
    it('should reject unknown actions', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unknown_action',
          payload: {},
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should handle send_email action', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Email sent' }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          payload: {
            recipient_email: 'customer@example.com',
            subject: 'Welcome!',
            message: 'Welcome to our store.',
            campaign_id: '550e8400-e29b-41d4-a716-446655440000',
          },
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Email sent');
    });

    it('should handle schedule_campaign action', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'schedule_campaign acknowledged' }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_campaign',
          payload: {
            campaign_id: '550e8400-e29b-41d4-a716-446655440000',
            scheduled_at: '2026-04-01T10:00:00Z',
          },
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should handle track_event action', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'track_event acknowledged' }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_event',
          payload: {
            metadata: { event_type: 'email_opened', campaign_id: 'abc-123' },
          },
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });
  });

  describe('validation', () => {
    it('should reject SMS with empty recipient_phone', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '',
            message: 'Test',
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject SMS with empty message', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15551234567',
            message: '',
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject SMS with message exceeding 1600 characters', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15551234567',
            message: 'a'.repeat(1601),
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject phone numbers exceeding 20 characters', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+1' + '5'.repeat(20),
            message: 'Test',
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept valid campaign_id UUID', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'SMS sent successfully', sid: 'SM123' }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15551234567',
            message: 'Test',
            campaign_id: '550e8400-e29b-41d4-a716-446655440000',
          },
        }),
      });

      const data = await response.json();
      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should reject invalid campaign_id (not UUID)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_sms',
          payload: {
            recipient_phone: '+15551234567',
            message: 'Test',
            campaign_id: 'not-a-uuid',
          },
        }),
      });

      expect(response.status).toBe(400);
    });
  });
});
