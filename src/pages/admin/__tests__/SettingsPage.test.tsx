/**
 * SettingsPage Button Audit Tests
 * Verifies all buttons and switches have proper aria-labels
 * and that Switch components use shouldDirty for unsaved changes tracking
 * Updated: 2026-03-18
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Static analysis test: parse the SettingsPage.tsx source directly
// This avoids the heavy rendering setup while still verifying our audit changes
const settingsPagePath = path.resolve(__dirname, '../SettingsPage.tsx');
const source = fs.readFileSync(settingsPagePath, 'utf-8');

describe('SettingsPage Button Audit', () => {
  describe('Button aria-labels', () => {
    it('Save General Settings button should have aria-label', () => {
      expect(source).toContain('aria-label="Save general settings"');
    });

    it('Manage Team Members button should have aria-label', () => {
      expect(source).toContain('aria-label="Manage team members"');
    });

    it('Back to dashboard button should have aria-label', () => {
      expect(source).toContain('aria-label="Back to dashboard"');
    });

    it('Import Settings button should have aria-label', () => {
      expect(source).toContain('aria-label="Import settings from file"');
    });

    it('Save Security Settings button should have aria-label', () => {
      expect(source).toContain('aria-label="Save security settings"');
    });

    it('Send Test Telegram button should have aria-label', () => {
      expect(source).toContain('aria-label="Send test Telegram message"');
    });

    it('Save Notification Settings button should have aria-label', () => {
      expect(source).toContain('aria-label="Save notification settings"');
    });

    it('QuickBooks connect button should have aria-label', () => {
      expect(source).toContain('aria-label="Connect QuickBooks (coming soon)"');
    });

    it('Twilio connect button should have aria-label', () => {
      expect(source).toContain('aria-label="Connect Twilio (coming soon)"');
    });
  });

  describe('Switch aria-labels', () => {
    it('Two-factor authentication switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle two-factor authentication"');
    });

    it('Required password change switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle required password change"');
    });

    it('Email notifications switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle email notifications"');
    });

    it('SMS notifications switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle SMS notifications"');
    });

    it('Low stock alerts switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle low stock alerts"');
    });

    it('Overdue payment alerts switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle overdue payment alerts"');
    });

    it('Order alerts switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle order alerts"');
    });

    it('Telegram auto-forward switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle auto-forward orders to Telegram"');
    });

    it('Show Telegram on confirmation switch should have aria-label', () => {
      expect(source).toContain('aria-label="Toggle Telegram button on confirmation page"');
    });
  });

  describe('Switch shouldDirty tracking', () => {
    it('all Switch setValue calls should include shouldDirty: true', () => {
      // Find all .setValue( calls in the source
      const setValueCalls = source.match(/\.setValue\([^)]+\)/g) || [];

      // Each setValue call should include shouldDirty: true
      for (const call of setValueCalls) {
        expect(call).toContain('shouldDirty: true');
      }
    });

    it('should have at least 9 Switch setValue calls with shouldDirty', () => {
      // 2 security + 5 notification + 2 telegram = 9 switches
      const shouldDirtyCount = (source.match(/shouldDirty:\s*true/g) || []).length;
      expect(shouldDirtyCount).toBeGreaterThanOrEqual(9);
    });
  });

  describe('No console.log usage', () => {
    it('should not use console.log', () => {
      expect(source).not.toContain('console.log');
    });

    it('should use logger for error logging', () => {
      expect(source).toContain("import { logger } from '@/lib/logger'");
    });
  });

  describe('Button loading states', () => {
    it('Save General button should be disabled during loading', () => {
      expect(source).toContain('disabled={generalLoading}');
    });

    it('Save Security button should be disabled during loading', () => {
      expect(source).toContain('disabled={securityLoading}');
    });

    it('Save Notification button should be disabled during loading', () => {
      expect(source).toContain('disabled={notificationLoading}');
    });

    it('Send Test Telegram button should be disabled during loading', () => {
      expect(source).toContain('disabled={testingSending}');
    });

    it('Import Settings button should be disabled during loading', () => {
      expect(source).toContain('disabled={importLoading}');
    });
  });

  describe('Submit buttons use correct type', () => {
    it('form submit buttons should use type="submit"', () => {
      // Count submit buttons - should be 3 (general, security, notifications)
      const submitButtons = (source.match(/type="submit"/g) || []).length;
      expect(submitButtons).toBe(3);
    });

    it('non-form buttons should use type="button" to prevent accidental submission', () => {
      // Telegram test button should have type="button"
      expect(source).toContain('type="button"');
    });
  });
});
