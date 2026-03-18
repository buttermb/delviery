/**
 * DashboardTour Component
 *
 * Provides an interactive guided tour of the admin dashboard for new users.
 * Uses react-joyride for step-by-step tooltips highlighting key dashboard sections.
 */

import Joyride, { Step, Styles } from 'react-joyride';
import { Button } from '@/components/ui/button';
import Play from "lucide-react/dist/esm/icons/play";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { useDashboardTour } from '@/hooks/useDashboardTour';

/** Tour step definitions for the dashboard */
const DASHBOARD_TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="dashboard-header"]',
    content:
      'Welcome to your FloraIQ Dashboard! This is your central hub for monitoring business operations in real-time.',
    title: 'Dashboard Overview',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="revenue-section"]',
    content:
      "Track your revenue metrics here. See today's earnings, month-to-date totals, and average order values at a glance.",
    title: 'Revenue Metrics',
    placement: 'bottom',
  },
  {
    target: '[data-tour="orders-section"]',
    content:
      'Monitor your order flow. View pending orders that need attention, completed deliveries, and daily order counts.',
    title: 'Order Management',
    placement: 'top',
  },
  {
    target: '[data-tour="inventory-section"]',
    content:
      'Keep your inventory in check. Get alerts for low stock and out-of-stock items before they impact your business.',
    title: 'Inventory Status',
    placement: 'top',
  },
  {
    target: '[data-tour="customers-section"]',
    content:
      'Understand your customer base. Track new signups, total customers, and see who is actively browsing right now.',
    title: 'Customer Insights',
    placement: 'top',
  },
];

/** Custom styles for the tour tooltips */
const joyrideStyles: Partial<Styles> = {
  options: {
    arrowColor: 'hsl(var(--background))',
    backgroundColor: 'hsl(var(--background))',
    primaryColor: 'hsl(var(--primary))',
    textColor: 'hsl(var(--foreground))',
    zIndex: 9999, // matches --z-max token
  },
  tooltip: {
    borderRadius: '0.75rem',
    padding: '1.25rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
  tooltipTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  tooltipContent: {
    fontSize: '0.9375rem',
    lineHeight: 1.6,
  },
  buttonNext: {
    backgroundColor: 'hsl(var(--primary))',
    borderRadius: '0.5rem',
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  buttonBack: {
    color: 'hsl(var(--muted-foreground))',
    marginRight: '0.5rem',
  },
  buttonSkip: {
    color: 'hsl(var(--muted-foreground))',
  },
  spotlight: {
    borderRadius: '0.75rem',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
};

interface DashboardTourProps {
  /** Whether to automatically start the tour for new users */
  autoStart?: boolean;
  /** Delay before auto-starting the tour (ms) */
  autoStartDelay?: number;
}

export function DashboardTour({
  autoStart = true,
  autoStartDelay = 1500,
}: DashboardTourProps) {
  const {
    isRunning,
    stepIndex,
    handleJoyrideCallback,
  } = useDashboardTour({ autoStart, autoStartDelay });

  return (
    <>
      <Joyride
        steps={DASHBOARD_TOUR_STEPS}
        run={isRunning}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        spotlightClicks
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={joyrideStyles}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip Tour',
        }}
        floaterProps={{
          disableAnimation: false,
        }}
      />
    </>
  );
}

interface TakeDashboardTourButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function TakeDashboardTourButton({
  variant = 'outline',
  size = 'sm',
  className,
}: TakeDashboardTourButtonProps) {
  const { hasCompletedTour, startTour } = useDashboardTour({ autoStart: false });

  return (
    <Button
      variant={variant}
      size={size}
      onClick={startTour}
      className={className}
      aria-label={hasCompletedTour ? 'Restart dashboard tour' : 'Take dashboard tour'}
    >
      {hasCompletedTour ? (
        <>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restart Tour
        </>
      ) : (
        <>
          <Play className="h-4 w-4 mr-2" />
          Take Tour
        </>
      )}
    </Button>
  );
}
