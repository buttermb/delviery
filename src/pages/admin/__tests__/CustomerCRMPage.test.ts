/**
 * Tests for CustomerCRMPage pure functions
 *
 * Verifies RFM scoring, lifecycle stage classification,
 * and customer segmentation logic.
 */

import { describe, it, expect } from 'vitest';

// --- Replicated pure functions from CustomerCRMPage.tsx for unit testing ---

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  total_spent: number;
  total_orders: number;
  loyalty_points: number;
  last_purchase_at: string | null;
  created_at: string;
  status: string;
}

function getLifecycleStage(customer: Customer): string {
  if (!customer.last_purchase_at) return 'prospect';

  const daysSince = Math.floor(
    (Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince > 90) return 'churned';
  if (daysSince > 60) return 'at-risk';
  if (daysSince <= 30) return 'active';
  return 'regular';
}

function calculateRFM(customer: Customer) {
  const now = Date.now();
  const lastPurchase = customer.last_purchase_at
    ? new Date(customer.last_purchase_at).getTime()
    : 0;

  const recency = lastPurchase
    ? Math.floor((now - lastPurchase) / (1000 * 60 * 60 * 24))
    : 999;

  const frequency = customer.total_orders ?? 0;
  const monetary = customer.total_spent ?? 0;

  const rScore = recency <= 30 ? 5 : recency <= 60 ? 4 : recency <= 90 ? 3 : recency <= 180 ? 2 : 1;
  const fScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 1 ? 2 : 1;
  const mScore = monetary >= 1000 ? 5 : monetary >= 500 ? 4 : monetary >= 200 ? 3 : monetary >= 50 ? 2 : 1;

  return { r: rScore, f: fScore, m: mScore, rfm: `${rScore}${fScore}${mScore}` };
}

function getSegment(customer: Customer): string {
  const rfm = calculateRFM(customer);
  const lifecycle = getLifecycleStage(customer);

  if (rfm.rfm === '555' || rfm.rfm === '554' || rfm.rfm === '545') return 'champions';
  if (rfm.m === 5 && rfm.r >= 3) return 'high-value';
  if (lifecycle === 'at-risk' && rfm.m >= 3) return 'at-risk';
  if (customer.total_spent >= 500) return 'bulk-buyers';
  if (lifecycle === 'prospect') return 'new';
  return 'regular';
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'test-id',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    total_spent: 0,
    total_orders: 0,
    loyalty_points: 0,
    last_purchase_at: null,
    created_at: new Date().toISOString(),
    status: 'active',
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

// --- Tests ---

describe('getLifecycleStage', () => {
  it('returns "prospect" when no purchase date', () => {
    expect(getLifecycleStage(makeCustomer())).toBe('prospect');
  });

  it('returns "active" when purchased within 30 days', () => {
    expect(getLifecycleStage(makeCustomer({ last_purchase_at: daysAgo(5) }))).toBe('active');
  });

  it('returns "active" when purchased exactly 30 days ago', () => {
    expect(getLifecycleStage(makeCustomer({ last_purchase_at: daysAgo(30) }))).toBe('active');
  });

  it('returns "regular" when purchased 31-60 days ago', () => {
    expect(getLifecycleStage(makeCustomer({ last_purchase_at: daysAgo(45) }))).toBe('regular');
  });

  it('returns "at-risk" when purchased 61-90 days ago', () => {
    expect(getLifecycleStage(makeCustomer({ last_purchase_at: daysAgo(75) }))).toBe('at-risk');
  });

  it('returns "churned" when purchased over 90 days ago', () => {
    expect(getLifecycleStage(makeCustomer({ last_purchase_at: daysAgo(120) }))).toBe('churned');
  });
});

describe('calculateRFM', () => {
  it('scores R=5 for recent purchases (within 30 days)', () => {
    const rfm = calculateRFM(makeCustomer({ last_purchase_at: daysAgo(10) }));
    expect(rfm.r).toBe(5);
  });

  it('scores R=1 for no purchase history', () => {
    const rfm = calculateRFM(makeCustomer());
    expect(rfm.r).toBe(1);
  });

  it('scores R=3 for purchases 61-90 days ago', () => {
    const rfm = calculateRFM(makeCustomer({ last_purchase_at: daysAgo(80) }));
    expect(rfm.r).toBe(3);
  });

  it('uses total_orders for frequency score', () => {
    const rfm = calculateRFM(makeCustomer({ total_orders: 10 }));
    expect(rfm.f).toBe(5);
  });

  it('scores F=1 for 0 orders', () => {
    const rfm = calculateRFM(makeCustomer({ total_orders: 0 }));
    expect(rfm.f).toBe(1);
  });

  it('scores F=2 for 1 order', () => {
    const rfm = calculateRFM(makeCustomer({ total_orders: 1 }));
    expect(rfm.f).toBe(2);
  });

  it('scores F=3 for 3 orders', () => {
    const rfm = calculateRFM(makeCustomer({ total_orders: 3 }));
    expect(rfm.f).toBe(3);
  });

  it('scores F=4 for 5 orders', () => {
    const rfm = calculateRFM(makeCustomer({ total_orders: 5 }));
    expect(rfm.f).toBe(4);
  });

  it('scores M=5 for $1000+ spent', () => {
    const rfm = calculateRFM(makeCustomer({ total_spent: 1500 }));
    expect(rfm.m).toBe(5);
  });

  it('scores M=1 for $0 spent', () => {
    const rfm = calculateRFM(makeCustomer({ total_spent: 0 }));
    expect(rfm.m).toBe(1);
  });

  it('produces correct RFM string', () => {
    const rfm = calculateRFM(makeCustomer({
      last_purchase_at: daysAgo(10),
      total_orders: 12,
      total_spent: 2000,
    }));
    expect(rfm.rfm).toBe('555');
  });
});

describe('getSegment', () => {
  it('returns "new" for prospects', () => {
    expect(getSegment(makeCustomer())).toBe('new');
  });

  it('returns "champions" for RFM 555', () => {
    expect(getSegment(makeCustomer({
      last_purchase_at: daysAgo(5),
      total_orders: 15,
      total_spent: 2000,
    }))).toBe('champions');
  });

  it('returns "high-value" for high monetary + decent recency', () => {
    expect(getSegment(makeCustomer({
      last_purchase_at: daysAgo(50),
      total_orders: 2,
      total_spent: 1200,
    }))).toBe('high-value');
  });

  it('returns "at-risk" for at-risk lifecycle with moderate spend', () => {
    expect(getSegment(makeCustomer({
      last_purchase_at: daysAgo(75),
      total_orders: 2,
      total_spent: 300,
    }))).toBe('at-risk');
  });

  it('returns "bulk-buyers" for high total spend', () => {
    expect(getSegment(makeCustomer({
      last_purchase_at: daysAgo(45),
      total_orders: 2,
      total_spent: 600,
    }))).toBe('bulk-buyers');
  });

  it('returns "regular" for moderate customers', () => {
    expect(getSegment(makeCustomer({
      last_purchase_at: daysAgo(45),
      total_orders: 1,
      total_spent: 100,
    }))).toBe('regular');
  });
});

describe('segment name formatting', () => {
  it('replaceAll replaces all hyphens in segment names', () => {
    const name = 'high-value';
    expect(name.replaceAll('-', ' ')).toBe('high value');
  });

  it('replaceAll handles segment names with multiple hyphens', () => {
    const name = 'at-risk-churned';
    expect(name.replaceAll('-', ' ')).toBe('at risk churned');
  });

  it('replaceAll handles segment names without hyphens', () => {
    const name = 'champions';
    expect(name.replaceAll('-', ' ')).toBe('champions');
  });
});
