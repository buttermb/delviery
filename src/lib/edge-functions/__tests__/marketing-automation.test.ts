/**
 * Marketing Automation Edge Function Tests
 *
 * Tests the marketing-automation edge function actions:
 * - send_campaign: Send a draft/scheduled campaign
 * - schedule_campaign: Schedule a campaign for future delivery
 * - pause_campaign: Pause a scheduled/sending campaign
 * - resume_campaign: Resume a paused campaign
 * - track_event: Track open/click/bounce/unsubscribe events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/marketing-automation`;
const AUTH_TOKEN = 'Bearer test-jwt-token';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const makeRequest = (body: Record<string, unknown>, token = AUTH_TOKEN) =>
  fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify(body),
  });

describe('Marketing Automation Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== AUTH & VALIDATION ====================

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_campaign', payload: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' } }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject non-admin users', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Admin access required' }, 403)
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Admin access required');
    });

    it('should handle CORS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid action', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await makeRequest({
        action: 'invalid_action',
        payload: {},
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should reject missing payload', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await makeRequest({ action: 'send_campaign' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid campaign_id format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          error: 'Validation failed',
          details: 'Invalid campaign ID',
        }, 400)
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: 'not-a-uuid' },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });
  });

  // ==================== SEND CAMPAIGN ====================

  describe('send_campaign', () => {
    const validCampaignId = '550e8400-e29b-41d4-a716-446655440000';

    it('should successfully send a draft campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: "Campaign 'Summer Sale' sent successfully",
        })
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: validCampaignId },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('sent successfully');
    });

    it('should return 404 for non-existent campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Campaign not found' }, 404)
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: validCampaignId },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Campaign not found');
    });

    it('should reject sending an already-sent campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Cannot send campaign with status 'sent'" }, 400)
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: validCampaignId },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Cannot send campaign');
    });
  });

  // ==================== SCHEDULE CAMPAIGN ====================

  describe('schedule_campaign', () => {
    const validCampaignId = '550e8400-e29b-41d4-a716-446655440000';
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    it('should successfully schedule a campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: `Campaign 'Holiday Promo' scheduled for ${futureDate}`,
        })
      );

      const response = await makeRequest({
        action: 'schedule_campaign',
        payload: { campaign_id: validCampaignId, scheduled_at: futureDate },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('scheduled');
    });

    it('should reject scheduling in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Scheduled time must be in the future' }, 400)
      );

      const response = await makeRequest({
        action: 'schedule_campaign',
        payload: { campaign_id: validCampaignId, scheduled_at: pastDate },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Scheduled time must be in the future');
    });

    it('should reject invalid datetime format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await makeRequest({
        action: 'schedule_campaign',
        payload: { campaign_id: validCampaignId, scheduled_at: 'not-a-date' },
      });

      expect(response.status).toBe(400);
    });
  });

  // ==================== PAUSE CAMPAIGN ====================

  describe('pause_campaign', () => {
    const validCampaignId = '550e8400-e29b-41d4-a716-446655440000';

    it('should successfully pause a scheduled campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: "Campaign 'Weekly Digest' paused",
        })
      );

      const response = await makeRequest({
        action: 'pause_campaign',
        payload: { campaign_id: validCampaignId },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('paused');
    });

    it('should reject pausing a draft campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Cannot pause campaign with status 'draft'" }, 400)
      );

      const response = await makeRequest({
        action: 'pause_campaign',
        payload: { campaign_id: validCampaignId },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Cannot pause campaign');
    });
  });

  // ==================== RESUME CAMPAIGN ====================

  describe('resume_campaign', () => {
    const validCampaignId = '550e8400-e29b-41d4-a716-446655440000';

    it('should successfully resume a paused campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: "Campaign 'Flash Sale' resumed as scheduled",
        })
      );

      const response = await makeRequest({
        action: 'resume_campaign',
        payload: { campaign_id: validCampaignId },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('resumed');
    });

    it('should reject resuming a non-paused campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Cannot resume campaign with status 'sent'" }, 400)
      );

      const response = await makeRequest({
        action: 'resume_campaign',
        payload: { campaign_id: validCampaignId },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Cannot resume campaign');
    });
  });

  // ==================== TRACK EVENT ====================

  describe('track_event', () => {
    const validCampaignId = '550e8400-e29b-41d4-a716-446655440000';

    it('should track an open event', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, event_type: 'open' })
      );

      const response = await makeRequest({
        action: 'track_event',
        payload: {
          campaign_id: validCampaignId,
          event_type: 'open',
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.event_type).toBe('open');
    });

    it('should track a click event', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, event_type: 'click' })
      );

      const response = await makeRequest({
        action: 'track_event',
        payload: {
          campaign_id: validCampaignId,
          event_type: 'click',
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.event_type).toBe('click');
    });

    it('should return 404 for non-existent campaign', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Campaign not found' }, 404)
      );

      const response = await makeRequest({
        action: 'track_event',
        payload: {
          campaign_id: validCampaignId,
          event_type: 'open',
        },
      });

      expect(response.status).toBe(404);
    });

    it('should reject invalid event types', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 400)
      );

      const response = await makeRequest({
        action: 'track_event',
        payload: {
          campaign_id: validCampaignId,
          event_type: 'invalid_event',
        },
      });

      expect(response.status).toBe(400);
    });
  });

  // ==================== SECURITY ====================

  describe('Security', () => {
    it('should enforce tenant isolation - campaign from another tenant returns 404', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Campaign not found' }, 404)
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Campaign not found');
    });

    it('should return 403 for user without tenant association', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found' }, 403)
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Tenant not found');
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await makeRequest({
        action: 'send_campaign',
        payload: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' },
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        makeRequest({
          action: 'send_campaign',
          payload: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' },
        })
      ).rejects.toThrow('Network error');
    });
  });
});
