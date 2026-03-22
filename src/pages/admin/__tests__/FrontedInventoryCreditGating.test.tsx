/**
 * FrontedInventory Credit Gating Tests
 *
 * Tests verifying:
 * 1. who_owes_me_reminder credit cost configuration (25 credits)
 * 2. who_owes_me_view is free
 * 3. FrontedInventory component integrates useCreditGatedAction
 * 4. FrontedInventory component includes OutOfCreditsModal
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Who Owes Me Reminder Credit Cost Configuration', () => {
  it('who_owes_me_reminder should cost 25 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('who_owes_me_reminder')).toBe(25);
  });

  it('who_owes_me_reminder should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('who_owes_me_reminder')).toBe(false);
  });

  it('who_owes_me_reminder should be categorized under crm', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('who_owes_me_reminder');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('crm');
    expect(info?.actionName).toBe('Send Payment Reminder');
    expect(info?.credits).toBe(25);
  });

  it('who_owes_me_view should be free (0 credits)', async () => {
    const { getCreditCost, isActionFree } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('who_owes_me_view')).toBe(0);
    expect(isActionFree('who_owes_me_view')).toBe(true);
  });

  it('who_owes_me_view should be in FREE_ACTIONS list', async () => {
    const { FREE_ACTIONS } = await import('@/lib/credits/creditCosts');
    expect(FREE_ACTIONS).toContain('who_owes_me_view');
  });
});

// ============================================================================
// FrontedInventory Source Integration Tests
//
// Verify the component source code contains the expected credit gating
// integration. These tests read the source file and verify patterns,
// avoiding the complexity of mocking the full Supabase data flow.
// ============================================================================

describe('FrontedInventory Credit Gate Integration', () => {
  const componentPath = resolve(__dirname, '../FrontedInventory.tsx');
  const source = readFileSync(componentPath, 'utf-8');

  it('should import useCreditGatedAction hook', () => {
    expect(source).toContain("import { useCreditGatedAction } from '@/hooks/useCreditGatedAction'");
  });

  it('should import OutOfCreditsModal component', () => {
    expect(source).toContain("import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal'");
  });

  it('should call useCreditGatedAction hook', () => {
    expect(source).toContain('useCreditGatedAction()');
  });

  it('should use who_owes_me_reminder action key', () => {
    expect(source).toContain("actionKey: 'who_owes_me_reminder'");
  });

  it('should pass referenceType fronted_inventory', () => {
    expect(source).toContain("referenceType: 'fronted_inventory'");
  });

  it('should render OutOfCreditsModal with showOutOfCreditsModal and blockedAction', () => {
    expect(source).toContain('<OutOfCreditsModal');
    expect(source).toContain('open={showOutOfCreditsModal}');
    expect(source).toContain('actionAttempted={blockedAction');
  });

  it('should disable the Send Reminder button while executing', () => {
    expect(source).toContain('disabled={isSendingReminder}');
  });

  it('should destructure execute, showOutOfCreditsModal, closeOutOfCreditsModal, blockedAction, isExecuting', () => {
    expect(source).toContain('execute: executeCreditAction');
    expect(source).toContain('showOutOfCreditsModal');
    expect(source).toContain('closeOutOfCreditsModal');
    expect(source).toContain('blockedAction');
    expect(source).toContain('isExecuting: isSendingReminder');
  });

  it('should show toast success on reminder sent', () => {
    expect(source).toContain("toast.success('Payment reminder sent'");
  });

  it('should use logger.info for reminder sent', () => {
    expect(source).toContain("logger.info('Payment reminder sent'");
  });

  it('should use logger.error for failed reminder', () => {
    expect(source).toContain("logger.error('Failed to send payment reminder'");
  });

  it('should have Send Reminder button label', () => {
    expect(source).toContain('Send Reminder');
  });
});
