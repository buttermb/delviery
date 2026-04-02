/**
 * Send Push Notification — Edge Function Tests
 *
 * Tests the send-push-notification edge function for:
 * 1. Input validation (missing fields)
 * 2. Notification preference logic (defaults, opt-out, critical-only)
 * 3. Tenant isolation (tenant_id filter on push_tokens query)
 * 4. FCM payload structure
 * 5. Token deactivation on invalid tokens
 * 6. Notification logging
 * 7. Response format
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('send-push-notification edge function', () => {
  const source = readEdgeFunctionSource();

  describe('input validation', () => {
    it('should validate required fields: userId, title, body', () => {
      expect(source).toContain('!userId || !title || !body');
    });

    it('should return 400 for missing required fields', () => {
      expect(source).toContain('status: 400');
      expect(source).toContain("Missing required fields: userId, title, body");
    });

    it('should parse userId, title, body, data from request JSON', () => {
      expect(source).toContain('const { userId, title, body, data } = await req.json()');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
      expect(source).toContain('corsHeaders');
    });

    it('should include corsHeaders in all responses', () => {
      // Count corsHeaders appearances - should be in every Response
      const corsCount = (source.match(/corsHeaders/g) || []).length;
      expect(corsCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('notification preferences logic', () => {
    it('should query notification_preferences by user_id', () => {
      expect(source).toContain("from('notification_preferences')");
      expect(source).toContain("eq('user_id', userId)");
    });

    it('should use .maybeSingle() for optional preferences', () => {
      expect(source).toContain('.maybeSingle()');
      expect(source).not.toContain('.single()');
    });

    it('should default pushEnabled to true when prefs is null', () => {
      // push_enabled !== false is true when prefs is null (undefined !== false)
      expect(source).toContain("prefs?.push_enabled !== false");
    });

    it('should allow push when prefs is null (no preferences row)', () => {
      // The !prefs check ensures null prefs defaults to allowing push
      expect(source).toContain('!prefs || prefs.push_all_updates');
    });

    it('should allow push when push_all_updates is true', () => {
      expect(source).toContain('prefs.push_all_updates');
    });

    it('should allow critical push when push_critical_only is true and notification is critical', () => {
      expect(source).toContain("data?.critical === true");
      expect(source).toContain('prefs.push_critical_only && isCritical');
    });

    it('should skip push and return success with skipped flag when not allowed', () => {
      expect(source).toContain("skipped: true");
      expect(source).toContain("reason: 'User preferences'");
    });

    it('should select push_enabled, push_all_updates, push_critical_only fields', () => {
      expect(source).toContain("'push_enabled, push_all_updates, push_critical_only'");
    });
  });

  describe('notification preference default behavior (regression)', () => {
    it('should NOT block push when prefs row is null (no user preferences)', () => {
      // This is the critical fix: when prefs is null, the old logic
      // evaluated to false because prefs?.push_all_updates was undefined.
      // The fix adds !prefs to the condition to default to allowing push.
      const allowPushLine = source.match(/const allowPush = .+;/)?.[0] || '';
      expect(allowPushLine).toContain('!prefs');
    });

    it('should block push when push_enabled is explicitly false', () => {
      // When prefs.push_enabled === false, pushEnabled should be false
      expect(source).toContain("prefs?.push_enabled !== false");
    });

    it('should block push when prefs exist but neither push_all_updates nor push_critical_only is set', () => {
      // When prefs exists with push_enabled=true but push_all_updates=false
      // and push_critical_only=false and notification is not critical,
      // allowPush should be false
      const allowPushLine = source.match(/const allowPush = .+;/)?.[0] || '';
      // !prefs is false (prefs exists), prefs.push_all_updates is false,
      // prefs.push_critical_only is false → allowPush = false
      expect(allowPushLine).toContain('pushEnabled');
      expect(allowPushLine).toContain('!prefs || prefs.push_all_updates');
    });
  });

  describe('tenant isolation', () => {
    it('should use tenantId parameter (not prefixed with underscore)', () => {
      expect(source).toContain('async (tenantId, supabase)');
      expect(source).not.toContain('async (_tenantId');
    });

    it('should filter push_tokens query by tenant_id', () => {
      // Extract the push_tokens query block
      const pushTokensSection = source.slice(
        source.indexOf("from('push_tokens')"),
        source.indexOf('.eq(\'is_active\'') + 30
      );
      expect(pushTokensSection).toContain("eq('tenant_id', tenantId)");
    });

    it('should filter push_tokens by user_id, tenant_id, and is_active', () => {
      const pushTokensSection = source.slice(
        source.indexOf("from('push_tokens')"),
        source.indexOf('.eq(\'is_active\'') + 30
      );
      expect(pushTokensSection).toContain("eq('user_id', userId)");
      expect(pushTokensSection).toContain("eq('tenant_id', tenantId)");
      expect(pushTokensSection).toContain("eq('is_active', true)");
    });
  });

  describe('FCM integration', () => {
    it('should read FCM_SERVER_KEY from environment', () => {
      expect(source).toContain("Deno.env.get('FCM_SERVER_KEY')");
    });

    it('should send to FCM API endpoint', () => {
      expect(source).toContain('https://fcm.googleapis.com/fcm/send');
    });

    it('should include Authorization header with FCM key', () => {
      expect(source).toContain('`key=${fcmServerKey}`');
    });

    it('should construct proper FCM payload with notification and data', () => {
      expect(source).toContain('notification: {');
      expect(source).toContain('click_action:');
      expect(source).toContain("route: data?.route || '/'");
    });

    it('should track sentCount and failedCount', () => {
      expect(source).toContain('sentCount++');
      expect(source).toContain('failedCount++');
    });

    it('should handle missing FCM_SERVER_KEY gracefully', () => {
      expect(source).toContain('FCM_SERVER_KEY not configured');
    });
  });

  describe('token lifecycle management', () => {
    it('should deactivate tokens on NotRegistered error', () => {
      expect(source).toContain("errorText.includes('NotRegistered')");
    });

    it('should deactivate tokens on InvalidRegistration error', () => {
      expect(source).toContain("errorText.includes('InvalidRegistration')");
    });

    it('should mark token as inactive by updating is_active to false', () => {
      expect(source).toContain("update({ is_active: false })");
      expect(source).toContain(".eq('token', tokenRecord.token)");
    });
  });

  describe('notification logging', () => {
    it('should log to notifications_log table', () => {
      expect(source).toContain("from('notifications_log').insert");
    });

    it('should log notification_type as push', () => {
      expect(source).toContain("notification_type: 'push'");
    });

    it('should set status based on sent count', () => {
      expect(source).toContain("sentCount > 0 ? 'sent'");
      expect(source).toContain("'failed'");
      expect(source).toContain("'no_tokens'");
    });

    it('should include order_id from data if present', () => {
      expect(source).toContain('order_id: data?.orderId');
    });

    it('should include notification stage with default 0', () => {
      expect(source).toContain('notification_stage: data?.stage || 0');
    });
  });

  describe('response format', () => {
    it('should return success, message, userId, title, sentCount, failedCount', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('userId,');
      expect(source).toContain('title,');
      expect(source).toContain('sentCount,');
      expect(source).toContain('failedCount,');
    });

    it('should include descriptive message based on sent count', () => {
      expect(source).toContain("'Push notification sent'");
      expect(source).toContain("'No tokens to send to'");
    });

    it('should return JSON content type', () => {
      expect(source).toContain("'Content-Type': 'application/json'");
    });
  });

  describe('credit gate integration', () => {
    it('should use withCreditGate middleware', () => {
      expect(source).toContain('withCreditGate(');
    });

    it('should use CREDIT_ACTIONS.SEND_PUSH_NOTIFICATION action key', () => {
      expect(source).toContain('CREDIT_ACTIONS.SEND_PUSH_NOTIFICATION');
    });

    it('should include description option', () => {
      expect(source).toContain("description: 'Send push notification via FCM'");
    });
  });
});

describe('notification preference logic (unit)', () => {
  // Simulate the preference evaluation logic from the edge function
  function evaluateAllowPush(
    prefs: { push_enabled?: boolean; push_all_updates?: boolean; push_critical_only?: boolean } | null,
    isCritical: boolean
  ): boolean {
    const pushEnabled = prefs?.push_enabled !== false;
    return pushEnabled && (!prefs || prefs.push_all_updates || (prefs.push_critical_only && isCritical) || false);
  }

  it('should allow push when prefs is null (no preferences set)', () => {
    expect(evaluateAllowPush(null, false)).toBe(true);
  });

  it('should allow push when prefs is null and notification is critical', () => {
    expect(evaluateAllowPush(null, true)).toBe(true);
  });

  it('should allow push when push_all_updates is true', () => {
    expect(evaluateAllowPush({ push_enabled: true, push_all_updates: true, push_critical_only: false }, false)).toBe(true);
  });

  it('should allow critical push when push_critical_only is true', () => {
    expect(evaluateAllowPush({ push_enabled: true, push_all_updates: false, push_critical_only: true }, true)).toBe(true);
  });

  it('should block non-critical push when push_critical_only is true', () => {
    expect(evaluateAllowPush({ push_enabled: true, push_all_updates: false, push_critical_only: true }, false)).toBe(false);
  });

  it('should block push when push_enabled is false', () => {
    expect(evaluateAllowPush({ push_enabled: false, push_all_updates: true, push_critical_only: true }, true)).toBe(false);
  });

  it('should block push when prefs exist but no update flags are set', () => {
    expect(evaluateAllowPush({ push_enabled: true, push_all_updates: false, push_critical_only: false }, false)).toBe(false);
  });

  it('should block push when push_enabled is false even with push_all_updates', () => {
    expect(evaluateAllowPush({ push_enabled: false, push_all_updates: true }, false)).toBe(false);
  });
});
