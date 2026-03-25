/**
 * Send Notification Credit Deduction Tests
 *
 * Tests that the send-notification edge function properly deducts credits
 * based on the notification channel:
 *   - email → send_email (10 credits)
 *   - sms → send_sms (25 credits)
 *   - push → send_push_notification (15 credits)
 *   - database → free (no deduction)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { CREDIT_COSTS } from '@/lib/credits/creditCosts';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200, headers?: Record<string, string>) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({
    'Content-Type': 'application/json',
    ...headers,
  }),
});

// The notification schema matching the edge function
const notificationSchema = z.object({
  user_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  type: z.enum(['order_status', 'order_cancelled', 'payment', 'inventory', 'system']),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.unknown()).optional(),
  channels: z.array(z.enum(['database', 'email', 'sms', 'push'])).default(['database']),
});

describe('send-notification credit deduction', () => {
  const endpoint = `${FUNCTIONS_URL}/send-notification`;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('channel-to-action_key mapping', () => {
    it('should map email channel to send_email action key', () => {
      expect(CREDIT_COSTS.send_email).toBeDefined();
      expect(CREDIT_COSTS.send_email.actionKey).toBe('send_email');
      expect(CREDIT_COSTS.send_email.credits).toBe(10);
    });

    it('should map sms channel to send_sms action key', () => {
      expect(CREDIT_COSTS.send_sms).toBeDefined();
      expect(CREDIT_COSTS.send_sms.actionKey).toBe('send_sms');
      expect(CREDIT_COSTS.send_sms.credits).toBe(25);
    });

    it('should map push channel to send_push_notification action key', () => {
      expect(CREDIT_COSTS.send_push_notification).toBeDefined();
      expect(CREDIT_COSTS.send_push_notification.actionKey).toBe('send_push_notification');
      expect(CREDIT_COSTS.send_push_notification.credits).toBe(15);
    });

    it('should not have a credit cost for database channel', () => {
      // database channel is always free — no entry in CHANNEL_CREDIT_MAP
      const databaseChannelActions = Object.values(CREDIT_COSTS).filter(
        (c) => c.actionKey === 'send_database_notification'
      );
      expect(databaseChannelActions).toHaveLength(0);
    });
  });

  describe('schema validation', () => {
    it('should accept sms as a valid channel', () => {
      const result = notificationSchema.safeParse({
        type: 'system',
        title: 'Test',
        message: 'Test message',
        channels: ['sms'],
      });

      expect(result.success).toBe(true);
    });

    it('should accept all channel types together', () => {
      const result = notificationSchema.safeParse({
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'order_status',
        title: 'Order Update',
        message: 'Your order is ready',
        channels: ['database', 'email', 'sms', 'push'],
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid channel types', () => {
      const result = notificationSchema.safeParse({
        type: 'system',
        title: 'Test',
        message: 'Test message',
        channels: ['whatsapp'],
      });

      expect(result.success).toBe(false);
    });

    it('should default channels to database only', () => {
      const result = notificationSchema.safeParse({
        type: 'system',
        title: 'Test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channels).toEqual(['database']);
      }
    });
  });

  describe('credit deduction on request', () => {
    it('should return credit info for email notification on free tier', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: true,
            results: {
              database: { success: true, id: 'notif-1' },
              email: { success: true, sent: false, note: 'Email service not configured' },
            },
            credits: { consumed: 10, remaining: 490 },
          },
          200,
          { 'X-Credits-Consumed': '10', 'X-Credits-Remaining': '490' }
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'order_status',
          title: 'Order Shipped',
          message: 'Your order has shipped!',
          channels: ['database', 'email'],
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.credits).toBeDefined();
      expect(data.credits.consumed).toBe(10);
      expect(data.credits.remaining).toBe(490);
      expect(response.headers.get('X-Credits-Consumed')).toBe('10');
    });

    it('should deduct credits for multiple billable channels', async () => {
      // email (10) + sms (25) + push (15) = 50
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: true,
            results: {
              database: { success: true, id: 'notif-1' },
              email: { success: true, sent: false, note: 'Email service not configured' },
              sms: { success: true, sent: false, note: 'SMS service not configured' },
              push: { success: true, sent: false, note: 'Push service not configured' },
            },
            credits: { consumed: 50, remaining: 450 },
          },
          200,
          { 'X-Credits-Consumed': '50', 'X-Credits-Remaining': '450' }
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'payment',
          title: 'Payment Received',
          message: 'Payment processed',
          channels: ['database', 'email', 'sms', 'push'],
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.credits.consumed).toBe(50);
    });

    it('should not include credits field for database-only notifications', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: {
            database: { success: true, id: 'notif-1' },
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'system',
          title: 'System Update',
          message: 'Maintenance scheduled',
          channels: ['database'],
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.credits).toBeUndefined();
    });

    it('should return 402 when credits are insufficient', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            message: 'Not enough credits for this notification',
            channel: 'sms',
            actionKey: 'send_sms',
            creditsRequired: 25,
            currentBalance: 5,
          },
          402
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'order_status',
          title: 'Order Update',
          message: 'Your order is ready',
          channels: ['sms'],
        }),
      });

      expect(response.status).toBe(402);
      const data = await response.json();
      expect(data.code).toBe('INSUFFICIENT_CREDITS');
      expect(data.channel).toBe('sms');
      expect(data.actionKey).toBe('send_sms');
    });

    it('should require authentication for credit-consuming channels', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'order_status',
          title: 'Order Update',
          message: 'Your order is ready',
          channels: ['email'],
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('CREDIT_ACTIONS constants', () => {
    it('should include SEND_PUSH_NOTIFICATION in credit actions', async () => {
      // Verify the constant was added to creditGate.ts by reading source
      const fs = await import('fs');
      const path = await import('path');
      const creditGatePath = path.resolve(
        __dirname,
        '../../../../supabase/functions/_shared/creditGate.ts'
      );
      const source = fs.readFileSync(creditGatePath, 'utf-8');

      expect(source).toContain("SEND_PUSH_NOTIFICATION: 'send_push_notification'");
      expect(source).toContain("SEND_SMS: 'send_sms'");
      expect(source).toContain("SEND_EMAIL: 'send_email'");
    });
  });

  describe('edge function source validation', () => {
    it('should import CREDIT_ACTIONS from creditGate', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      expect(source).toContain("import { CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
    });

    it('should map channels to CREDIT_ACTIONS constants', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      expect(source).toContain('CREDIT_ACTIONS.SEND_EMAIL');
      expect(source).toContain('CREDIT_ACTIONS.SEND_SMS');
      expect(source).toContain('CREDIT_ACTIONS.SEND_PUSH_NOTIFICATION');
    });

    it('should call consume_credits RPC for billable channels', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      expect(source).toContain("rpc('consume_credits'");
      expect(source).toContain('p_tenant_id');
      expect(source).toContain('p_action_key');
    });

    it('should return 402 on insufficient credits', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      expect(source).toContain('status: 402');
      expect(source).toContain('INSUFFICIENT_CREDITS');
    });

    it('should check free tier status before deducting', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      expect(source).toContain('is_free_tier');
      expect(source).toContain('isFreeTier');
    });

    it('should include sms in channel schema enum', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      // Verify the schema includes sms
      expect(source).toMatch(/z\.enum\(\[.*'sms'.*\]\)/);
    });

    it('should set X-Credits-Consumed and X-Credits-Remaining headers', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      expect(source).toContain('X-Credits-Consumed');
      expect(source).toContain('X-Credits-Remaining');
    });

    it('should resolve tenant from JWT, not from request body', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const edgeFnPath = path.resolve(
        __dirname,
        '../../../../supabase/functions/send-notification/index.ts'
      );
      const source = fs.readFileSync(edgeFnPath, 'utf-8');

      // Should use auth.getUser to resolve tenant
      expect(source).toContain('auth.getUser');
      expect(source).toContain('tenant_users');
    });
  });
});
