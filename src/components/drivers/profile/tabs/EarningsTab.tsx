import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

const RANGES = ['This Week', 'This Month', 'Last Month', 'Custom'] as const;

const WEEK_DATA = [
  { day: 'Mon', amount: 198 },
  { day: 'Tue', amount: 145 },
  { day: 'Wed', amount: 176 },
  { day: 'Thu', amount: 210 },
  { day: 'Fri', amount: 165 },
  { day: 'Sat', amount: 220 },
  { day: 'Sun', amount: 126 },
];

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function EarningStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[#334155] bg-[#1E293B] p-4">
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
        {label}
      </span>
      <span
        className="font-['Space_Grotesk'] text-xl font-bold"
        style={{ color: color ?? '#F8FAFC' }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EarningsTabProps {
  driver: DriverProfile;
  tenantId: string;
}

export function EarningsTab({ driver, tenantId }: EarningsTabProps) {
  const [range, setRange] = useState<string>('This Week');
  const [editingRate, setEditingRate] = useState(false);
  const [draftRate, setDraftRate] = useState(driver.commission_rate ?? 30);
  const queryClient = useQueryClient();

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

  // Placeholder stats
  const gross = 1240;
  const fees = 372;
  const net = gross - fees;
  const tips = 94;

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
                ? 'bg-[#10B981] text-white'
                : 'text-[#64748B] hover:bg-[#1E293B] hover:text-[#94A3B8]'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <EarningStat label="Gross" value={`$${gross.toLocaleString()}`} />
        <EarningStat label="Fees" value={`-$${fees}`} color="#EF4444" />
        <EarningStat label="Net" value={`$${net}`} color="#10B981" />
        <EarningStat label="Tips" value={`$${tips}`} />
      </div>

      {/* Bar chart */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
        <p className="mb-3 text-xs font-medium text-[#94A3B8]">Daily Earnings — {range}</p>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEK_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
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
                formatter={(val: number) => [`$${val}`, 'Earnings']}
                cursor={{ fill: '#334155', radius: 4 }}
              />
              <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: Commission + Export */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Commission Rate card */}
        <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-[#F8FAFC]">Commission Rate</span>
            {!editingRate && (
              <span className="rounded-full bg-[#10B981]/20 px-2 py-0.5 font-['Space_Grotesk'] text-sm font-bold text-[#10B981]">
                {driver.commission_rate ?? 30}%
              </span>
            )}
          </div>
          {editingRate ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B]">Adjust rate</span>
                <span className="font-['Space_Grotesk'] text-sm font-bold text-[#10B981]">
                  {draftRate}%
                </span>
              </div>
              <Slider
                min={10}
                max={50}
                step={5}
                value={[draftRate]}
                onValueChange={([val]) => setDraftRate(val)}
                className="[&_[data-radix-slider-range]]:bg-[#10B981] [&_[data-radix-slider-thumb]]:border-[#10B981] [&_[data-radix-slider-thumb]]:bg-[#0F172A] [&_[data-radix-slider-track]]:bg-[#334155]"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditingRate(false); setDraftRate(driver.commission_rate ?? 30); }}
                  className="h-7 text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateCommission.mutate(draftRate)}
                  disabled={updateCommission.isPending}
                  className="h-7 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingRate(true)}
              className="text-xs text-[#10B981] hover:underline"
            >
              Adjust rate
            </button>
          )}
        </div>

        {/* Export card */}
        <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
          <span className="text-sm font-medium text-[#F8FAFC]">Export Earnings Report</span>
          <p className="mt-1 text-xs text-[#64748B]">
            Generate a downloadable earnings report for this driver.
          </p>
          <Button
            size="sm"
            className="mt-4 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
          >
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
}
