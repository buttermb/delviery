/**
 * Tests for the Credit Gate Test Helper
 *
 * Verifies that mockCreditGate and its convenience factories
 * correctly simulate credit gate behavior for edge function tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockCreditGate,
  mockCreditGateSuccess,
  mockCreditGateInsufficient,
  mockCreditGatePaidTier,
  expectInsufficientCreditsResponse,
  expectCreditHeaders,
  buildCreditGateRequest,
} from '../creditGate';

describe('Credit Gate Test Helpers', () => {
  describe('mockCreditGate', () => {
    it('should create a mock with default config', () => {
      const gate = mockCreditGate();

      expect(gate.tenantId).toBe('00000000-0000-4000-a000-000000000001');
      expect(gate.userId).toBe('00000000-0000-4000-a000-000000000002');
      expect(gate.consumedActions).toEqual([]);
      expect(gate.analyticsEvents).toEqual([]);
      expect(gate.getConsumedCount()).toBe(0);
    });

    it('should use custom tenant and user IDs', () => {
      const gate = mockCreditGate({
        tenantId: 'custom-tenant-id',
        userId: 'custom-user-id',
      });

      expect(gate.tenantId).toBe('custom-tenant-id');
      expect(gate.userId).toBe('custom-user-id');
    });

    describe('supabaseClient.auth', () => {
      it('should resolve getUser with the configured user', async () => {
        const gate = mockCreditGate({ userId: 'my-user' });
        const { data } = await gate.supabaseClient.auth.getUser('token');

        expect(data.user.id).toBe('my-user');
        expect(data.user.email).toBe('test@example.com');
      });
    });

    describe('supabaseClient.from', () => {
      it('should return tenant_users with configured tenantId', async () => {
        const gate = mockCreditGate({ tenantId: 'tid-123' });
        const builder = gate.supabaseClient.from('tenant_users');

        builder.select('tenant_id');
        builder.eq('user_id', 'uid');
        const { data } = await builder.maybeSingle();

        expect(data.tenant_id).toBe('tid-123');
      });

      it('should return tenants with free tier info', async () => {
        const gate = mockCreditGate({ isFreeTier: true, tenantId: 'tid-456' });
        const builder = gate.supabaseClient.from('tenants');

        builder.select('id, is_free_tier, subscription_status');
        builder.eq('id', 'tid-456');
        const { data } = await builder.maybeSingle();

        expect(data.id).toBe('tid-456');
        expect(data.is_free_tier).toBe(true);
      });

      it('should return credit_costs with configured cost', async () => {
        const gate = mockCreditGate({ cost: 250 });
        const builder = gate.supabaseClient.from('credit_costs');

        builder.select('credits');
        builder.eq('action_key', 'menu_ocr');
        builder.eq('is_active', true);
        const { data } = await builder.maybeSingle();

        expect(data.credits).toBe(250);
      });

      it('should return tenant_credits with configured balance', async () => {
        const gate = mockCreditGate({ balance: 5000 });
        const builder = gate.supabaseClient.from('tenant_credits');

        builder.select('balance');
        builder.eq('tenant_id', 'tid');
        const { data } = await builder.maybeSingle();

        expect(data.balance).toBe(5000);
      });

      it('should track credit_analytics inserts', async () => {
        const gate = mockCreditGate();
        const builder = gate.supabaseClient.from('credit_analytics');

        await builder.insert({
          tenant_id: 'tid-1',
          event_type: 'action_blocked_insufficient_credits',
          credits_at_event: 0,
          action_attempted: 'create_order',
        });

        expect(gate.analyticsEvents).toHaveLength(1);
        expect(gate.analyticsEvents[0]).toEqual({
          tenantId: 'tid-1',
          eventType: 'action_blocked_insufficient_credits',
          creditsAtEvent: 0,
          actionAttempted: 'create_order',
        });
      });
    });

    describe('supabaseClient.rpc (consume_credits)', () => {
      it('should consume credits and track the action', async () => {
        const gate = mockCreditGate({ balance: 1000, cost: 100 });

        const { data, error } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'create_order',
          p_reference_id: 'order-1',
          p_reference_type: 'order',
          p_description: 'Created order',
        });

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].success).toBe(true);
        expect(data[0].new_balance).toBe(900);
        expect(data[0].credits_cost).toBe(100);

        expect(gate.consumedActions).toHaveLength(1);
        expect(gate.consumedActions[0]).toEqual({
          actionKey: 'create_order',
          tenantId: gate.tenantId,
          referenceId: 'order-1',
          referenceType: 'order',
          description: 'Created order',
        });
      });

      it('should return insufficient credits when balance is too low', async () => {
        const gate = mockCreditGate({ balance: 50, cost: 100 });

        const { data, error } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'create_order',
        });

        expect(error).toBeNull();
        expect(data[0].success).toBe(false);
        expect(data[0].new_balance).toBe(50);
        expect(data[0].error_message).toBe('Insufficient credits');

        // Should NOT track the action as consumed
        expect(gate.consumedActions).toHaveLength(0);
      });

      it('should return insufficient when forceInsufficientCredits is set', async () => {
        const gate = mockCreditGate({
          balance: 99999,
          cost: 1,
          forceInsufficientCredits: true,
        });

        const { data } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'create_order',
        });

        expect(data[0].success).toBe(false);
        expect(gate.consumedActions).toHaveLength(0);
      });

      it('should return RPC error when rpcError is configured', async () => {
        const gate = mockCreditGate({
          rpcError: { message: 'DB connection lost', code: 'CONNECTION_ERROR' },
        });

        const { data, error } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'create_order',
        });

        expect(data).toBeNull();
        expect(error).toEqual({
          message: 'DB connection lost',
          code: 'CONNECTION_ERROR',
        });
      });

      it('should track cumulative balance across multiple consumptions', async () => {
        const gate = mockCreditGate({ balance: 500, cost: 100 });

        // Consume 3 times
        for (const key of ['action_1', 'action_2', 'action_3']) {
          await gate.supabaseClient.rpc('consume_credits', {
            p_tenant_id: gate.tenantId,
            p_action_key: key,
          });
        }

        expect(gate.getConsumedCount()).toBe(3);

        // Fourth call: 500 - 300 = 200, still enough for 100
        const { data: d4 } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'action_4',
        });
        expect(d4[0].success).toBe(true);
        expect(d4[0].new_balance).toBe(100);

        // Fifth call: only 100 left, exactly enough
        const { data: d5 } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'action_5',
        });
        expect(d5[0].success).toBe(true);
        expect(d5[0].new_balance).toBe(0);

        // Sixth call: 0 left, should fail
        const { data: d6 } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'action_6',
        });
        expect(d6[0].success).toBe(false);
      });
    });

    describe('assertion helpers', () => {
      let gate: ReturnType<typeof mockCreditGate>;

      beforeEach(async () => {
        gate = mockCreditGate({ balance: 1000, cost: 50 });

        // Consume one action
        await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'send_sms',
        });
      });

      it('expectCreditConsumed should pass for consumed action', () => {
        expect(() => gate.expectCreditConsumed('send_sms')).not.toThrow();
      });

      it('expectCreditConsumed should throw for non-consumed action', () => {
        expect(() => gate.expectCreditConsumed('menu_ocr')).toThrow(
          /Expected credit consumed for "menu_ocr"/
        );
      });

      it('expectCreditNotConsumed should pass for non-consumed action', () => {
        expect(() => gate.expectCreditNotConsumed('menu_ocr')).not.toThrow();
      });

      it('expectCreditNotConsumed should throw for consumed action', () => {
        expect(() => gate.expectCreditNotConsumed('send_sms')).toThrow(
          /Expected credit NOT consumed for "send_sms"/
        );
      });

      it('expectCreditBlocked should pass when blocking event exists', async () => {
        // Insert a blocking analytics event
        const builder = gate.supabaseClient.from('credit_analytics');
        await builder.insert({
          tenant_id: gate.tenantId,
          event_type: 'action_blocked_insufficient_credits',
          credits_at_event: 0,
          action_attempted: 'export_csv',
        });

        expect(() => gate.expectCreditBlocked('export_csv')).not.toThrow();
      });

      it('expectCreditBlocked should throw when no blocking event', () => {
        expect(() => gate.expectCreditBlocked('export_csv')).toThrow(
          /Expected credit blocked for "export_csv"/
        );
      });

      it('expectAnalyticsEvent should match by event type', async () => {
        const builder = gate.supabaseClient.from('credit_analytics');
        await builder.insert({
          tenant_id: gate.tenantId,
          event_type: 'credit_consumed',
          credits_at_event: 950,
          action_attempted: 'send_sms',
        });

        expect(() => gate.expectAnalyticsEvent('credit_consumed')).not.toThrow();
      });

      it('expectAnalyticsEvent should match by event type and action key', async () => {
        const builder = gate.supabaseClient.from('credit_analytics');
        await builder.insert({
          tenant_id: gate.tenantId,
          event_type: 'credit_consumed',
          credits_at_event: 950,
          action_attempted: 'send_sms',
        });

        expect(() =>
          gate.expectAnalyticsEvent('credit_consumed', 'send_sms')
        ).not.toThrow();
        expect(() =>
          gate.expectAnalyticsEvent('credit_consumed', 'wrong_key')
        ).toThrow();
      });
    });

    describe('reset', () => {
      it('should clear all tracked state and restore balance', async () => {
        const gate = mockCreditGate({ balance: 1000, cost: 100 });

        await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'create_order',
        });

        const builder = gate.supabaseClient.from('credit_analytics');
        await builder.insert({
          tenant_id: gate.tenantId,
          event_type: 'test',
          credits_at_event: 900,
          action_attempted: 'create_order',
        });

        expect(gate.getConsumedCount()).toBe(1);
        expect(gate.analyticsEvents).toHaveLength(1);

        gate.reset();

        expect(gate.getConsumedCount()).toBe(0);
        expect(gate.analyticsEvents).toHaveLength(0);

        // Balance should be restored
        const { data } = await gate.supabaseClient.rpc('consume_credits', {
          p_tenant_id: gate.tenantId,
          p_action_key: 'another_action',
        });
        expect(data[0].new_balance).toBe(900); // 1000 - 100
      });
    });
  });

  describe('mockCreditGateSuccess', () => {
    it('should create a gate with sufficient credits', async () => {
      const gate = mockCreditGateSuccess(50, 500);

      const { data } = await gate.supabaseClient.rpc('consume_credits', {
        p_tenant_id: gate.tenantId,
        p_action_key: 'test_action',
      });

      expect(data[0].success).toBe(true);
      expect(data[0].credits_cost).toBe(50);
      expect(data[0].new_balance).toBe(450);
    });
  });

  describe('mockCreditGateInsufficient', () => {
    it('should create a gate that always blocks', async () => {
      const gate = mockCreditGateInsufficient(100, 0);

      const { data } = await gate.supabaseClient.rpc('consume_credits', {
        p_tenant_id: gate.tenantId,
        p_action_key: 'test_action',
      });

      expect(data[0].success).toBe(false);
      expect(gate.consumedActions).toHaveLength(0);
    });
  });

  describe('mockCreditGatePaidTier', () => {
    it('should create a gate for non-free-tier tenant', async () => {
      const gate = mockCreditGatePaidTier();
      const builder = gate.supabaseClient.from('tenants');

      builder.select('id, is_free_tier, subscription_status');
      builder.eq('id', gate.tenantId);
      const { data } = await builder.maybeSingle();

      expect(data.is_free_tier).toBe(false);
    });
  });

  describe('expectInsufficientCreditsResponse', () => {
    it('should pass for valid 402 response', async () => {
      const response = new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          message: 'Not enough credits',
          creditsRequired: 100,
          currentBalance: 50,
          actionKey: 'create_order',
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );

      await expect(
        expectInsufficientCreditsResponse(response, 'create_order')
      ).resolves.not.toThrow();
    });

    it('should throw for non-402 status', async () => {
      const response = new Response('{}', { status: 200 });

      await expect(
        expectInsufficientCreditsResponse(response)
      ).rejects.toThrow(/Expected status 402, got 200/);
    });

    it('should throw for wrong error code', async () => {
      const response = new Response(
        JSON.stringify({ code: 'WRONG_CODE', creditsRequired: 1, currentBalance: 0 }),
        { status: 402 }
      );

      await expect(
        expectInsufficientCreditsResponse(response)
      ).rejects.toThrow(/Expected error code "INSUFFICIENT_CREDITS"/);
    });

    it('should throw for wrong action key', async () => {
      const response = new Response(
        JSON.stringify({
          code: 'INSUFFICIENT_CREDITS',
          creditsRequired: 100,
          currentBalance: 0,
          actionKey: 'wrong_action',
        }),
        { status: 402 }
      );

      await expect(
        expectInsufficientCreditsResponse(response, 'create_order')
      ).rejects.toThrow(/Expected actionKey "create_order"/);
    });
  });

  describe('expectCreditHeaders', () => {
    it('should pass for response with credit headers', () => {
      const response = new Response('ok', {
        headers: {
          'X-Credits-Consumed': '100',
          'X-Credits-Remaining': '900',
        },
      });

      expect(() => expectCreditHeaders(response, 100, 900)).not.toThrow();
    });

    it('should throw for missing X-Credits-Consumed header', () => {
      const response = new Response('ok', {
        headers: { 'X-Credits-Remaining': '900' },
      });

      expect(() => expectCreditHeaders(response)).toThrow(
        /Missing X-Credits-Consumed header/
      );
    });

    it('should throw for missing X-Credits-Remaining header', () => {
      const response = new Response('ok', {
        headers: { 'X-Credits-Consumed': '100' },
      });

      expect(() => expectCreditHeaders(response)).toThrow(
        /Missing X-Credits-Remaining header/
      );
    });

    it('should throw for wrong consumed value', () => {
      const response = new Response('ok', {
        headers: {
          'X-Credits-Consumed': '50',
          'X-Credits-Remaining': '900',
        },
      });

      expect(() => expectCreditHeaders(response, 100)).toThrow(
        /Expected X-Credits-Consumed=100, got 50/
      );
    });
  });

  describe('buildCreditGateRequest', () => {
    it('should create a POST request with auth header', () => {
      const req = buildCreditGateRequest({ action: 'create' });

      expect(req.method).toBe('POST');
      expect(req.headers.get('Authorization')).toBe('Bearer test-jwt-token');
      expect(req.headers.get('Content-Type')).toBe('application/json');
    });

    it('should use custom auth token', () => {
      const req = buildCreditGateRequest({}, { authToken: 'my-token' });

      expect(req.headers.get('Authorization')).toBe('Bearer my-token');
    });

    it('should allow custom method', () => {
      const req = buildCreditGateRequest({}, { method: 'GET' });

      expect(req.method).toBe('GET');
    });

    it('should include custom headers', () => {
      const req = buildCreditGateRequest(
        {},
        { headers: { 'X-Custom': 'value' } }
      );

      expect(req.headers.get('X-Custom')).toBe('value');
    });

    it('should serialize body as JSON', async () => {
      const req = buildCreditGateRequest({ tenant_id: 'tid', amount: 100 });
      const body = await req.json();

      expect(body).toEqual({ tenant_id: 'tid', amount: 100 });
    });

    it('should not include body for GET requests', () => {
      const req = buildCreditGateRequest({ data: 'test' }, { method: 'GET' });

      expect(req.body).toBeNull();
    });
  });
});
