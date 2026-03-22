/**
 * subscriptionStatus utility tests
 * Verifies normalization of status variants: trial/trialing, cancelled/canceled
 */

import { describe, it, expect } from 'vitest';

import {
  SUBSCRIPTION_STATUS,
  isTrial,
  isCancelled,
  isActiveSubscription,
  getSubscriptionStatusLabel,
} from '../subscriptionStatus';

// ── isTrial ───────────────────────────────────────────────────────

describe('isTrial', () => {
  it('returns true for "trial"', () => {
    expect(isTrial('trial')).toBe(true);
  });

  it('returns true for "trialing"', () => {
    expect(isTrial('trialing')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isTrial('Trial')).toBe(true);
    expect(isTrial('TRIALING')).toBe(true);
    expect(isTrial('Trialing')).toBe(true);
  });

  it('returns false for non-trial statuses', () => {
    expect(isTrial('active')).toBe(false);
    expect(isTrial('past_due')).toBe(false);
    expect(isTrial('cancelled')).toBe(false);
    expect(isTrial('suspended')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isTrial(null)).toBe(false);
    expect(isTrial(undefined)).toBe(false);
  });
});

// ── isCancelled ───────────────────────────────────────────────────

describe('isCancelled', () => {
  it('returns true for "cancelled"', () => {
    expect(isCancelled('cancelled')).toBe(true);
  });

  it('returns true for "canceled"', () => {
    expect(isCancelled('canceled')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isCancelled('Cancelled')).toBe(true);
    expect(isCancelled('CANCELED')).toBe(true);
  });

  it('returns false for non-cancelled statuses', () => {
    expect(isCancelled('active')).toBe(false);
    expect(isCancelled('trial')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isCancelled(null)).toBe(false);
    expect(isCancelled(undefined)).toBe(false);
  });
});

// ── isActiveSubscription ──────────────────────────────────────────

describe('isActiveSubscription', () => {
  it('returns true for "active"', () => {
    expect(isActiveSubscription('active')).toBe(true);
  });

  it('returns true for "trial"', () => {
    expect(isActiveSubscription('trial')).toBe(true);
  });

  it('returns true for "trialing"', () => {
    expect(isActiveSubscription('trialing')).toBe(true);
  });

  it('returns false for inactive statuses', () => {
    expect(isActiveSubscription('past_due')).toBe(false);
    expect(isActiveSubscription('cancelled')).toBe(false);
    expect(isActiveSubscription('suspended')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isActiveSubscription(null)).toBe(false);
    expect(isActiveSubscription(undefined)).toBe(false);
  });
});

// ── getSubscriptionStatusLabel ────────────────────────────────────

describe('getSubscriptionStatusLabel', () => {
  it('labels both "trial" and "trialing" as "Trial"', () => {
    expect(getSubscriptionStatusLabel('trial')).toBe('Trial');
    expect(getSubscriptionStatusLabel('trialing')).toBe('Trial');
  });

  it('labels both "cancelled" and "canceled" as "Cancelled"', () => {
    expect(getSubscriptionStatusLabel('cancelled')).toBe('Cancelled');
    expect(getSubscriptionStatusLabel('canceled')).toBe('Cancelled');
  });

  it('labels known statuses correctly', () => {
    expect(getSubscriptionStatusLabel('active')).toBe('Active');
    expect(getSubscriptionStatusLabel('past_due')).toBe('Past Due');
    expect(getSubscriptionStatusLabel('suspended')).toBe('Suspended');
  });

  it('returns "Unknown" for null/undefined', () => {
    expect(getSubscriptionStatusLabel(null)).toBe('Unknown');
    expect(getSubscriptionStatusLabel(undefined)).toBe('Unknown');
  });
});

// ── SUBSCRIPTION_STATUS constants ─────────────────────────────────

describe('SUBSCRIPTION_STATUS', () => {
  it('includes both trial variants', () => {
    expect(SUBSCRIPTION_STATUS.TRIAL).toBe('trial');
    expect(SUBSCRIPTION_STATUS.TRIALING).toBe('trialing');
  });

  it('includes both cancelled variants', () => {
    expect(SUBSCRIPTION_STATUS.CANCELLED).toBe('cancelled');
    expect(SUBSCRIPTION_STATUS.CANCELED).toBe('canceled');
  });
});
