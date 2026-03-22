/**
 * OrderDetailsPage Tracking Link Credit Gating Tests
 *
 * Verifies that the send tracking link action is properly gated by credits:
 * 1. tracking_send_link action key exists with the correct cost (15 credits)
 * 2. tracking_send_link is categorized under fleet
 * 3. useCreditGatedAction is imported and used in OrderDetailsPage
 * 4. The tracking_send_link action key is referenced in OrderDetailsPage
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Tracking Send Link Credit Cost Configuration', () => {
  it('tracking_send_link should cost 15 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('tracking_send_link')).toBe(15);
  });

  it('tracking_send_link should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('tracking_send_link')).toBe(false);
  });

  it('tracking_send_link should be categorized under fleet', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('tracking_send_link');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('fleet');
    expect(info?.actionName).toBe('Send Tracking Link');
    expect(info?.credits).toBe(15);
  });
});

// ============================================================================
// Source Code Integration Tests
// ============================================================================

describe('OrderDetailsPage tracking link credit gate integration', () => {
  const sourceCode = readFileSync(
    resolve(__dirname, '../OrderDetailsPage.tsx'),
    'utf-8'
  );

  it('should import useCreditGatedAction from useCredits', () => {
    expect(sourceCode).toContain("import { useCreditGatedAction } from '@/hooks/useCredits'");
  });

  it('should call useCreditGatedAction hook', () => {
    expect(sourceCode).toContain('useCreditGatedAction()');
  });

  it('should use tracking_send_link action key', () => {
    expect(sourceCode).toContain("'tracking_send_link'");
  });

  it('should call executeCreditAction with tracking_send_link', () => {
    expect(sourceCode).toContain("executeCreditAction('tracking_send_link'");
  });

  it('should invoke send-sms edge function for tracking link', () => {
    expect(sourceCode).toContain("supabase.functions.invoke('send-sms'");
  });

  it('should pass referenceType order for tracking link send', () => {
    expect(sourceCode).toContain("referenceType: 'order'");
  });

  it('should use isSendingTrackingLink for loading state', () => {
    expect(sourceCode).toContain('isSendingTrackingLink');
  });

  it('should have Send Tracking button text', () => {
    expect(sourceCode).toContain("'Send Tracking'");
  });

  it('should check for tracking_token and phone before showing send button', () => {
    expect(sourceCode).toContain("order.tracking_token && (order.customer?.phone || order.user?.phone)");
  });

  it('should show toast on successful send', () => {
    expect(sourceCode).toContain("toast.success('Tracking link sent!'");
  });
});
