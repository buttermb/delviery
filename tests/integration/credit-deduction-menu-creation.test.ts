/**
 * Credit Deduction Flow End-to-End Test — Menu Creation
 *
 * Tests the complete credit deduction lifecycle for menu creation:
 * 1. Free-tier tenant has sufficient credits (>= 100)
 * 2. Pre-action balance check passes
 * 3. consume_credits RPC deducts 100 credits atomically
 * 4. Credit transaction is recorded with correct reference_id/type
 * 5. Balance is updated (new_balance = old - 100)
 * 6. Analytics event is logged (credit_consumed)
 * 7. Menu is created only after credits are deducted
 * 8. Insufficient credits blocks menu creation with 402
 * 9. Paid-tier tenants bypass credit deduction entirely
 * 10. Rollback on menu creation failure refunds credits
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface TenantCredits {
  tenantId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  creditsUsedToday: number;
  creditsUsedThisWeek: number;
  creditsUsedThisMonth: number;
  isFreeTier: boolean;
}

interface CreditTransaction {
  id: string;
  tenantId: string;
  amount: number;
  balanceAfter: number;
  transactionType: 'usage' | 'purchase' | 'refund' | 'free_grant' | 'bonus';
  actionKey: string;
  referenceId: string | null;
  referenceType: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface CreditAnalyticsEvent {
  tenantId: string;
  eventType: string;
  creditsAtEvent: number;
  actionAttempted: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Menu {
  id: string;
  tenantId: string;
  name: string;
  accessCode: string;
  urlToken: string;
  status: 'active' | 'burned' | 'expired';
  createdAt: string;
}

interface ConsumeResult {
  success: boolean;
  consumed: number;
  balance: number;
  error?: string;
}

interface MenuCreateResult {
  success: boolean;
  menu?: Menu;
  creditsConsumed?: number;
  creditsRemaining?: number;
  error?: string;
  statusCode?: number;
}

// ============================================================================
// In-Memory Credit + Menu System Simulation
// ============================================================================

/**
 * Simulates the full credit deduction + menu creation pipeline.
 * Models the actual database operations atomically without live services.
 */
class MenuCreditSystem {
  tenantCredits: Map<string, TenantCredits> = new Map();
  transactions: CreditTransaction[] = [];
  analyticsEvents: CreditAnalyticsEvent[] = [];
  menus: Menu[] = [];
  creditCosts: Map<string, number> = new Map();

  constructor() {
    this.seedCreditCosts();
  }

  private seedCreditCosts(): void {
    // Matches src/lib/credits/creditCosts.ts
    this.creditCosts.set('menu_create', 100);
    this.creditCosts.set('menu_ocr', 250);
    this.creditCosts.set('menu_view', 2);
    this.creditCosts.set('menu_import_catalog', 50);
    this.creditCosts.set('order_create_manual', 50);
    this.creditCosts.set('send_sms', 25);
    this.creditCosts.set('send_email', 10);
    this.creditCosts.set('dashboard_view', 0); // free action
  }

  setupTenant(tenantId: string, options: {
    balance: number;
    isFreeTier: boolean;
    lifetimeEarned?: number;
    lifetimeSpent?: number;
  }): void {
    this.tenantCredits.set(tenantId, {
      tenantId,
      balance: options.balance,
      lifetimeEarned: options.lifetimeEarned ?? options.balance,
      lifetimeSpent: options.lifetimeSpent ?? 0,
      creditsUsedToday: 0,
      creditsUsedThisWeek: 0,
      creditsUsedThisMonth: 0,
      isFreeTier: options.isFreeTier,
    });
  }

  getBalance(tenantId: string): TenantCredits | null {
    return this.tenantCredits.get(tenantId) ?? null;
  }

  /**
   * Simulates consume_credits RPC — the atomic credit deduction.
   * Mirrors the actual Postgres function behavior.
   */
  consumeCredits(
    tenantId: string,
    actionKey: string,
    referenceId?: string,
    referenceType?: string,
    description?: string,
  ): ConsumeResult {
    const tenant = this.tenantCredits.get(tenantId);
    if (!tenant) {
      return { success: false, consumed: 0, balance: 0, error: 'Tenant not found' };
    }

    // Paid tier bypass — consume_credits returns success without deducting
    if (!tenant.isFreeTier) {
      return { success: true, consumed: 0, balance: tenant.balance };
    }

    const cost = this.creditCosts.get(actionKey);
    if (cost === undefined) {
      return { success: false, consumed: 0, balance: tenant.balance, error: `Unknown action key: ${actionKey}` };
    }

    // Free actions pass through
    if (cost === 0) {
      return { success: true, consumed: 0, balance: tenant.balance };
    }

    // Insufficient balance check
    if (tenant.balance < cost) {
      // Log blocked event
      this.analyticsEvents.push({
        tenantId,
        eventType: 'action_blocked_insufficient_credits',
        creditsAtEvent: tenant.balance,
        actionAttempted: actionKey,
        metadata: { required: cost, available: tenant.balance },
        createdAt: new Date().toISOString(),
      });

      return {
        success: false,
        consumed: 0,
        balance: tenant.balance,
        error: `Insufficient credits: need ${cost}, have ${tenant.balance}`,
      };
    }

    // Deduct credits atomically
    const newBalance = tenant.balance - cost;
    tenant.balance = newBalance;
    tenant.lifetimeSpent += cost;
    tenant.creditsUsedToday += cost;
    tenant.creditsUsedThisWeek += cost;
    tenant.creditsUsedThisMonth += cost;

    // Record transaction
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.transactions.push({
      id: txnId,
      tenantId,
      amount: -cost,
      balanceAfter: newBalance,
      transactionType: 'usage',
      actionKey,
      referenceId: referenceId ?? null,
      referenceType: referenceType ?? null,
      description: description ?? `Credit deduction: ${actionKey}`,
      metadata: {
        action_key: actionKey,
        credits_cost: cost,
      },
      createdAt: new Date().toISOString(),
    });

    // Log consumed analytics event
    this.analyticsEvents.push({
      tenantId,
      eventType: 'credit_consumed',
      creditsAtEvent: newBalance,
      actionAttempted: actionKey,
      metadata: { credits_cost: cost, new_balance: newBalance },
      createdAt: new Date().toISOString(),
    });

    return { success: true, consumed: cost, balance: newBalance };
  }

  /**
   * Simulates refund_credits — returns credits to balance after a failed action.
   */
  refundCredits(
    tenantId: string,
    amount: number,
    actionKey: string,
    reason: string,
  ): ConsumeResult {
    const tenant = this.tenantCredits.get(tenantId);
    if (!tenant) {
      return { success: false, consumed: 0, balance: 0, error: 'Tenant not found' };
    }

    tenant.balance += amount;
    tenant.lifetimeSpent -= amount;

    // Record refund transaction
    const txnId = `txn_refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.transactions.push({
      id: txnId,
      tenantId,
      amount,
      balanceAfter: tenant.balance,
      transactionType: 'refund',
      actionKey,
      referenceId: null,
      referenceType: null,
      description: reason,
      metadata: { refund_reason: reason, action_key: actionKey },
      createdAt: new Date().toISOString(),
    });

    // Log refund analytics event
    this.analyticsEvents.push({
      tenantId,
      eventType: 'credit_refunded',
      creditsAtEvent: tenant.balance,
      actionAttempted: actionKey,
      metadata: { refunded_amount: amount, reason },
      createdAt: new Date().toISOString(),
    });

    return { success: true, consumed: -amount, balance: tenant.balance };
  }

  /**
   * Simulates the full menu creation flow with credit gate.
   * Models: withCreditGate('menu_create', handler)
   */
  createMenuWithCreditGate(
    tenantId: string,
    menuData: { name: string; productIds: string[] },
    options?: { simulateMenuFailure?: boolean },
  ): MenuCreateResult {
    // Step 1: Consume credits
    const creditResult = this.consumeCredits(
      tenantId,
      'menu_create',
      undefined,
      'menu',
      `Menu creation: ${menuData.name}`,
    );

    if (!creditResult.success) {
      return {
        success: false,
        error: creditResult.error,
        statusCode: 402,
      };
    }

    // Step 2: Create the menu
    if (options?.simulateMenuFailure) {
      // Menu creation failed — refund credits
      this.refundCredits(
        tenantId,
        creditResult.consumed,
        'menu_create',
        'Menu creation failed — credits refunded',
      );

      return {
        success: false,
        error: 'Menu creation failed: database error',
        statusCode: 500,
      };
    }

    const menuId = `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const accessCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const urlToken = crypto.randomUUID();

    const menu: Menu = {
      id: menuId,
      tenantId,
      name: menuData.name,
      accessCode,
      urlToken,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.menus.push(menu);

    // Update transaction with reference_id now that we have the menuId
    const lastTxn = this.transactions.filter(
      t => t.tenantId === tenantId && t.actionKey === 'menu_create',
    ).pop();
    if (lastTxn) {
      lastTxn.referenceId = menuId;
      lastTxn.referenceType = 'menu';
    }

    return {
      success: true,
      menu,
      creditsConsumed: creditResult.consumed,
      creditsRemaining: creditResult.balance,
    };
  }

  // Helper: get transactions for a tenant
  getTransactions(tenantId: string): CreditTransaction[] {
    return this.transactions.filter(t => t.tenantId === tenantId);
  }

  // Helper: get analytics events for a tenant
  getAnalytics(tenantId: string, eventType?: string): CreditAnalyticsEvent[] {
    return this.analyticsEvents.filter(
      e => e.tenantId === tenantId && (!eventType || e.eventType === eventType),
    );
  }

  // Helper: get menus for a tenant
  getMenus(tenantId: string): Menu[] {
    return this.menus.filter(m => m.tenantId === tenantId);
  }
}

// ============================================================================
// Test Constants
// ============================================================================

const TENANT_FREE = 'tenant-free-001';
const TENANT_PAID = 'tenant-paid-001';
const TENANT_LOW_BALANCE = 'tenant-low-001';
const TENANT_ZERO_BALANCE = 'tenant-zero-001';
const MENU_CREATE_COST = 100;

// ============================================================================
// Test Suite
// ============================================================================

describe('Credit Deduction Flow E2E — Menu Creation', () => {
  let system: MenuCreditSystem;

  beforeEach(() => {
    system = new MenuCreditSystem();

    // Free tier tenant with 500 credits (enough for 5 menu creations)
    system.setupTenant(TENANT_FREE, { balance: 500, isFreeTier: true });

    // Paid tier tenant (credits bypassed)
    system.setupTenant(TENANT_PAID, { balance: 0, isFreeTier: false });

    // Free tier tenant with barely enough credits for 1 menu
    system.setupTenant(TENANT_LOW_BALANCE, { balance: 100, isFreeTier: true });

    // Free tier tenant with 0 credits
    system.setupTenant(TENANT_ZERO_BALANCE, { balance: 0, isFreeTier: true });
  });

  // ==========================================================================
  // 1. Successful Menu Creation with Credit Deduction
  // ==========================================================================

  describe('Successful menu creation deducts credits', () => {
    it('should deduct exactly 100 credits for menu_create action', () => {
      const before = system.getBalance(TENANT_FREE)!;
      expect(before.balance).toBe(500);

      const result = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Daily Specials',
        productIds: ['prod-1', 'prod-2'],
      });

      expect(result.success).toBe(true);
      expect(result.creditsConsumed).toBe(MENU_CREATE_COST);

      const after = system.getBalance(TENANT_FREE)!;
      expect(after.balance).toBe(500 - MENU_CREATE_COST);
    });

    it('should return the new balance after deduction', () => {
      const result = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Weekend Menu',
        productIds: ['prod-a'],
      });

      expect(result.success).toBe(true);
      expect(result.creditsRemaining).toBe(400);
    });

    it('should create the menu record after credits are consumed', () => {
      const result = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'VIP Menu',
        productIds: ['prod-x'],
      });

      expect(result.success).toBe(true);
      expect(result.menu).toBeDefined();
      expect(result.menu!.name).toBe('VIP Menu');
      expect(result.menu!.status).toBe('active');
      expect(result.menu!.tenantId).toBe(TENANT_FREE);
      expect(result.menu!.accessCode).toBeTruthy();
      expect(result.menu!.urlToken).toBeTruthy();
    });

    it('should update lifetime_spent after deduction', () => {
      system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Test Menu',
        productIds: [],
      });

      const credits = system.getBalance(TENANT_FREE)!;
      expect(credits.lifetimeSpent).toBe(MENU_CREATE_COST);
    });

    it('should update daily/weekly/monthly usage counters', () => {
      system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Counter Test',
        productIds: [],
      });

      const credits = system.getBalance(TENANT_FREE)!;
      expect(credits.creditsUsedToday).toBe(MENU_CREATE_COST);
      expect(credits.creditsUsedThisWeek).toBe(MENU_CREATE_COST);
      expect(credits.creditsUsedThisMonth).toBe(MENU_CREATE_COST);
    });
  });

  // ==========================================================================
  // 2. Transaction Recording
  // ==========================================================================

  describe('Transaction is recorded correctly', () => {
    it('should create a usage transaction with correct amount', () => {
      system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Tracked Menu',
        productIds: ['p1'],
      });

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(1);

      const txn = txns[0];
      expect(txn.transactionType).toBe('usage');
      expect(txn.amount).toBe(-MENU_CREATE_COST);
      expect(txn.balanceAfter).toBe(400);
      expect(txn.actionKey).toBe('menu_create');
    });

    it('should include menu reference_id in transaction', () => {
      const result = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Ref Menu',
        productIds: ['p2'],
      });

      const txns = system.getTransactions(TENANT_FREE);
      const txn = txns[0];

      expect(txn.referenceId).toBe(result.menu!.id);
      expect(txn.referenceType).toBe('menu');
    });

    it('should include description in transaction', () => {
      system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Described Menu',
        productIds: [],
      });

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns[0].description).toContain('Menu creation');
      expect(txns[0].description).toContain('Described Menu');
    });

    it('should include metadata with action_key and credits_cost', () => {
      system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Meta Menu',
        productIds: [],
      });

      const txns = system.getTransactions(TENANT_FREE);
      const meta = txns[0].metadata;

      expect(meta.action_key).toBe('menu_create');
      expect(meta.credits_cost).toBe(MENU_CREATE_COST);
    });

    it('should create unique transaction IDs', () => {
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'M1', productIds: [] });
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'M2', productIds: [] });

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(2);
      expect(txns[0].id).not.toBe(txns[1].id);
    });
  });

  // ==========================================================================
  // 3. Analytics Event Logging
  // ==========================================================================

  describe('Analytics events are logged', () => {
    it('should log credit_consumed event on successful deduction', () => {
      system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Analytics Menu',
        productIds: [],
      });

      const events = system.getAnalytics(TENANT_FREE, 'credit_consumed');
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.actionAttempted).toBe('menu_create');
      expect(event.creditsAtEvent).toBe(400); // balance AFTER deduction
      expect(event.metadata.credits_cost).toBe(MENU_CREATE_COST);
      expect(event.metadata.new_balance).toBe(400);
    });

    it('should log action_blocked event when insufficient credits', () => {
      system.createMenuWithCreditGate(TENANT_ZERO_BALANCE, {
        name: 'Blocked Menu',
        productIds: [],
      });

      const events = system.getAnalytics(TENANT_ZERO_BALANCE, 'action_blocked_insufficient_credits');
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.actionAttempted).toBe('menu_create');
      expect(event.creditsAtEvent).toBe(0);
      expect(event.metadata.required).toBe(MENU_CREATE_COST);
      expect(event.metadata.available).toBe(0);
    });

    it('should not log any analytics for paid tier tenants', () => {
      system.createMenuWithCreditGate(TENANT_PAID, {
        name: 'Paid Menu',
        productIds: [],
      });

      const allEvents = system.getAnalytics(TENANT_PAID);
      expect(allEvents).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 4. Insufficient Credits Blocks Menu Creation
  // ==========================================================================

  describe('Insufficient credits blocks menu creation', () => {
    it('should return 402 when balance is 0', () => {
      const result = system.createMenuWithCreditGate(TENANT_ZERO_BALANCE, {
        name: 'Impossible Menu',
        productIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(402);
      expect(result.error).toContain('Insufficient credits');
    });

    it('should not create menu record when blocked', () => {
      system.createMenuWithCreditGate(TENANT_ZERO_BALANCE, {
        name: 'Ghost Menu',
        productIds: [],
      });

      const menus = system.getMenus(TENANT_ZERO_BALANCE);
      expect(menus).toHaveLength(0);
    });

    it('should not deduct any credits when blocked', () => {
      system.createMenuWithCreditGate(TENANT_ZERO_BALANCE, {
        name: 'No Deduction',
        productIds: [],
      });

      const credits = system.getBalance(TENANT_ZERO_BALANCE)!;
      expect(credits.balance).toBe(0);
      expect(credits.lifetimeSpent).toBe(0);
    });

    it('should not create a usage transaction when blocked', () => {
      system.createMenuWithCreditGate(TENANT_ZERO_BALANCE, {
        name: 'No Txn',
        productIds: [],
      });

      const txns = system.getTransactions(TENANT_ZERO_BALANCE);
      expect(txns).toHaveLength(0);
    });

    it('should block when balance is less than cost (99 < 100)', () => {
      system.setupTenant('tenant-99', { balance: 99, isFreeTier: true });

      const result = system.createMenuWithCreditGate('tenant-99', {
        name: 'Almost Menu',
        productIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(402);
      expect(result.error).toContain('need 100');
      expect(result.error).toContain('have 99');
    });

    it('should return remaining balance info in the error', () => {
      system.setupTenant('tenant-50', { balance: 50, isFreeTier: true });

      const result = system.createMenuWithCreditGate('tenant-50', {
        name: 'Partial Menu',
        productIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('50');
    });
  });

  // ==========================================================================
  // 5. Paid Tier Bypass
  // ==========================================================================

  describe('Paid tier tenants bypass credit deduction', () => {
    it('should create menu without deducting credits for paid tier', () => {
      const result = system.createMenuWithCreditGate(TENANT_PAID, {
        name: 'Premium Menu',
        productIds: ['prod-premium'],
      });

      expect(result.success).toBe(true);
      expect(result.menu).toBeDefined();
      expect(result.menu!.name).toBe('Premium Menu');
    });

    it('should report 0 credits consumed for paid tier', () => {
      const result = system.createMenuWithCreditGate(TENANT_PAID, {
        name: 'Free Ride',
        productIds: [],
      });

      expect(result.success).toBe(true);
      expect(result.creditsConsumed).toBe(0);
    });

    it('should not create usage transaction for paid tier', () => {
      system.createMenuWithCreditGate(TENANT_PAID, {
        name: 'No Transaction',
        productIds: [],
      });

      const txns = system.getTransactions(TENANT_PAID);
      expect(txns).toHaveLength(0);
    });

    it('should not change balance for paid tier', () => {
      const before = system.getBalance(TENANT_PAID)!.balance;

      system.createMenuWithCreditGate(TENANT_PAID, {
        name: 'Unchanged Balance',
        productIds: [],
      });

      const after = system.getBalance(TENANT_PAID)!.balance;
      expect(after).toBe(before);
    });
  });

  // ==========================================================================
  // 6. Rollback on Menu Creation Failure
  // ==========================================================================

  describe('Credits are refunded when menu creation fails', () => {
    it('should refund credits when menu creation fails', () => {
      const before = system.getBalance(TENANT_FREE)!.balance;
      expect(before).toBe(500);

      const result = system.createMenuWithCreditGate(
        TENANT_FREE,
        { name: 'Failed Menu', productIds: [] },
        { simulateMenuFailure: true },
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);

      const after = system.getBalance(TENANT_FREE)!.balance;
      expect(after).toBe(500); // Fully refunded
    });

    it('should create both usage and refund transactions on failure', () => {
      system.createMenuWithCreditGate(
        TENANT_FREE,
        { name: 'Fail Tracked', productIds: [] },
        { simulateMenuFailure: true },
      );

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(2);

      expect(txns[0].transactionType).toBe('usage');
      expect(txns[0].amount).toBe(-MENU_CREATE_COST);

      expect(txns[1].transactionType).toBe('refund');
      expect(txns[1].amount).toBe(MENU_CREATE_COST);
    });

    it('should log credit_refunded analytics event on failure', () => {
      system.createMenuWithCreditGate(
        TENANT_FREE,
        { name: 'Refund Event', productIds: [] },
        { simulateMenuFailure: true },
      );

      const refundEvents = system.getAnalytics(TENANT_FREE, 'credit_refunded');
      expect(refundEvents).toHaveLength(1);
      expect(refundEvents[0].metadata.refunded_amount).toBe(MENU_CREATE_COST);
      expect(refundEvents[0].metadata.reason).toContain('credits refunded');
    });

    it('should not create menu record when creation fails', () => {
      system.createMenuWithCreditGate(
        TENANT_FREE,
        { name: 'No Menu', productIds: [] },
        { simulateMenuFailure: true },
      );

      const menus = system.getMenus(TENANT_FREE);
      expect(menus).toHaveLength(0);
    });

    it('should restore lifetimeSpent after refund', () => {
      system.createMenuWithCreditGate(
        TENANT_FREE,
        { name: 'Lifetime Fix', productIds: [] },
        { simulateMenuFailure: true },
      );

      const credits = system.getBalance(TENANT_FREE)!;
      expect(credits.lifetimeSpent).toBe(0);
    });
  });

  // ==========================================================================
  // 7. Exact Balance Edge Case (balance === cost)
  // ==========================================================================

  describe('Edge case: balance exactly equals cost', () => {
    it('should allow menu creation when balance equals cost exactly', () => {
      const result = system.createMenuWithCreditGate(TENANT_LOW_BALANCE, {
        name: 'Last Credits Menu',
        productIds: [],
      });

      expect(result.success).toBe(true);
      expect(result.creditsConsumed).toBe(MENU_CREATE_COST);
      expect(result.creditsRemaining).toBe(0);
    });

    it('should set balance to 0 after using exact credits', () => {
      system.createMenuWithCreditGate(TENANT_LOW_BALANCE, {
        name: 'Zero Balance After',
        productIds: [],
      });

      const credits = system.getBalance(TENANT_LOW_BALANCE)!;
      expect(credits.balance).toBe(0);
    });

    it('should block the next menu creation after draining to 0', () => {
      // First: succeeds (100 - 100 = 0)
      const r1 = system.createMenuWithCreditGate(TENANT_LOW_BALANCE, {
        name: 'Last One',
        productIds: [],
      });
      expect(r1.success).toBe(true);

      // Second: blocked (0 < 100)
      const r2 = system.createMenuWithCreditGate(TENANT_LOW_BALANCE, {
        name: 'One Too Many',
        productIds: [],
      });
      expect(r2.success).toBe(false);
      expect(r2.statusCode).toBe(402);
    });
  });

  // ==========================================================================
  // 8. Multiple Sequential Menu Creations
  // ==========================================================================

  describe('Multiple sequential menu creations', () => {
    it('should deduct credits cumulatively across creations', () => {
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'Menu 1', productIds: [] });
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'Menu 2', productIds: [] });
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'Menu 3', productIds: [] });

      const credits = system.getBalance(TENANT_FREE)!;
      expect(credits.balance).toBe(500 - (3 * MENU_CREATE_COST)); // 200
      expect(credits.lifetimeSpent).toBe(3 * MENU_CREATE_COST); // 300
    });

    it('should create one transaction per menu creation', () => {
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'M1', productIds: [] });
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'M2', productIds: [] });
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'M3', productIds: [] });

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(3);

      // Verify balance decreasing across transactions
      expect(txns[0].balanceAfter).toBe(400);
      expect(txns[1].balanceAfter).toBe(300);
      expect(txns[2].balanceAfter).toBe(200);
    });

    it('should block 6th creation when starting with 500 credits', () => {
      // 5 menus * 100 credits = 500 credits total (all 500 used)
      for (let i = 0; i < 5; i++) {
        const r = system.createMenuWithCreditGate(TENANT_FREE, {
          name: `Menu ${i + 1}`,
          productIds: [],
        });
        expect(r.success).toBe(true);
      }

      expect(system.getBalance(TENANT_FREE)!.balance).toBe(0);

      // 6th should be blocked
      const r6 = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Menu 6',
        productIds: [],
      });
      expect(r6.success).toBe(false);
      expect(r6.statusCode).toBe(402);
    });

    it('should accumulate daily usage counter across creations', () => {
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'D1', productIds: [] });
      system.createMenuWithCreditGate(TENANT_FREE, { name: 'D2', productIds: [] });

      const credits = system.getBalance(TENANT_FREE)!;
      expect(credits.creditsUsedToday).toBe(200);
      expect(credits.creditsUsedThisWeek).toBe(200);
      expect(credits.creditsUsedThisMonth).toBe(200);
    });
  });

  // ==========================================================================
  // 9. Cross-Action Credit Deduction (Menu + Other Actions)
  // ==========================================================================

  describe('Cross-action credit deduction consistency', () => {
    it('should deduct different amounts for different actions', () => {
      // Menu create: 100 credits
      system.consumeCredits(TENANT_FREE, 'menu_create');
      expect(system.getBalance(TENANT_FREE)!.balance).toBe(400);

      // SMS send: 25 credits
      system.consumeCredits(TENANT_FREE, 'send_sms');
      expect(system.getBalance(TENANT_FREE)!.balance).toBe(375);

      // Email send: 10 credits
      system.consumeCredits(TENANT_FREE, 'send_email');
      expect(system.getBalance(TENANT_FREE)!.balance).toBe(365);
    });

    it('should track all actions in separate transactions', () => {
      system.consumeCredits(TENANT_FREE, 'menu_create');
      system.consumeCredits(TENANT_FREE, 'send_sms');

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(2);
      expect(txns[0].actionKey).toBe('menu_create');
      expect(txns[0].amount).toBe(-100);
      expect(txns[1].actionKey).toBe('send_sms');
      expect(txns[1].amount).toBe(-25);
    });

    it('should block menu creation but allow cheaper SMS when low', () => {
      system.setupTenant('tenant-tight', { balance: 50, isFreeTier: true });

      // Menu costs 100 — should fail
      const menuResult = system.consumeCredits('tenant-tight', 'menu_create');
      expect(menuResult.success).toBe(false);

      // SMS costs 25 — should pass
      const smsResult = system.consumeCredits('tenant-tight', 'send_sms');
      expect(smsResult.success).toBe(true);
      expect(smsResult.balance).toBe(25);
    });
  });

  // ==========================================================================
  // 10. Free Actions Don't Deduct Credits
  // ==========================================================================

  describe('Free actions do not deduct credits', () => {
    it('should not deduct credits for dashboard_view (0 cost)', () => {
      const before = system.getBalance(TENANT_FREE)!.balance;

      const result = system.consumeCredits(TENANT_FREE, 'dashboard_view');
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(0);

      const after = system.getBalance(TENANT_FREE)!.balance;
      expect(after).toBe(before);
    });

    it('should not create transaction for free actions', () => {
      system.consumeCredits(TENANT_FREE, 'dashboard_view');

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 11. Unknown Action Key Handling
  // ==========================================================================

  describe('Unknown action keys are rejected', () => {
    it('should fail for unknown action key', () => {
      const result = system.consumeCredits(TENANT_FREE, 'nonexistent_action');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action key');
    });

    it('should not deduct credits for unknown action', () => {
      system.consumeCredits(TENANT_FREE, 'nonexistent_action');

      const credits = system.getBalance(TENANT_FREE)!;
      expect(credits.balance).toBe(500);
    });
  });

  // ==========================================================================
  // 12. Complete End-to-End Flow
  // ==========================================================================

  describe('Complete E2E: tenant creates menu, credits deducted, transaction logged, analytics tracked', () => {
    it('should complete the full flow successfully', () => {
      // Pre-conditions
      const before = system.getBalance(TENANT_FREE)!;
      expect(before.balance).toBe(500);
      expect(before.isFreeTier).toBe(true);
      expect(system.getMenus(TENANT_FREE)).toHaveLength(0);
      expect(system.getTransactions(TENANT_FREE)).toHaveLength(0);
      expect(system.getAnalytics(TENANT_FREE)).toHaveLength(0);

      // Act: create menu
      const result = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Full E2E Menu',
        productIds: ['p1', 'p2', 'p3'],
      });

      // Assert: menu created
      expect(result.success).toBe(true);
      expect(result.menu!.name).toBe('Full E2E Menu');
      expect(result.menu!.status).toBe('active');

      // Assert: credits deducted
      expect(result.creditsConsumed).toBe(100);
      expect(result.creditsRemaining).toBe(400);
      const after = system.getBalance(TENANT_FREE)!;
      expect(after.balance).toBe(400);
      expect(after.lifetimeSpent).toBe(100);

      // Assert: transaction recorded
      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(1);
      expect(txns[0].transactionType).toBe('usage');
      expect(txns[0].amount).toBe(-100);
      expect(txns[0].balanceAfter).toBe(400);
      expect(txns[0].actionKey).toBe('menu_create');
      expect(txns[0].referenceId).toBe(result.menu!.id);
      expect(txns[0].referenceType).toBe('menu');

      // Assert: analytics logged
      const events = system.getAnalytics(TENANT_FREE, 'credit_consumed');
      expect(events).toHaveLength(1);
      expect(events[0].actionAttempted).toBe('menu_create');
      expect(events[0].creditsAtEvent).toBe(400);

      // Assert: menu exists in list
      const menus = system.getMenus(TENANT_FREE);
      expect(menus).toHaveLength(1);
      expect(menus[0].id).toBe(result.menu!.id);
    });

    it('should handle create → block → purchase → retry flow', () => {
      // Use up all credits
      for (let i = 0; i < 5; i++) {
        system.createMenuWithCreditGate(TENANT_FREE, {
          name: `Menu ${i + 1}`,
          productIds: [],
        });
      }
      expect(system.getBalance(TENANT_FREE)!.balance).toBe(0);

      // Attempt another — blocked
      const blocked = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Blocked Menu',
        productIds: [],
      });
      expect(blocked.success).toBe(false);
      expect(blocked.statusCode).toBe(402);

      // Simulate credit purchase (add 5000 credits)
      const tenant = system.getBalance(TENANT_FREE)!;
      tenant.balance += 5000;
      tenant.lifetimeEarned += 5000;

      // Retry — should succeed
      const retried = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Post-Purchase Menu',
        productIds: [],
      });
      expect(retried.success).toBe(true);
      expect(retried.creditsConsumed).toBe(100);
      expect(retried.creditsRemaining).toBe(4900);

      // Should have 7 total transactions (5 success + 1 retry)
      // Note: blocked attempt does NOT create a usage transaction
      const txns = system.getTransactions(TENANT_FREE);
      const usageTxns = txns.filter(t => t.transactionType === 'usage');
      expect(usageTxns).toHaveLength(6);
    });

    it('should handle failure + refund + retry flow', () => {
      // Attempt that fails
      const failed = system.createMenuWithCreditGate(
        TENANT_FREE,
        { name: 'Doomed Menu', productIds: [] },
        { simulateMenuFailure: true },
      );
      expect(failed.success).toBe(false);
      expect(system.getBalance(TENANT_FREE)!.balance).toBe(500); // refunded

      // Retry successfully
      const success = system.createMenuWithCreditGate(TENANT_FREE, {
        name: 'Retry Menu',
        productIds: [],
      });
      expect(success.success).toBe(true);
      expect(system.getBalance(TENANT_FREE)!.balance).toBe(400);

      // 3 transactions: usage + refund + usage
      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(3);
      expect(txns[0].transactionType).toBe('usage');
      expect(txns[1].transactionType).toBe('refund');
      expect(txns[2].transactionType).toBe('usage');

      // 1 menu created (the second attempt)
      const menus = system.getMenus(TENANT_FREE);
      expect(menus).toHaveLength(1);
      expect(menus[0].name).toBe('Retry Menu');
    });
  });
});
