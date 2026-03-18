import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, format, startOfDay } from 'date-fns';
import { exportToCSV, generateExportFilename } from '@/lib/utils/exportUtils';
import type { ExportColumn } from '@/lib/utils/exportUtils';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from '@/components/ui/lazy-recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const RANGES = ['This Week', 'This Month', 'Last Month'] as const;
type Range = typeof RANGES[number];

interface DailyEarning {
  day: string;
  amount: number;
}

interface EarningsSummary {
  gross: number;
  fees: number;
  net: number;
  tips: number;
  daily: DailyEarning[];
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function EarningStat({
  label,
  value,
  color,
  isLoading,
}: {
  label: string;
  value: string;
  color?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-7 w-16 bg-muted" />
      ) : (
        <span
          className="font-['Space_Grotesk'] text-xl font-bold"
          style={{ color: color ?? '#F8FAFC' }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range helper
// ---------------------------------------------------------------------------

function getDateRange(range: Range): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case 'This Week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'This Month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'Last Month': {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EarningsTabProps {
  driver: DriverProfile;
  tenantId: string;
}

export function EarningsTab({ driver, tenantId }: EarningsTabProps) {
  const [range, setRange] = useState<Range>('This Week');
  const [editingRate, setEditingRate] = useState(false);
  const [draftRate, setDraftRate] = useState(driver.commission_rate ?? 30);
  const queryClient = useQueryClient();

  const dateRange = useMemo(() => getDateRange(range), [range]);

  const earningsQuery = useQuery({
    queryKey: [...queryKeys.couriersAdmin.byTenant(tenantId), 'earnings', driver.id, range],
    queryFn: async (): Promise<EarningsSummary> => {
      const { data, error } = await supabase
        .from('courier_earnings')
        .select('total_earned, commission_amount, tip_amount, created_at')
        .eq('courier_id', driver.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch earnings', error);
        throw error;
      }

      const rows = data ?? [];

      const gross = rows.reduce((s, r) => s + (r.total_earned ?? 0), 0);
      const fees = rows.reduce((s, r) => s + (r.commission_amount ?? 0), 0);
      const tips = rows.reduce((s, r) => s + (r.tip_amount ?? 0), 0);
      const net = gross - fees;

      // Group earnings by date key (YYYY-MM-DD) for accurate aggregation
      const earningsByDate = new Map<string, number>();
      for (const row of rows) {
        if (!row.created_at) continue;
        const dateKey = format(new Date(row.created_at), 'yyyy-MM-dd');
        earningsByDate.set(dateKey, (earningsByDate.get(dateKey) ?? 0) + (row.total_earned ?? 0));
      }

      // Build complete day range with $0 for days without earnings
      const clampedEnd = dateRange.end > new Date() ? startOfDay(new Date()) : dateRange.end;
      const allDays = eachDayOfInterval({ start: dateRange.start, end: clampedEnd });
      const isWeekly = range === 'This Week';

      const daily: DailyEarning[] = allDays.map((d) => {
        const dateKey = format(d, 'yyyy-MM-dd');
        const label = isWeekly ? format(d, 'EEE') : format(d, 'MMM d');
        return { day: label, amount: earningsByDate.get(dateKey) ?? 0 };
      });

      return { gross, fees, net, tips, daily };
    },
    enabled: !!driver.id,
  });

  const updateCommission = useMutation({
    mutationFn: async (rate: number) => {
      const { error } = await supabase
        .from('couriers')
        .update({ commission_rate: rate })
        .eq('id', driver.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Commission rate updated');
      setEditingRate(false);
    },
    onError: (err) => {
      logger.error('Update commission failed', err);
      toast.error('Failed to update commission rate');
    },
  });

  const earnings = earningsQuery.data;
  const isLoading = earningsQuery.isLoading;

  const handleGenerateReport = useCallback(() => {
    if (!earnings) {
      toast.info('No earnings data to export');
      return;
    }

    const rows = [
      {
        period: range,
        gross: earnings.gross.toFixed(2),
        fees: earnings.fees.toFixed(2),
        net: earnings.net.toFixed(2),
        tips: earnings.tips.toFixed(2),
        commission_rate: `${driver.commission_rate ?? 30}%`,
      },
      ...earnings.daily.map((d) => ({
        period: d.day,
        gross: d.amount.toFixed(2),
        fees: '',
        net: '',
        tips: '',
        commission_rate: '',
      })),
    ];

    const columns: ExportColumn<typeof rows[number]>[] = [
      { key: 'period', header: 'Period', type: 'string' },
      { key: 'gross', header: 'Gross ($)', type: 'string' },
      { key: 'fees', header: 'Fees ($)', type: 'string' },
      { key: 'net', header: 'Net ($)', type: 'string' },
      { key: 'tips', header: 'Tips ($)', type: 'string' },
      { key: 'commission_rate', header: 'Commission Rate', type: 'string' },
    ];

    exportToCSV(rows, columns, generateExportFilename(`earnings-${driver.full_name.replace(/\s+/g, '-')}`, 'csv'));
    toast.success('Earnings report exported');
  }, [earnings, range, driver.full_name, driver.commission_rate]);

  return (
    <div className="space-y-4">
      {/* Range toggle */}
      <div className="flex items-center gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              range === r
                ? 'bg-emerald-500 text-white'
                : 'text-muted-foreground hover:bg-card hover:text-muted-foreground'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <EarningStat label="Gross" value={`$${(earnings?.gross ?? 0).toLocaleString()}`} isLoading={isLoading} />
        <EarningStat label="Fees" value={`-$${(earnings?.fees ?? 0).toLocaleString()}`} color="#EF4444" isLoading={isLoading} />
        <EarningStat label="Net" value={`$${(earnings?.net ?? 0).toLocaleString()}`} color="#10B981" isLoading={isLoading} />
        <EarningStat label="Tips" value={`$${(earnings?.tips ?? 0).toLocaleString()}`} isLoading={isLoading} />
      </div>

      {/* Bar chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Daily Earnings — {range}</p>
        <div className="h-[200px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-full w-full bg-muted" />
            </div>
          ) : earnings && earnings.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earnings.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  interval={range === 'This Week' ? 0 : 'preserveStartEnd'}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#F8FAFC',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#0F172A',
                    fontWeight: 600,
                  }}
                  formatter={(val: number) => [`$${val.toFixed(2)}`, 'Earnings']}
                  cursor={{ fill: '#334155', radius: 4 }}
                />
                <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-sm text-muted-foreground">No earnings data</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Commission + Export */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Commission Rate card */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Commission Rate</span>
            {!editingRate && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-['Space_Grotesk'] text-sm font-bold text-emerald-500">
                {driver.commission_rate ?? 30}%
              </span>
            )}
          </div>
          {editingRate ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Adjust rate</span>
                <span className="font-['Space_Grotesk'] text-sm font-bold text-emerald-500">
                  {draftRate}%
                </span>
              </div>
              <Slider
                min={10}
                max={50}
                step={5}
                value={[draftRate]}
                onValueChange={([val]) => setDraftRate(val)}
                className="[&_[data-radix-slider-range]]:bg-emerald-500 [&_[data-radix-slider-thumb]]:border-emerald-500 [&_[data-radix-slider-thumb]]:bg-background [&_[data-radix-slider-track]]:bg-muted"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditingRate(false); setDraftRate(driver.commission_rate ?? 30); }}
                  className="h-7 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateCommission.mutate(draftRate)}
                  disabled={updateCommission.isPending}
                  className="h-7 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingRate(true)}
              className="text-xs text-emerald-500 hover:underline"
            >
              Adjust rate
            </button>
          )}
        </div>

        {/* Export card */}
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-sm font-medium text-foreground">Export Earnings Report</span>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate a downloadable earnings report for this driver.
          </p>
          <Button
            size="sm"
            onClick={handleGenerateReport}
            className="mt-4 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
          >
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
}
