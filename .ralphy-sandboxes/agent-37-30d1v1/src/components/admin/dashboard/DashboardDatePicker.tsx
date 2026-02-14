/**
 * Dashboard Date Picker
 * A date range picker for filtering all dashboard widgets.
 * Uses the DashboardDateRangeContext to share date range state.
 */

import { DateRangePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { useDashboardDateRange } from '@/contexts/DashboardDateRangeContext';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface DateRangePreset {
  label: string;
  getValue: () => { from: Date; to: Date };
}

const dashboardPresets: DateRangePreset[] = [
  {
    label: 'Today',
    getValue: () => {
      const now = new Date();
      return { from: startOfDay(now), to: endOfDay(now) };
    },
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    },
  },
  {
    label: 'Last 7 Days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Last 30 Days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'This Week',
    getValue: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 0 }),
      to: endOfWeek(new Date(), { weekStartsOn: 0 }),
    }),
  },
  {
    label: 'This Month',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: 'Last Month',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
  {
    label: 'Last 90 Days',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 89)),
      to: endOfDay(new Date()),
    }),
  },
];

interface DashboardDatePickerProps {
  className?: string;
  disabled?: boolean;
}

export function DashboardDatePicker({ className, disabled }: DashboardDatePickerProps) {
  const { dateRange, setDateRange } = useDashboardDateRange();

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    if (range.from && range.to) {
      setDateRange({
        from: startOfDay(range.from),
        to: endOfDay(range.to),
      });
    } else if (range.from) {
      // When only start date is selected, wait for end date
      // The picker handles this state internally
    }
  };

  return (
    <DateRangePickerWithPresets
      dateRange={{ from: dateRange.from, to: dateRange.to }}
      onDateRangeChange={handleDateRangeChange}
      placeholder="Select date range"
      presets={dashboardPresets}
      disabled={disabled}
      className={className}
    />
  );
}
