/**
 * Credit Purchase Flow Integration Test
 *
 * Tests the complete credit purchase lifecycle:
 * 1. Select a credit package
 * 2. Apply promo code and verify discount
 * 3. Complete Stripe payment (checkout session)
 * 4. Verify credits added to balance
 * 5. Verify transaction recorded
 * 6. Verify receipt email sent
 *
 * This validates:
 * - Package selection with correct pricing
 * - Promo code validation and discount calculation
 * - Stripe checkout session creation
 * - Credit granting after payment
 * - Transaction ledger recording
 * - Email receipt dispatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface CreditPackage {
  id: string;
  name: string;
  slug: string;
  credits: number;
  priceCents: number;
  description: string;
  isActive: boolean;
  stripePriceId: string | null;
  stripeProductId: string | null;
}

interface PromoCode {
  id: string;
  code: string;
  creditsAmount: number;
  discountPercent: number | null;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
  validFrom: Date;
  validUntil: Date | null;
}

interface CreditBalance {
  tenantId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  isFreeTier: boolean;
}

interface CreditTransaction {
  id: string;
  tenantId: string;
  amount: number;
  balanceAfter: number;
  transactionType: 'free_grant' | 'purchase' | 'usage' | 'refund' | 'bonus' | 'adjustment';
  actionType: string | null;
  referenceId: string | null;
  referenceType: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface StripeCheckoutSession {
  id: string;
  url: string;
  paymentIntentId: string;
  customerId: string;
  amountTotal: number;
  status: 'open' | 'complete' | 'expired';
  metadata: Record<string, string>;
}

interface EmailReceipt {
  to: string;
  subject: string;
  tenantId: string;
  packageName: string;
  credits: number;
  amountPaid: number;
  transactionId: string;
  sentAt: Date;
}

// ============================================================================
// In-Memory System Simulation
// ============================================================================

/**
 * Simulates the credit purchase system (database + Stripe + email)
 * without requiring live services. Tests business logic atomicity.
 */
class CreditPurchaseSystem {
  packages: Map<string, CreditPackage> = new Map();
  promoCodes: Map<string, PromoCode> = new Map();
  promoRedemptions: Map<string, Set<string>> = new Map(); // tenantId -> Set<promoCodeId>
  balances: Map<string, CreditBalance> = new Map();
  transactions: CreditTransaction[] = [];
  checkoutSessions: Map<string, StripeCheckoutSession> = new Map();
  emailsSent: EmailReceipt[] = [];
  analyticsEvents: Array<{ tenantId: string; eventType: string; metadata: Record<string, unknown> }> = [];

  constructor() {
    this.seedPackages();
  }

  private seedPackages(): void {
    const packages: CreditPackage[] = [
      {
        id: 'pkg-1',
        name: 'Starter Pack',
        slug: 'starter-pack',
        credits: 5000,
        priceCents: 999,
        description: '5,000 credits for quick top-up',
        isActive: true,
        stripePriceId: 'price_starter',
        stripeProductId: 'prod_starter',
      },
      {
        id: 'pkg-2',
        name: 'Growth Pack',
        slug: 'growth-pack',
        credits: 15000,
        priceCents: 2499,
        description: '15,000 credits for growing businesses',
        isActive: true,
        stripePriceId: 'price_growth',
        stripeProductId: 'prod_growth',
      },
      {
        id: 'pkg-3',
        name: 'Power Pack',
        slug: 'power-pack',
        credits: 50000,
        priceCents: 4999,
        description: '50,000 credits for power users',
        isActive: true,
        stripePriceId: 'price_power',
        stripeProductId: 'prod_power',
      },
      {
        id: 'pkg-4',
        name: 'Enterprise Pack',
        slug: 'enterprise-pack',
        credits: 150000,
        priceCents: 12999,
        description: '150,000 credits for enterprises',
        isActive: true,
        stripePriceId: 'price_enterprise',
        stripeProductId: 'prod_enterprise',
      },
    ];

    packages.forEach(p => this.packages.set(p.slug, p));
  }

  addPromoCode(promo: PromoCode): void {
    this.promoCodes.set(promo.code, promo);
  }

  setBalance(tenantId: string, balance: number): void {
    this.balances.set(tenantId, {
      tenantId,
      balance,
      lifetimeEarned: balance,
      lifetimeSpent: 0,
      isFreeTier: true,
    });
  }

  getBalance(tenantId: string): CreditBalance {
    return this.balances.get(tenantId) || {
      tenantId,
      balance: 500,
      lifetimeEarned: 500,
      lifetimeSpent: 0,
      isFreeTier: true,
    };
  }

  // Step 1: Select package
  selectPackage(packageSlug: string): {
    success: boolean;
    package?: CreditPackage;
    error?: string;
  } {
    const pkg = this.packages.get(packageSlug);
    if (!pkg) {
      return { success: false, error: 'Package not found' };
    }
    if (!pkg.isActive) {
      return { success: false, error: 'Package is no longer available' };
    }
    return { success: true, package: pkg };
  }

  // Step 2: Validate and apply promo code
  validatePromoCode(code: string, tenantId: string): {
    valid: boolean;
    promoCode?: PromoCode;
    error?: string;
  } {
    const promo = this.promoCodes.get(code.toUpperCase());

    if (!promo) {
      return { valid: false, error: 'Invalid promo code' };
    }

    if (!promo.isActive) {
      return { valid: false, error: 'Promo code is inactive' };
    }

    if (promo.validFrom > new Date()) {
      return { valid: false, error: 'Promo code is not yet active' };
    }

    if (promo.validUntil && promo.validUntil < new Date()) {
      return { valid: false, error: 'Promo code has expired' };
    }

    if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
      return { valid: false, error: 'Promo code has reached max uses' };
    }

    // Check if tenant already redeemed
    const tenantRedemptions = this.promoRedemptions.get(tenantId);
    if (tenantRedemptions?.has(promo.id)) {
      return { valid: false, error: 'Already redeemed this promo code' };
    }

    return { valid: true, promoCode: promo };
  }

  // Calculate discount
  calculateDiscount(
    packagePriceCents: number,
    promoCode: PromoCode | null
  ): {
    originalPriceCents: number;
    discountCents: number;
    finalPriceCents: number;
    bonusCredits: number;
  } {
    if (!promoCode) {
      return {
        originalPriceCents: packagePriceCents,
        discountCents: 0,
        finalPriceCents: packagePriceCents,
        bonusCredits: 0,
      };
    }

    let discountCents = 0;
    if (promoCode.discountPercent) {
      discountCents = Math.floor(packagePriceCents * (promoCode.discountPercent / 100));
    }

    return {
      originalPriceCents: packagePriceCents,
      discountCents,
      finalPriceCents: packagePriceCents - discountCents,
      bonusCredits: promoCode.creditsAmount,
    };
  }

  // Step 3: Create Stripe checkout session
  createCheckoutSession(params: {
    tenantId: string;
    packageSlug: string;
    priceCents: number;
    credits: number;
    promoCode?: string;
    successUrl: string;
    cancelUrl: string;
  }): { success: boolean; session?: StripeCheckoutSession; error?: string } {
    if (!params.tenantId) {
      return { success: false, error: 'Tenant ID is required' };
    }

    const pkg = this.packages.get(params.packageSlug);
    if (!pkg) {
      return { success: false, error: 'Invalid package' };
    }

    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const session: StripeCheckoutSession = {
      id: sessionId,
      url: `https://checkout.stripe.com/c/pay/${sessionId}`,
      paymentIntentId: `pi_${sessionId}`,
      customerId: `cus_${params.tenantId.slice(0, 8)}`,
      amountTotal: params.priceCents,
      status: 'open',
      metadata: {
        tenant_id: params.tenantId,
        package_slug: params.packageSlug,
        credits: params.credits.toString(),
        type: 'credit_purchase',
        promo_code: params.promoCode || '',
      },
    };

    this.checkoutSessions.set(sessionId, session);

    // Track analytics
    this.analyticsEvents.push({
      tenantId: params.tenantId,
      eventType: 'purchase_checkout_started',
      metadata: {
        package_slug: params.packageSlug,
        credits: params.credits,
        price_cents: params.priceCents,
        checkout_session_id: sessionId,
        promo_code: params.promoCode,
      },
    });

    return { success: true, session };
  }

  // Step 4: Complete payment (webhook handler simulation)
  completePayment(sessionId: string): {
    success: boolean;
    creditsAdded?: number;
    newBalance?: number;
    transactionId?: string;
    error?: string;
  } {
    const session = this.checkoutSessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'complete') {
      return { success: false, error: 'Session already completed (idempotency)' };
    }

    // Mark session as complete
    session.status = 'complete';

    const tenantId = session.metadata.tenant_id;
    const credits = parseInt(session.metadata.credits, 10);
    const promoCode = session.metadata.promo_code;

    // Get current balance
    const currentBalance = this.getBalance(tenantId);
    let totalCredits = credits;

    // Apply promo bonus credits if promo code was used
    if (promoCode) {
      const promo = this.promoCodes.get(promoCode);
      if (promo) {
        totalCredits += promo.creditsAmount;
        promo.usesCount++;

        // Record redemption
        if (!this.promoRedemptions.has(tenantId)) {
          this.promoRedemptions.set(tenantId, new Set());
        }
        this.promoRedemptions.get(tenantId)!.add(promo.id);
      }
    }

    // Update balance
    const newBalance = currentBalance.balance + totalCredits;
    this.balances.set(tenantId, {
      ...currentBalance,
      balance: newBalance,
      lifetimeEarned: currentBalance.lifetimeEarned + totalCredits,
    });

    // Record transaction
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const transaction: CreditTransaction = {
      id: transactionId,
      tenantId,
      amount: totalCredits,
      balanceAfter: newBalance,
      transactionType: 'purchase',
      actionType: 'credit_purchase',
      referenceId: session.paymentIntentId,
      referenceType: 'stripe_payment',
      description: `Purchased ${this.packages.get(session.metadata.package_slug)?.name || 'credits'}${promoCode ? ` + promo ${promoCode}` : ''}`,
      metadata: {
        package_slug: session.metadata.package_slug,
        stripe_session_id: sessionId,
        payment_intent_id: session.paymentIntentId,
        amount_paid_cents: session.amountTotal,
        promo_code: promoCode || null,
        base_credits: credits,
        bonus_credits: totalCredits - credits,
      },
      createdAt: new Date().toISOString(),
    };
    this.transactions.push(transaction);

    // Track analytics
    this.analyticsEvents.push({
      tenantId,
      eventType: 'purchase_completed',
      metadata: {
        package_slug: session.metadata.package_slug,
        credits_added: totalCredits,
        amount_paid_cents: session.amountTotal,
        new_balance: newBalance,
        promo_code: promoCode,
      },
    });

    return {
      success: true,
      creditsAdded: totalCredits,
      newBalance,
      transactionId,
    };
  }

  // Step 5: Send receipt email
  sendReceiptEmail(params: {
    tenantId: string;
    email: string;
    packageSlug: string;
    credits: number;
    amountPaidCents: number;
    transactionId: string;
  }): { success: boolean; error?: string } {
    const pkg = this.packages.get(params.packageSlug);
    if (!pkg) {
      return { success: false, error: 'Package not found for receipt' };
    }

    const receipt: EmailReceipt = {
      to: params.email,
      subject: `Receipt: ${pkg.name} - ${params.credits.toLocaleString()} Credits`,
      tenantId: params.tenantId,
      packageName: pkg.name,
      credits: params.credits,
      amountPaid: params.amountPaidCents / 100,
      transactionId: params.transactionId,
      sentAt: new Date(),
    };

    this.emailsSent.push(receipt);

    // Track analytics
    this.analyticsEvents.push({
      tenantId: params.tenantId,
      eventType: 'receipt_email_sent',
      metadata: {
        email: params.email,
        transaction_id: params.transactionId,
      },
    });

    return { success: true };
  }

  // Get transactions for a tenant
  getTransactions(tenantId: string): CreditTransaction[] {
    return this.transactions.filter(t => t.tenantId === tenantId);
  }

  // Get emails sent for a tenant
  getEmailsSent(tenantId: string): EmailReceipt[] {
    return this.emailsSent.filter(e => e.tenantId === tenantId);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

const TEST_TENANT_ID = 'tenant-test-123';
const TEST_TENANT_EMAIL = 'owner@testcannabis.com';

describe('Credit Purchase Flow Integration', () => {
  let system: CreditPurchaseSystem;

  beforeEach(() => {
    system = new CreditPurchaseSystem();
    system.setBalance(TEST_TENANT_ID, 500); // Free tier starting balance
  });

  // ==========================================================================
  // Step 1: Package Selection
  // ==========================================================================

  describe('Step 1: Package Selection', () => {
    it('should list all 4 available packages', () => {
      const slugs = ['starter-pack', 'growth-pack', 'power-pack', 'enterprise-pack'];
      slugs.forEach(slug => {
        const result = system.selectPackage(slug);
        expect(result.success).toBe(true);
        expect(result.package).toBeDefined();
      });
    });

    it('should select starter pack with correct pricing', () => {
      const result = system.selectPackage('starter-pack');
      expect(result.success).toBe(true);
      expect(result.package?.credits).toBe(5000);
      expect(result.package?.priceCents).toBe(999);
      expect(result.package?.name).toBe('Starter Pack');
    });

    it('should select growth pack with correct pricing', () => {
      const result = system.selectPackage('growth-pack');
      expect(result.success).toBe(true);
      expect(result.package?.credits).toBe(15000);
      expect(result.package?.priceCents).toBe(2499);
    });

    it('should select power pack with correct pricing', () => {
      const result = system.selectPackage('power-pack');
      expect(result.success).toBe(true);
      expect(result.package?.credits).toBe(50000);
      expect(result.package?.priceCents).toBe(4999);
    });

    it('should select enterprise pack with correct pricing', () => {
      const result = system.selectPackage('enterprise-pack');
      expect(result.success).toBe(true);
      expect(result.package?.credits).toBe(150000);
      expect(result.package?.priceCents).toBe(12999);
    });

    it('should reject invalid package slug', () => {
      const result = system.selectPackage('invalid-pack');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Package not found');
    });

    it('should reject inactive package', () => {
      const pkg = system.packages.get('starter-pack')!;
      pkg.isActive = false;

      const result = system.selectPackage('starter-pack');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Package is no longer available');
    });

    it('should have price per credit decreasing for larger packages', () => {
      const slugs = ['starter-pack', 'growth-pack', 'power-pack', 'enterprise-pack'];
      const pricesPerCredit = slugs.map(slug => {
        const result = system.selectPackage(slug);
        const pkg = result.package!;
        return pkg.priceCents / pkg.credits;
      });

      for (let i = 1; i < pricesPerCredit.length; i++) {
        expect(pricesPerCredit[i]).toBeLessThan(pricesPerCredit[i - 1]);
      }
    });
  });

  // ==========================================================================
  // Step 2: Promo Code Application
  // ==========================================================================

  describe('Step 2: Promo Code Validation and Discount', () => {
    beforeEach(() => {
      system.addPromoCode({
        id: 'promo-1',
        code: 'SAVE20',
        creditsAmount: 1000,
        discountPercent: 20,
        maxUses: 100,
        usesCount: 5,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2027-12-31'),
      });

      system.addPromoCode({
        id: 'promo-2',
        code: 'BONUS500',
        creditsAmount: 500,
        discountPercent: null,
        maxUses: null,
        usesCount: 0,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      system.addPromoCode({
        id: 'promo-3',
        code: 'EXPIRED',
        creditsAmount: 2000,
        discountPercent: 50,
        maxUses: null,
        usesCount: 0,
        isActive: true,
        validFrom: new Date('2023-01-01'),
        validUntil: new Date('2023-12-31'),
      });

      system.addPromoCode({
        id: 'promo-4',
        code: 'MAXEDOUT',
        creditsAmount: 100,
        discountPercent: 10,
        maxUses: 5,
        usesCount: 5,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      system.addPromoCode({
        id: 'promo-5',
        code: 'INACTIVE',
        creditsAmount: 5000,
        discountPercent: 75,
        maxUses: null,
        usesCount: 0,
        isActive: false,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });
    });

    it('should validate a valid promo code', () => {
      const result = system.validatePromoCode('SAVE20', TEST_TENANT_ID);
      expect(result.valid).toBe(true);
      expect(result.promoCode?.code).toBe('SAVE20');
      expect(result.promoCode?.creditsAmount).toBe(1000);
      expect(result.promoCode?.discountPercent).toBe(20);
    });

    it('should validate promo code case-insensitively', () => {
      const result = system.validatePromoCode('save20', TEST_TENANT_ID);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid promo code', () => {
      const result = system.validatePromoCode('NOTEXIST', TEST_TENANT_ID);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid promo code');
    });

    it('should reject expired promo code', () => {
      const result = system.validatePromoCode('EXPIRED', TEST_TENANT_ID);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promo code has expired');
    });

    it('should reject max-used promo code', () => {
      const result = system.validatePromoCode('MAXEDOUT', TEST_TENANT_ID);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promo code has reached max uses');
    });

    it('should reject inactive promo code', () => {
      const result = system.validatePromoCode('INACTIVE', TEST_TENANT_ID);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promo code is inactive');
    });

    it('should reject already-redeemed promo code', () => {
      // Simulate prior redemption
      system.promoRedemptions.set(TEST_TENANT_ID, new Set(['promo-1']));

      const result = system.validatePromoCode('SAVE20', TEST_TENANT_ID);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Already redeemed this promo code');
    });

    it('should calculate 20% discount on growth pack', () => {
      const promoResult = system.validatePromoCode('SAVE20', TEST_TENANT_ID);
      const pkg = system.selectPackage('growth-pack').package!;

      const discount = system.calculateDiscount(pkg.priceCents, promoResult.promoCode!);

      expect(discount.originalPriceCents).toBe(2499);
      expect(discount.discountCents).toBe(Math.floor(2499 * 0.20)); // 499
      expect(discount.finalPriceCents).toBe(2499 - 499); // 2000
      expect(discount.bonusCredits).toBe(1000);
    });

    it('should give bonus credits without discount for BONUS500', () => {
      const promoResult = system.validatePromoCode('BONUS500', TEST_TENANT_ID);
      const pkg = system.selectPackage('power-pack').package!;

      const discount = system.calculateDiscount(pkg.priceCents, promoResult.promoCode!);

      expect(discount.originalPriceCents).toBe(4999);
      expect(discount.discountCents).toBe(0); // No percentage discount
      expect(discount.finalPriceCents).toBe(4999);
      expect(discount.bonusCredits).toBe(500);
    });

    it('should return no discount without promo code', () => {
      const pkg = system.selectPackage('starter-pack').package!;
      const discount = system.calculateDiscount(pkg.priceCents, null);

      expect(discount.originalPriceCents).toBe(999);
      expect(discount.discountCents).toBe(0);
      expect(discount.finalPriceCents).toBe(999);
      expect(discount.bonusCredits).toBe(0);
    });
  });

  // ==========================================================================
  // Step 3: Stripe Checkout Session
  // ==========================================================================

  describe('Step 3: Stripe Checkout Session Creation', () => {
    it('should create checkout session for selected package', () => {
      const result = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: 2499,
        credits: 15000,
        successUrl: 'https://app.floraiq.com/test/admin/credits/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://app.floraiq.com/test/admin/credits/cancelled',
      });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.url).toContain('https://checkout.stripe.com');
      expect(result.session?.status).toBe('open');
      expect(result.session?.amountTotal).toBe(2499);
    });

    it('should include correct metadata in checkout session', () => {
      const result = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'power-pack',
        priceCents: 4999,
        credits: 50000,
        promoCode: 'SAVE20',
        successUrl: 'https://app.floraiq.com/test/admin/credits/success',
        cancelUrl: 'https://app.floraiq.com/test/admin/credits/cancelled',
      });

      expect(result.session?.metadata.tenant_id).toBe(TEST_TENANT_ID);
      expect(result.session?.metadata.package_slug).toBe('power-pack');
      expect(result.session?.metadata.credits).toBe('50000');
      expect(result.session?.metadata.type).toBe('credit_purchase');
      expect(result.session?.metadata.promo_code).toBe('SAVE20');
    });

    it('should track checkout_started analytics event', () => {
      system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const events = system.analyticsEvents.filter(
        e => e.tenantId === TEST_TENANT_ID && e.eventType === 'purchase_checkout_started'
      );
      expect(events).toHaveLength(1);
      expect(events[0].metadata.package_slug).toBe('starter-pack');
      expect(events[0].metadata.credits).toBe(5000);
    });

    it('should reject checkout without tenant ID', () => {
      const result = system.createCheckoutSession({
        tenantId: '',
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant ID is required');
    });

    it('should reject checkout with invalid package', () => {
      const result = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'nonexistent-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid package');
    });
  });

  // ==========================================================================
  // Step 4: Payment Completion and Credit Granting
  // ==========================================================================

  describe('Step 4: Payment Completion - Credits Added to Balance', () => {
    it('should add credits to balance after successful payment', () => {
      const initialBalance = system.getBalance(TEST_TENANT_ID).balance;
      expect(initialBalance).toBe(500);

      // Create and complete checkout
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: 2499,
        credits: 15000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);

      expect(paymentResult.success).toBe(true);
      expect(paymentResult.creditsAdded).toBe(15000);
      expect(paymentResult.newBalance).toBe(500 + 15000);

      // Verify balance is updated
      const finalBalance = system.getBalance(TEST_TENANT_ID);
      expect(finalBalance.balance).toBe(15500);
      expect(finalBalance.lifetimeEarned).toBe(500 + 15000);
    });

    it('should add package credits + promo bonus credits', () => {
      system.addPromoCode({
        id: 'promo-bonus',
        code: 'BONUS2000',
        creditsAmount: 2000,
        discountPercent: null,
        maxUses: null,
        usesCount: 0,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'power-pack',
        priceCents: 4999,
        credits: 50000,
        promoCode: 'BONUS2000',
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);

      // 50000 package + 2000 bonus
      expect(paymentResult.creditsAdded).toBe(52000);
      expect(paymentResult.newBalance).toBe(500 + 52000);
    });

    it('should prevent double-processing (idempotency)', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      // First completion should succeed
      const first = system.completePayment(checkoutResult.session!.id);
      expect(first.success).toBe(true);
      expect(first.newBalance).toBe(5500);

      // Second completion should fail (idempotent)
      const second = system.completePayment(checkoutResult.session!.id);
      expect(second.success).toBe(false);
      expect(second.error).toBe('Session already completed (idempotency)');

      // Balance should not change
      expect(system.getBalance(TEST_TENANT_ID).balance).toBe(5500);
    });

    it('should handle enterprise pack with maximum credits', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'enterprise-pack',
        priceCents: 12999,
        credits: 150000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);

      expect(paymentResult.success).toBe(true);
      expect(paymentResult.creditsAdded).toBe(150000);
      expect(paymentResult.newBalance).toBe(150500);
    });

    it('should reject invalid session ID', () => {
      const result = system.completePayment('cs_invalid_session');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should increment promo code uses count after payment', () => {
      system.addPromoCode({
        id: 'promo-use-track',
        code: 'TRACKME',
        creditsAmount: 100,
        discountPercent: 10,
        maxUses: 50,
        usesCount: 10,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        promoCode: 'TRACKME',
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      system.completePayment(checkoutResult.session!.id);

      const promo = system.promoCodes.get('TRACKME')!;
      expect(promo.usesCount).toBe(11);
    });

    it('should record promo redemption to prevent double-use', () => {
      system.addPromoCode({
        id: 'promo-once',
        code: 'ONCEONLY',
        creditsAmount: 500,
        discountPercent: null,
        maxUses: null,
        usesCount: 0,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        promoCode: 'ONCEONLY',
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      system.completePayment(checkoutResult.session!.id);

      // Tenant should not be able to validate same promo again
      const validateResult = system.validatePromoCode('ONCEONLY', TEST_TENANT_ID);
      expect(validateResult.valid).toBe(false);
      expect(validateResult.error).toBe('Already redeemed this promo code');
    });
  });

  // ==========================================================================
  // Step 5: Transaction Recording
  // ==========================================================================

  describe('Step 5: Transaction Recording', () => {
    it('should record a purchase transaction', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: 2499,
        credits: 15000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);
      expect(paymentResult.transactionId).toBeDefined();

      const transactions = system.getTransactions(TEST_TENANT_ID);
      expect(transactions).toHaveLength(1);

      const txn = transactions[0];
      expect(txn.tenantId).toBe(TEST_TENANT_ID);
      expect(txn.amount).toBe(15000);
      expect(txn.balanceAfter).toBe(15500);
      expect(txn.transactionType).toBe('purchase');
      expect(txn.actionType).toBe('credit_purchase');
      expect(txn.referenceType).toBe('stripe_payment');
    });

    it('should record transaction with promo code metadata', () => {
      system.addPromoCode({
        id: 'promo-meta',
        code: 'META20',
        creditsAmount: 1000,
        discountPercent: 20,
        maxUses: null,
        usesCount: 0,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'power-pack',
        priceCents: 4999,
        credits: 50000,
        promoCode: 'META20',
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      system.completePayment(checkoutResult.session!.id);

      const transactions = system.getTransactions(TEST_TENANT_ID);
      const txn = transactions[0];

      expect(txn.metadata.promo_code).toBe('META20');
      expect(txn.metadata.base_credits).toBe(50000);
      expect(txn.metadata.bonus_credits).toBe(1000);
      expect(txn.metadata.package_slug).toBe('power-pack');
      expect(txn.metadata.amount_paid_cents).toBe(4999);
      expect(txn.amount).toBe(51000); // 50000 + 1000 bonus
    });

    it('should record payment intent reference', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      system.completePayment(checkoutResult.session!.id);

      const transactions = system.getTransactions(TEST_TENANT_ID);
      const txn = transactions[0];

      expect(txn.referenceId).toContain('pi_');
      expect(txn.metadata.stripe_session_id).toBe(checkoutResult.session!.id);
      expect(txn.metadata.payment_intent_id).toBe(checkoutResult.session!.paymentIntentId);
    });

    it('should have correct balance_after in transaction', () => {
      system.setBalance(TEST_TENANT_ID, 2000);

      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      system.completePayment(checkoutResult.session!.id);

      const transactions = system.getTransactions(TEST_TENANT_ID);
      expect(transactions[0].balanceAfter).toBe(7000); // 2000 + 5000
    });

    it('should record transaction description including package name', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'enterprise-pack',
        priceCents: 12999,
        credits: 150000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      system.completePayment(checkoutResult.session!.id);

      const transactions = system.getTransactions(TEST_TENANT_ID);
      expect(transactions[0].description).toContain('Enterprise Pack');
    });

    it('should track purchase_completed analytics event', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: 2499,
        credits: 15000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      system.completePayment(checkoutResult.session!.id);

      const completedEvents = system.analyticsEvents.filter(
        e => e.tenantId === TEST_TENANT_ID && e.eventType === 'purchase_completed'
      );
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].metadata.credits_added).toBe(15000);
      expect(completedEvents[0].metadata.amount_paid_cents).toBe(2499);
      expect(completedEvents[0].metadata.new_balance).toBe(15500);
    });
  });

  // ==========================================================================
  // Step 6: Receipt Email
  // ==========================================================================

  describe('Step 6: Receipt Email Sent', () => {
    it('should send receipt email after purchase', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: 2499,
        credits: 15000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);

      const emailResult = system.sendReceiptEmail({
        tenantId: TEST_TENANT_ID,
        email: TEST_TENANT_EMAIL,
        packageSlug: 'growth-pack',
        credits: paymentResult.creditsAdded!,
        amountPaidCents: 2499,
        transactionId: paymentResult.transactionId!,
      });

      expect(emailResult.success).toBe(true);

      const emails = system.getEmailsSent(TEST_TENANT_ID);
      expect(emails).toHaveLength(1);
    });

    it('should include correct details in receipt email', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'power-pack',
        priceCents: 4999,
        credits: 50000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);

      system.sendReceiptEmail({
        tenantId: TEST_TENANT_ID,
        email: TEST_TENANT_EMAIL,
        packageSlug: 'power-pack',
        credits: 50000,
        amountPaidCents: 4999,
        transactionId: paymentResult.transactionId!,
      });

      const email = system.getEmailsSent(TEST_TENANT_ID)[0];
      expect(email.to).toBe(TEST_TENANT_EMAIL);
      expect(email.subject).toContain('Power Pack');
      expect(email.subject).toContain('50,000');
      expect(email.packageName).toBe('Power Pack');
      expect(email.credits).toBe(50000);
      expect(email.amountPaid).toBe(49.99);
      expect(email.transactionId).toBe(paymentResult.transactionId);
    });

    it('should track receipt_email_sent analytics event', () => {
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);

      system.sendReceiptEmail({
        tenantId: TEST_TENANT_ID,
        email: TEST_TENANT_EMAIL,
        packageSlug: 'starter-pack',
        credits: 5000,
        amountPaidCents: 999,
        transactionId: paymentResult.transactionId!,
      });

      const emailEvents = system.analyticsEvents.filter(
        e => e.tenantId === TEST_TENANT_ID && e.eventType === 'receipt_email_sent'
      );
      expect(emailEvents).toHaveLength(1);
      expect(emailEvents[0].metadata.email).toBe(TEST_TENANT_EMAIL);
      expect(emailEvents[0].metadata.transaction_id).toBe(paymentResult.transactionId);
    });

    it('should include sentAt timestamp in receipt', () => {
      const before = new Date();

      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const paymentResult = system.completePayment(checkoutResult.session!.id);

      system.sendReceiptEmail({
        tenantId: TEST_TENANT_ID,
        email: TEST_TENANT_EMAIL,
        packageSlug: 'starter-pack',
        credits: 5000,
        amountPaidCents: 999,
        transactionId: paymentResult.transactionId!,
      });

      const after = new Date();
      const email = system.getEmailsSent(TEST_TENANT_ID)[0];

      expect(email.sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(email.sentAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ==========================================================================
  // End-to-End Flow
  // ==========================================================================

  describe('End-to-End: Complete Purchase Flow with Promo Code', () => {
    beforeEach(() => {
      system.addPromoCode({
        id: 'promo-e2e',
        code: 'WELCOME25',
        creditsAmount: 2500,
        discountPercent: 25,
        maxUses: 1000,
        usesCount: 42,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2027-12-31'),
      });
    });

    it('should complete full flow: select → promo → checkout → pay → verify balance → verify txn → verify email', () => {
      // Step 1: Select package
      const packageResult = system.selectPackage('growth-pack');
      expect(packageResult.success).toBe(true);
      const selectedPackage = packageResult.package!;
      expect(selectedPackage.credits).toBe(15000);
      expect(selectedPackage.priceCents).toBe(2499);

      // Step 2: Apply promo code
      const promoResult = system.validatePromoCode('WELCOME25', TEST_TENANT_ID);
      expect(promoResult.valid).toBe(true);
      expect(promoResult.promoCode?.creditsAmount).toBe(2500);
      expect(promoResult.promoCode?.discountPercent).toBe(25);

      // Calculate discount
      const discountInfo = system.calculateDiscount(
        selectedPackage.priceCents,
        promoResult.promoCode!
      );
      expect(discountInfo.originalPriceCents).toBe(2499);
      expect(discountInfo.discountCents).toBe(Math.floor(2499 * 0.25)); // 624
      expect(discountInfo.finalPriceCents).toBe(2499 - 624); // 1875
      expect(discountInfo.bonusCredits).toBe(2500);

      // Step 3: Create checkout session
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: discountInfo.finalPriceCents,
        credits: selectedPackage.credits,
        promoCode: 'WELCOME25',
        successUrl: 'https://app.floraiq.com/test/admin/credits/success',
        cancelUrl: 'https://app.floraiq.com/test/admin/credits/cancelled',
      });
      expect(checkoutResult.success).toBe(true);
      expect(checkoutResult.session?.url).toContain('stripe.com');

      // Step 4: Complete payment (simulates Stripe webhook)
      const paymentResult = system.completePayment(checkoutResult.session!.id);
      expect(paymentResult.success).toBe(true);
      // Package credits (15000) + promo bonus (2500)
      expect(paymentResult.creditsAdded).toBe(17500);
      expect(paymentResult.newBalance).toBe(500 + 17500); // 18000

      // Step 5: Verify credits added to balance
      const finalBalance = system.getBalance(TEST_TENANT_ID);
      expect(finalBalance.balance).toBe(18000);
      expect(finalBalance.lifetimeEarned).toBe(500 + 17500);

      // Step 6: Verify transaction recorded
      const transactions = system.getTransactions(TEST_TENANT_ID);
      expect(transactions).toHaveLength(1);
      const txn = transactions[0];
      expect(txn.transactionType).toBe('purchase');
      expect(txn.amount).toBe(17500);
      expect(txn.balanceAfter).toBe(18000);
      expect(txn.metadata.promo_code).toBe('WELCOME25');
      expect(txn.metadata.base_credits).toBe(15000);
      expect(txn.metadata.bonus_credits).toBe(2500);

      // Step 7: Verify receipt email sent
      system.sendReceiptEmail({
        tenantId: TEST_TENANT_ID,
        email: TEST_TENANT_EMAIL,
        packageSlug: 'growth-pack',
        credits: paymentResult.creditsAdded!,
        amountPaidCents: discountInfo.finalPriceCents,
        transactionId: paymentResult.transactionId!,
      });

      const emails = system.getEmailsSent(TEST_TENANT_ID);
      expect(emails).toHaveLength(1);
      expect(emails[0].to).toBe(TEST_TENANT_EMAIL);
      expect(emails[0].packageName).toBe('Growth Pack');
      expect(emails[0].credits).toBe(17500);
      expect(emails[0].amountPaid).toBeCloseTo(18.75, 2); // 1875 cents = $18.75
    });

    it('should complete full flow without promo code', () => {
      // Step 1: Select package
      const packageResult = system.selectPackage('enterprise-pack');
      expect(packageResult.success).toBe(true);

      // Step 2: No promo code
      const discountInfo = system.calculateDiscount(
        packageResult.package!.priceCents,
        null
      );
      expect(discountInfo.discountCents).toBe(0);
      expect(discountInfo.finalPriceCents).toBe(12999);

      // Step 3: Create checkout session
      const checkoutResult = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'enterprise-pack',
        priceCents: discountInfo.finalPriceCents,
        credits: packageResult.package!.credits,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });
      expect(checkoutResult.success).toBe(true);

      // Step 4: Complete payment
      const paymentResult = system.completePayment(checkoutResult.session!.id);
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.creditsAdded).toBe(150000);

      // Step 5: Verify balance
      expect(system.getBalance(TEST_TENANT_ID).balance).toBe(150500);

      // Step 6: Verify transaction
      const txn = system.getTransactions(TEST_TENANT_ID)[0];
      expect(txn.amount).toBe(150000);
      expect(txn.metadata.promo_code).toBeNull();
      expect(txn.metadata.bonus_credits).toBe(0);

      // Step 7: Verify email
      system.sendReceiptEmail({
        tenantId: TEST_TENANT_ID,
        email: TEST_TENANT_EMAIL,
        packageSlug: 'enterprise-pack',
        credits: 150000,
        amountPaidCents: 12999,
        transactionId: paymentResult.transactionId!,
      });

      const email = system.getEmailsSent(TEST_TENANT_ID)[0];
      expect(email.credits).toBe(150000);
      expect(email.amountPaid).toBeCloseTo(129.99, 2);
    });

    it('should handle multiple purchases accumulating credits', () => {
      // First purchase: starter pack
      const checkout1 = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });
      system.completePayment(checkout1.session!.id);
      expect(system.getBalance(TEST_TENANT_ID).balance).toBe(5500);

      // Second purchase: growth pack
      const checkout2 = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: 2499,
        credits: 15000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });
      system.completePayment(checkout2.session!.id);
      expect(system.getBalance(TEST_TENANT_ID).balance).toBe(20500);

      // Verify both transactions recorded
      const transactions = system.getTransactions(TEST_TENANT_ID);
      expect(transactions).toHaveLength(2);
      expect(transactions[0].balanceAfter).toBe(5500);
      expect(transactions[1].balanceAfter).toBe(20500);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero balance tenant purchasing credits', () => {
      system.setBalance(TEST_TENANT_ID, 0);

      const checkout = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const result = system.completePayment(checkout.session!.id);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(5000);
    });

    it('should not allow same promo code on multiple purchases by same tenant', () => {
      system.addPromoCode({
        id: 'promo-single',
        code: 'SINGLE',
        creditsAmount: 500,
        discountPercent: 10,
        maxUses: null,
        usesCount: 0,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      // First purchase with promo
      const checkout1 = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        promoCode: 'SINGLE',
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });
      system.completePayment(checkout1.session!.id);

      // Try to validate same promo again
      const secondValidation = system.validatePromoCode('SINGLE', TEST_TENANT_ID);
      expect(secondValidation.valid).toBe(false);
      expect(secondValidation.error).toBe('Already redeemed this promo code');
    });

    it('should allow different tenants to use same promo code', () => {
      system.addPromoCode({
        id: 'promo-shared',
        code: 'SHARED',
        creditsAmount: 1000,
        discountPercent: null,
        maxUses: null,
        usesCount: 0,
        isActive: true,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      });

      const tenant2Id = 'tenant-other-456';
      system.setBalance(tenant2Id, 500);

      // Tenant 1 uses promo
      const checkout1 = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        promoCode: 'SHARED',
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });
      system.completePayment(checkout1.session!.id);

      // Tenant 2 should still be able to validate
      const tenant2Validation = system.validatePromoCode('SHARED', tenant2Id);
      expect(tenant2Validation.valid).toBe(true);
    });

    it('should handle concurrent checkout sessions for same tenant', () => {
      const checkout1 = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'starter-pack',
        priceCents: 999,
        credits: 5000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      const checkout2 = system.createCheckoutSession({
        tenantId: TEST_TENANT_ID,
        packageSlug: 'growth-pack',
        priceCents: 2499,
        credits: 15000,
        successUrl: 'https://app.floraiq.com/success',
        cancelUrl: 'https://app.floraiq.com/cancelled',
      });

      // Both sessions should be valid
      expect(checkout1.success).toBe(true);
      expect(checkout2.success).toBe(true);
      expect(checkout1.session?.id).not.toBe(checkout2.session?.id);

      // Complete both
      system.completePayment(checkout1.session!.id);
      system.completePayment(checkout2.session!.id);

      // Both should accumulate
      expect(system.getBalance(TEST_TENANT_ID).balance).toBe(500 + 5000 + 15000);
    });

    it('should validate package slugs match allowed values', () => {
      const validSlugs = ['starter-pack', 'growth-pack', 'power-pack', 'enterprise-pack'];
      const invalidSlugs = ['mega-pack', 'free-pack', 'starter', 'pack'];

      validSlugs.forEach(slug => {
        expect(system.selectPackage(slug).success).toBe(true);
      });

      invalidSlugs.forEach(slug => {
        expect(system.selectPackage(slug).success).toBe(false);
      });
    });
  });
});
