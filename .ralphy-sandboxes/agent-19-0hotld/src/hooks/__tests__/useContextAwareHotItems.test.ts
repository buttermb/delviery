/**
 * useContextAwareHotItems Hook Tests
 *
 * Tests context-aware hot items with time-of-day and weekend/weekday awareness
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTimePeriod,
  getStorefrontContext,
  getTimeConfig,
  TIME_PERIOD_CONFIGS,
  WEEKDAY_CONFIGS,
  WEEKEND_CONFIGS,
} from '../useContextAwareHotItems';
import type { TimePeriod, HotItemConfig } from '@/types/storefront-hot-items';

describe('useContextAwareHotItems - Utility Functions', () => {
  describe('getTimePeriod', () => {
    it('should return morning for hours 6-11', () => {
      expect(getTimePeriod(6)).toBe('morning');
      expect(getTimePeriod(9)).toBe('morning');
      expect(getTimePeriod(11)).toBe('morning');
    });

    it('should return afternoon for hours 12-16', () => {
      expect(getTimePeriod(12)).toBe('afternoon');
      expect(getTimePeriod(14)).toBe('afternoon');
      expect(getTimePeriod(16)).toBe('afternoon');
    });

    it('should return evening for hours 17-20', () => {
      expect(getTimePeriod(17)).toBe('evening');
      expect(getTimePeriod(19)).toBe('evening');
      expect(getTimePeriod(20)).toBe('evening');
    });

    it('should return night for hours 21-5', () => {
      expect(getTimePeriod(21)).toBe('night');
      expect(getTimePeriod(0)).toBe('night');
      expect(getTimePeriod(3)).toBe('night');
      expect(getTimePeriod(5)).toBe('night');
    });

    it('should handle boundary hours correctly', () => {
      // Morning starts at 6
      expect(getTimePeriod(5)).toBe('night');
      expect(getTimePeriod(6)).toBe('morning');

      // Afternoon starts at 12
      expect(getTimePeriod(11)).toBe('morning');
      expect(getTimePeriod(12)).toBe('afternoon');

      // Evening starts at 17
      expect(getTimePeriod(16)).toBe('afternoon');
      expect(getTimePeriod(17)).toBe('evening');

      // Night starts at 21
      expect(getTimePeriod(20)).toBe('evening');
      expect(getTimePeriod(21)).toBe('night');
    });
  });

  describe('getStorefrontContext', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return correct context for weekday morning', () => {
      // Monday, 9 AM
      vi.setSystemTime(new Date('2026-01-27T09:00:00'));
      const context = getStorefrontContext();

      expect(context.hour).toBe(9);
      expect(context.dayOfWeek).toBe(2); // Tuesday
      expect(context.timePeriod).toBe('morning');
      expect(context.isWeekend).toBe(false);
    });

    it('should return correct context for weekend afternoon', () => {
      // Saturday, 2 PM
      vi.setSystemTime(new Date('2026-01-31T14:00:00'));
      const context = getStorefrontContext();

      expect(context.hour).toBe(14);
      expect(context.dayOfWeek).toBe(6); // Saturday
      expect(context.timePeriod).toBe('afternoon');
      expect(context.isWeekend).toBe(true);
    });

    it('should return correct context for Sunday', () => {
      // Sunday, 8 PM
      vi.setSystemTime(new Date('2026-02-01T20:00:00'));
      const context = getStorefrontContext();

      expect(context.dayOfWeek).toBe(0); // Sunday
      expect(context.timePeriod).toBe('evening');
      expect(context.isWeekend).toBe(true);
    });

    it('should return correct context for weekday night', () => {
      // Wednesday, 11 PM
      vi.setSystemTime(new Date('2026-01-28T23:00:00'));
      const context = getStorefrontContext();

      expect(context.hour).toBe(23);
      expect(context.timePeriod).toBe('night');
      expect(context.isWeekend).toBe(false);
    });
  });

  describe('getTimeConfig', () => {
    it('should return weekday config for non-weekend', () => {
      const morningConfig = getTimeConfig('morning', false);
      expect(morningConfig.title).toBe('Rise & Shine Picks');
      expect(morningConfig.subtitle).toBe('Energizing strains to start your day right');
    });

    it('should return weekend config for weekend', () => {
      const morningConfig = getTimeConfig('morning', true);
      expect(morningConfig.title).toBe('Weekend Wake & Bake');
      expect(morningConfig.subtitle).toBe('Gentle morning picks for a relaxed start');
    });

    it('should have different badges for weekday vs weekend', () => {
      const weekdayMorning = getTimeConfig('morning', false);
      const weekendMorning = getTimeConfig('morning', true);

      expect(weekdayMorning.badge).toBe('Morning Pick');
      expect(weekendMorning.badge).toBe('Weekend Fave');
    });

    it('should have different accent colors for weekend afternoon', () => {
      const weekdayAfternoon = getTimeConfig('afternoon', false);
      const weekendAfternoon = getTimeConfig('afternoon', true);

      expect(weekdayAfternoon.accentColor).toBe('#06b6d4'); // cyan
      expect(weekendAfternoon.accentColor).toBe('#f97316'); // orange
    });

    it('should prioritize social effects on weekend afternoon', () => {
      const weekendAfternoon = getTimeConfig('afternoon', true);

      expect(weekendAfternoon.priorityEffects).toContain('Social');
      expect(weekendAfternoon.priorityEffects).toContain('Giggly');
      expect(weekendAfternoon.priorityEffects).toContain('Talkative');
    });
  });

  describe('TIME_PERIOD_CONFIGS (Legacy Compatibility)', () => {
    it('should export weekday configs as default', () => {
      expect(TIME_PERIOD_CONFIGS).toBe(WEEKDAY_CONFIGS);
    });

    it('should have all four time periods', () => {
      const periods: TimePeriod[] = ['morning', 'afternoon', 'evening', 'night'];

      periods.forEach((period) => {
        expect(TIME_PERIOD_CONFIGS[period]).toBeDefined();
        expect(TIME_PERIOD_CONFIGS[period].timePeriod).toBe(period);
      });
    });
  });

  describe('WEEKDAY_CONFIGS', () => {
    it('should have correct morning config', () => {
      const config = WEEKDAY_CONFIGS.morning;

      expect(config.title).toBe('Rise & Shine Picks');
      expect(config.icon).toBe('sun');
      expect(config.priorityStrains).toContain('Sativa');
      expect(config.priorityEffects).toContain('Energetic');
      expect(config.priorityEffects).toContain('Focused');
    });

    it('should have correct afternoon config', () => {
      const config = WEEKDAY_CONFIGS.afternoon;

      expect(config.title).toBe('Midday Favorites');
      expect(config.icon).toBe('zap');
      expect(config.priorityStrains).toContain('Hybrid');
      expect(config.priorityEffects).toContain('Balanced');
    });

    it('should have correct evening config', () => {
      const config = WEEKDAY_CONFIGS.evening;

      expect(config.title).toBe('Evening Essentials');
      expect(config.icon).toBe('moon');
      expect(config.priorityStrains).toContain('Indica');
      expect(config.priorityEffects).toContain('Relaxed');
    });

    it('should have correct night config', () => {
      const config = WEEKDAY_CONFIGS.night;

      expect(config.title).toBe('Late Night Selection');
      expect(config.icon).toBe('sparkles');
      expect(config.priorityStrains).toEqual(['Indica']);
      expect(config.priorityEffects).toContain('Sleepy');
    });
  });

  describe('WEEKEND_CONFIGS', () => {
    it('should have correct morning config with coffee icon', () => {
      const config = WEEKEND_CONFIGS.morning;

      expect(config.title).toBe('Weekend Wake & Bake');
      expect(config.icon).toBe('coffee');
      expect(config.accentColor).toBe('#10b981'); // emerald
      expect(config.priorityEffects).toContain('Happy');
      expect(config.priorityEffects).toContain('Relaxed');
    });

    it('should have social-focused afternoon config', () => {
      const config = WEEKEND_CONFIGS.afternoon;

      expect(config.title).toBe('Weekend Social Picks');
      expect(config.subtitle).toBe('Perfect for hanging with friends');
      expect(config.badge).toBe('Party Pick');
      expect(config.icon).toBe('star');
    });

    it('should have chill evening config', () => {
      const config = WEEKEND_CONFIGS.evening;

      expect(config.title).toBe('Weekend Unwind');
      expect(config.badge).toBe('Chill Pick');
      expect(config.priorityStrains).toContain('Hybrid');
      expect(config.priorityStrains).toContain('Indica');
    });

    it('should have relaxation-focused night config', () => {
      const config = WEEKEND_CONFIGS.night;

      expect(config.title).toBe('Saturday Night Special');
      expect(config.badge).toBe('Weekend Night');
      expect(config.priorityStrains).toEqual(['Indica']);
    });
  });

  describe('Config Consistency', () => {
    const validateConfig = (config: HotItemConfig, period: TimePeriod) => {
      expect(config.timePeriod).toBe(period);
      expect(config.title).toBeTruthy();
      expect(config.subtitle).toBeTruthy();
      expect(config.badge).toBeTruthy();
      expect(config.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(config.priorityCategories.length).toBeGreaterThan(0);
      expect(config.priorityStrains.length).toBeGreaterThan(0);
      expect(config.priorityEffects.length).toBeGreaterThan(0);
      expect(['sun', 'coffee', 'moon', 'sparkles', 'zap', 'star']).toContain(config.icon);
    };

    it('should have valid weekday configs', () => {
      Object.entries(WEEKDAY_CONFIGS).forEach(([period, config]) => {
        validateConfig(config, period as TimePeriod);
      });
    });

    it('should have valid weekend configs', () => {
      Object.entries(WEEKEND_CONFIGS).forEach(([period, config]) => {
        validateConfig(config, period as TimePeriod);
      });
    });
  });
});
