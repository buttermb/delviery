import { describe, it, expect } from 'vitest';
import {
  CREDIT_THRESHOLD_CONFIGS,
  CREDIT_PURCHASE_EVENT,
  getCurrentThreshold,
  getBadgeColorClass,
  getAlertSeverityStyles,
  getWarningMessage,
} from '../creditWarningConfig';

describe('creditWarningConfig', () => {
  describe('CREDIT_THRESHOLD_CONFIGS', () => {
    it('should define exactly 4 thresholds at 200, 100, 50, 25', () => {
      const thresholds = CREDIT_THRESHOLD_CONFIGS.map((c) => c.threshold);
      expect(thresholds).toEqual([200, 100, 50, 25]);
    });

    it('should map thresholds to correct severities', () => {
      const mapping = CREDIT_THRESHOLD_CONFIGS.map((c) => ({
        threshold: c.threshold,
        severity: c.severity,
      }));
      expect(mapping).toEqual([
        { threshold: 200, severity: 'info' },
        { threshold: 100, severity: 'warning' },
        { threshold: 50, severity: 'critical' },
        { threshold: 25, severity: 'danger' },
      ]);
    });

    it('should map thresholds to correct toast types', () => {
      const mapping = CREDIT_THRESHOLD_CONFIGS.map((c) => ({
        threshold: c.threshold,
        toastType: c.toastType,
      }));
      expect(mapping).toEqual([
        { threshold: 200, toastType: 'info' },
        { threshold: 100, toastType: 'warning' },
        { threshold: 50, toastType: 'warning' },
        { threshold: 25, toastType: 'error' },
      ]);
    });
  });

  describe('getCurrentThreshold', () => {
    it('should return null when balance is above all thresholds', () => {
      expect(getCurrentThreshold(250)).toBeNull();
      expect(getCurrentThreshold(300)).toBeNull();
    });

    it('should return info at exactly 200', () => {
      const result = getCurrentThreshold(200);
      expect(result?.severity).toBe('info');
      expect(result?.threshold).toBe(200);
    });

    it('should return info between 101 and 200', () => {
      expect(getCurrentThreshold(150)?.severity).toBe('info');
      expect(getCurrentThreshold(101)?.severity).toBe('info');
    });

    it('should return warning at exactly 100', () => {
      const result = getCurrentThreshold(100);
      expect(result?.severity).toBe('warning');
      expect(result?.threshold).toBe(100);
    });

    it('should return warning between 51 and 100', () => {
      expect(getCurrentThreshold(80)?.severity).toBe('warning');
      expect(getCurrentThreshold(51)?.severity).toBe('warning');
    });

    it('should return critical at exactly 50', () => {
      const result = getCurrentThreshold(50);
      expect(result?.severity).toBe('critical');
      expect(result?.threshold).toBe(50);
    });

    it('should return critical between 26 and 50', () => {
      expect(getCurrentThreshold(30)?.severity).toBe('critical');
      expect(getCurrentThreshold(26)?.severity).toBe('critical');
    });

    it('should return danger at exactly 25', () => {
      const result = getCurrentThreshold(25);
      expect(result?.severity).toBe('danger');
      expect(result?.threshold).toBe(25);
    });

    it('should return danger between 1 and 25', () => {
      expect(getCurrentThreshold(10)?.severity).toBe('danger');
      expect(getCurrentThreshold(1)?.severity).toBe('danger');
    });

    it('should return null when balance is 0 or negative', () => {
      expect(getCurrentThreshold(0)).toBeNull();
      expect(getCurrentThreshold(-10)).toBeNull();
    });
  });

  describe('getBadgeColorClass', () => {
    it('should return emerald (healthy) for balance above 200', () => {
      const classes = getBadgeColorClass(250);
      expect(classes).toContain('text-emerald-600');
      expect(classes).toContain('bg-emerald-50');
      expect(classes).toContain('border-emerald-200');
    });

    it('should return blue (info) for balance at 200', () => {
      const classes = getBadgeColorClass(200);
      expect(classes).toContain('text-blue-600');
      expect(classes).toContain('bg-blue-50');
      expect(classes).toContain('border-blue-200');
    });

    it('should return amber (warning) for balance at 100', () => {
      const classes = getBadgeColorClass(100);
      expect(classes).toContain('text-amber-600');
      expect(classes).toContain('bg-amber-50');
      expect(classes).toContain('border-amber-200');
    });

    it('should return orange (critical) for balance at 50', () => {
      const classes = getBadgeColorClass(50);
      expect(classes).toContain('text-orange-600');
      expect(classes).toContain('bg-orange-50');
      expect(classes).toContain('border-orange-200');
    });

    it('should return red with pulse (danger) for balance at 25', () => {
      const classes = getBadgeColorClass(25);
      expect(classes).toContain('text-red-600');
      expect(classes).toContain('bg-red-50');
      expect(classes).toContain('border-red-200');
      expect(classes).toContain('animate-pulse');
    });

    it('should match alert severity colors at each threshold', () => {
      // This is the key alignment test: badge colors match alert severity colors
      const testCases = [
        { balance: 150, badgeColor: 'blue', alertSeverity: 'info' as const },
        { balance: 80, badgeColor: 'amber', alertSeverity: 'warning' as const },
        { balance: 30, badgeColor: 'orange', alertSeverity: 'critical' as const },
        { balance: 10, badgeColor: 'red', alertSeverity: 'danger' as const },
      ];

      for (const { balance, badgeColor, alertSeverity } of testCases) {
        const badgeClasses = getBadgeColorClass(balance);
        const alertStyles = getAlertSeverityStyles(alertSeverity);

        // Badge text color hue should match alert icon color hue
        expect(badgeClasses).toContain(`text-${badgeColor}-600`);
        expect(alertStyles.iconColor).toContain(badgeColor);
      }
    });
  });

  describe('getAlertSeverityStyles', () => {
    it('should return blue styles for info severity', () => {
      const styles = getAlertSeverityStyles('info');
      expect(styles.variant).toBe('default');
      expect(styles.iconColor).toBe('text-blue-500');
      expect(styles.bgColor).toContain('blue');
      expect(styles.borderColor).toContain('blue');
    });

    it('should return amber styles for warning severity', () => {
      const styles = getAlertSeverityStyles('warning');
      expect(styles.variant).toBe('default');
      expect(styles.iconColor).toBe('text-amber-500');
    });

    it('should return orange styles for critical severity', () => {
      const styles = getAlertSeverityStyles('critical');
      expect(styles.variant).toBe('default');
      expect(styles.iconColor).toBe('text-orange-500');
    });

    it('should return destructive red styles for danger severity', () => {
      const styles = getAlertSeverityStyles('danger');
      expect(styles.variant).toBe('destructive');
      expect(styles.iconColor).toBe('text-red-500');
    });
  });

  describe('getWarningMessage', () => {
    it('should return message for each defined threshold', () => {
      for (const config of CREDIT_THRESHOLD_CONFIGS) {
        const msg = getWarningMessage(config.threshold, 42);
        expect(msg).not.toBeNull();
        expect(msg?.title).toBe(config.title);
      }
    });

    it('should interpolate balance into description', () => {
      const msg = getWarningMessage(50, 45);
      expect(msg?.description).toContain('45');
    });

    it('should return null for unknown threshold', () => {
      expect(getWarningMessage(9999, 100)).toBeNull();
    });

    it('should include toastType matching threshold config', () => {
      for (const config of CREDIT_THRESHOLD_CONFIGS) {
        const msg = getWarningMessage(config.threshold, config.threshold);
        expect(msg?.toastType).toBe(config.toastType);
      }
    });

    it('should use info toast at 200 threshold', () => {
      const msg = getWarningMessage(200, 190);
      expect(msg?.toastType).toBe('info');
    });

    it('should use warning toast at 100 threshold', () => {
      const msg = getWarningMessage(100, 90);
      expect(msg?.toastType).toBe('warning');
    });

    it('should use warning toast at 50 threshold', () => {
      const msg = getWarningMessage(50, 45);
      expect(msg?.toastType).toBe('warning');
    });

    it('should use error toast at 25 threshold', () => {
      const msg = getWarningMessage(25, 20);
      expect(msg?.toastType).toBe('error');
    });
  });

  describe('CREDIT_PURCHASE_EVENT', () => {
    it('should be a non-empty string', () => {
      expect(CREDIT_PURCHASE_EVENT).toBeTruthy();
      expect(typeof CREDIT_PURCHASE_EVENT).toBe('string');
    });
  });
});
