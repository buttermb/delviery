/**
 * Menu Product Availability Engine
 *
 * Client-side evaluation of product availability rules.
 * This mirrors the database function evaluate_menu_product_availability
 * for real-time UI updates without requiring server round-trips.
 */

import type { AvailabilityRule, AvailabilityRuleType } from '@/hooks/useMenuProductAvailability';

export interface AvailabilityResult {
  isAvailable: boolean;
  unavailableReason: string | null;
  hideProduct: boolean;
  failedRule: AvailabilityRule | null;
}

interface EvaluationContext {
  currentTime?: Date;
  skipRuleTypes?: AvailabilityRuleType[];
}

/**
 * Evaluate a single time window rule
 */
function evaluateTimeWindowRule(
  rule: AvailabilityRule,
  currentHour: number
): AvailabilityResult | null {
  if (rule.startHour === null || rule.endHour === null) {
    return null;
  }

  let isWithinWindow: boolean;

  if (rule.startHour <= rule.endHour) {
    // Normal window (e.g., 9am to 5pm)
    isWithinWindow = currentHour >= rule.startHour && currentHour < rule.endHour;
  } else {
    // Overnight window (e.g., 10pm to 6am)
    isWithinWindow = currentHour >= rule.startHour || currentHour < rule.endHour;
  }

  if (!isWithinWindow) {
    return {
      isAvailable: false,
      unavailableReason:
        rule.unavailableMessage ||
        `Available from ${formatHour(rule.startHour)} to ${formatHour(rule.endHour)}`,
      hideProduct: rule.hideWhenUnavailable,
      failedRule: rule,
    };
  }

  return null;
}

/**
 * Evaluate a single day of week rule
 */
function evaluateDayOfWeekRule(
  rule: AvailabilityRule,
  currentDayOfWeek: number
): AvailabilityResult | null {
  if (!rule.allowedDays || rule.allowedDays.length === 0) {
    return null;
  }

  if (!rule.allowedDays.includes(currentDayOfWeek)) {
    return {
      isAvailable: false,
      unavailableReason:
        rule.unavailableMessage ||
        `Available on ${formatDays(rule.allowedDays)}`,
      hideProduct: rule.hideWhenUnavailable,
      failedRule: rule,
    };
  }

  return null;
}

/**
 * Evaluate a single quantity limit rule
 */
function evaluateQuantityLimitRule(rule: AvailabilityRule): AvailabilityResult | null {
  if (rule.maxQuantity === null) {
    return null;
  }

  if (rule.currentQuantityUsed >= rule.maxQuantity) {
    return {
      isAvailable: false,
      unavailableReason:
        rule.unavailableMessage || 'Sold out for this session',
      hideProduct: rule.hideWhenUnavailable,
      failedRule: rule,
    };
  }

  return null;
}

/**
 * Evaluate a single bundle-only rule
 */
function evaluateBundleOnlyRule(rule: AvailabilityRule): AvailabilityResult | null {
  // Bundle-only products are always marked as unavailable for individual purchase
  return {
    isAvailable: false,
    unavailableReason:
      rule.unavailableMessage || 'Only available as part of a bundle',
    hideProduct: rule.hideWhenUnavailable,
    failedRule: rule,
  };
}

/**
 * Evaluate all active rules for a product
 * Returns the first failing rule result, or success if all pass
 */
export function evaluateProductAvailability(
  rules: AvailabilityRule[],
  context: EvaluationContext = {}
): AvailabilityResult {
  const now = context.currentTime || new Date();
  const currentHour = now.getHours();
  const currentDayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday

  // Filter to active rules only
  const activeRules = rules.filter((r) => r.isActive);

  // Filter out skipped rule types if specified
  const rulesToEvaluate = context.skipRuleTypes
    ? activeRules.filter((r) => !context.skipRuleTypes?.includes(r.ruleType))
    : activeRules;

  for (const rule of rulesToEvaluate) {
    let result: AvailabilityResult | null = null;

    switch (rule.ruleType) {
      case 'time_window':
        result = evaluateTimeWindowRule(rule, currentHour);
        break;
      case 'day_of_week':
        result = evaluateDayOfWeekRule(rule, currentDayOfWeek);
        break;
      case 'quantity_limit':
        result = evaluateQuantityLimitRule(rule);
        break;
      case 'bundle_only':
        result = evaluateBundleOnlyRule(rule);
        break;
    }

    if (result) {
      return result;
    }
  }

  // All rules passed - product is available
  return {
    isAvailable: true,
    unavailableReason: null,
    hideProduct: false,
    failedRule: null,
  };
}

/**
 * Evaluate availability for multiple products at once
 */
export function evaluateMultipleProducts(
  productRules: Map<string, AvailabilityRule[]>,
  context: EvaluationContext = {}
): Map<string, AvailabilityResult> {
  const results = new Map<string, AvailabilityResult>();

  for (const [productId, rules] of productRules) {
    results.set(productId, evaluateProductAvailability(rules, context));
  }

  return results;
}

/**
 * Get remaining quantity for a quantity-limited product
 */
export function getRemainingQuantity(rule: AvailabilityRule): number | null {
  if (rule.ruleType !== 'quantity_limit' || rule.maxQuantity === null) {
    return null;
  }

  return Math.max(0, rule.maxQuantity - rule.currentQuantityUsed);
}

/**
 * Check if a time window rule is currently active
 */
export function isTimeWindowActive(rule: AvailabilityRule, currentTime?: Date): boolean {
  if (rule.ruleType !== 'time_window') return false;
  if (rule.startHour === null || rule.endHour === null) return true;

  const now = currentTime || new Date();
  const currentHour = now.getHours();

  if (rule.startHour <= rule.endHour) {
    return currentHour >= rule.startHour && currentHour < rule.endHour;
  } else {
    // Overnight window
    return currentHour >= rule.startHour || currentHour < rule.endHour;
  }
}

/**
 * Get a human-readable summary of a rule
 */
export function getRuleSummary(rule: AvailabilityRule): string {
  switch (rule.ruleType) {
    case 'time_window':
      if (rule.startHour !== null && rule.endHour !== null) {
        return `Available ${formatHour(rule.startHour)} - ${formatHour(rule.endHour)}`;
      }
      return 'Time window rule';

    case 'day_of_week':
      if (rule.allowedDays && rule.allowedDays.length > 0) {
        return `Available on ${formatDays(rule.allowedDays)}`;
      }
      return 'Day of week rule';

    case 'quantity_limit':
      if (rule.maxQuantity !== null) {
        const remaining = rule.maxQuantity - rule.currentQuantityUsed;
        return `Limited: ${remaining}/${rule.maxQuantity} remaining`;
      }
      return 'Quantity limit rule';

    case 'bundle_only':
      return 'Bundle only';

    default:
      return 'Unknown rule';
  }
}

/**
 * Format hour number to readable time (e.g., 14 -> "2:00 PM")
 */
function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

/**
 * Format day numbers to readable day names
 */
function formatDays(days: number[]): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sortedDays = [...days].sort((a, b) => a - b);

  // Check for consecutive days
  if (sortedDays.length >= 3) {
    let isConsecutive = true;
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] - sortedDays[i - 1] !== 1) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      return `${dayNames[sortedDays[0]]} - ${dayNames[sortedDays[sortedDays.length - 1]]}`;
    }
  }

  // Check for weekdays
  if (
    sortedDays.length === 5 &&
    sortedDays.every((d) => d >= 1 && d <= 5)
  ) {
    return 'Weekdays';
  }

  // Check for weekends
  if (
    sortedDays.length === 2 &&
    sortedDays.includes(0) &&
    sortedDays.includes(6)
  ) {
    return 'Weekends';
  }

  return sortedDays.map((d) => dayNames[d]).join(', ');
}

/**
 * Get the rule type display name
 */
export function getRuleTypeName(ruleType: AvailabilityRuleType): string {
  switch (ruleType) {
    case 'time_window':
      return 'Time Window';
    case 'day_of_week':
      return 'Days Available';
    case 'quantity_limit':
      return 'Quantity Limit';
    case 'bundle_only':
      return 'Bundle Only';
    default:
      return 'Unknown';
  }
}

/**
 * Get icon name for a rule type (for use with lucide icons)
 */
export function getRuleTypeIcon(ruleType: AvailabilityRuleType): string {
  switch (ruleType) {
    case 'time_window':
      return 'Clock';
    case 'day_of_week':
      return 'Calendar';
    case 'quantity_limit':
      return 'Package';
    case 'bundle_only':
      return 'Boxes';
    default:
      return 'Circle';
  }
}
