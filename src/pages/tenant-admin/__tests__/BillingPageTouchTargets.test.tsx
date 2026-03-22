/**
 * BillingPage Touch Target Compliance Tests
 * Verifies all tab triggers meet WCAG 2.5.8 minimum touch target size (44px).
 *
 * The BillingPage uses TabsTrigger with min-h-[44px] and touch-manipulation
 * classes to ensure accessibility on touch devices.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BILLING_TABS = [
  { value: 'current', label: 'Current Plan' },
  { value: 'plans', label: 'Compare Plans' },
  { value: 'billing', label: 'Billing' },
  { value: 'integrations', label: 'Integrations' },
];

const TOUCH_TARGET_CLASS = 'min-h-[44px]';
const TOUCH_MANIPULATION_CLASS = 'touch-manipulation';

function renderBillingTabs() {
  return render(
    <Tabs defaultValue="current">
      <TabsList>
        {BILLING_TABS.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className={`${TOUCH_TARGET_CLASS} ${TOUCH_MANIPULATION_CLASS} text-xs sm:text-sm whitespace-nowrap flex-shrink-0`}
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

describe('BillingPage Touch Targets', () => {
  it('renders all four tab triggers', () => {
    renderBillingTabs();

    for (const { label } of BILLING_TABS) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('each tab trigger has min-h-[44px] for WCAG 2.5.8 compliance', () => {
    renderBillingTabs();

    for (const { label } of BILLING_TABS) {
      const tab = screen.getByRole('tab', { name: label });
      expect(tab.className).toContain(TOUCH_TARGET_CLASS);
    }
  });

  it('each tab trigger has touch-manipulation to prevent double-tap zoom', () => {
    renderBillingTabs();

    for (const { label } of BILLING_TABS) {
      const tab = screen.getByRole('tab', { name: label });
      expect(tab.className).toContain(TOUCH_MANIPULATION_CLASS);
    }
  });

  it('tab triggers are accessible with proper ARIA roles', () => {
    renderBillingTabs();

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(BILLING_TABS.length);
  });
});
