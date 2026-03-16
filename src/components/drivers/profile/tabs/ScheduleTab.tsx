import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const TIME_SLOTS = ['6AM', '9AM', '12PM', '3PM', '6PM', '9PM'] as const;
const PREF_CHIPS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

// Default schedule: most weekdays available 9AM–6PM
function defaultSchedule(): boolean[][] {
  return DAYS.map((_, dayIdx) =>
    TIME_SLOTS.map((_, slotIdx) => {
      if (dayIdx >= 5) return slotIdx >= 1 && slotIdx <= 3; // Sat-Sun: 9AM-3PM
      return slotIdx >= 1 && slotIdx <= 4; // Mon-Fri: 9AM-6PM
    }),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScheduleTabProps {
  driver: DriverProfile;
  tenantId: string;
}

export function ScheduleTab({ driver: _driver, tenantId: _tenantId }: ScheduleTabProps) {
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [preferences, setPreferences] = useState<Set<string>>(new Set(['Afternoon', 'Evening']));
  const [maxDeliveries, setMaxDeliveries] = useState(8);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);

  const toggleCell = useCallback((day: number, slot: number) => {
    setSchedule((prev) =>
      prev.map((row, d) =>
        d === day
          ? row.map((cell, s) => (s === slot ? !cell : cell))
          : row,
      ),
    );
  }, []);

  function togglePreference(pref: string) {
    setPreferences((prev) => {
      const next = new Set(prev);
      if (next.has(pref)) next.delete(pref);
      else next.add(pref);
      return next;
    });
  }

  function handleSaveSchedule() {
    toast.success('Schedule saved');
  }

  return (
    <div className="space-y-4">
      {/* Weekly Availability Grid */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-[#F8FAFC]">Weekly Availability</span>
          <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#10B981]" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#1E293B] ring-1 ring-[#334155]" />
              Unavailable
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-12 pb-2 text-left text-[11px] font-medium text-[#64748B]" />
                {TIME_SLOTS.map((slot) => (
                  <th key={slot} className="pb-2 text-center text-[11px] font-medium text-[#64748B]">
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dayIdx) => (
                <tr key={day}>
                  <td className="py-1 pr-2 text-xs font-medium text-[#94A3B8]">{day}</td>
                  {TIME_SLOTS.map((_, slotIdx) => {
                    const active = schedule[dayIdx][slotIdx];
                    return (
                      <td key={slotIdx} className="p-1">
                        <button
                          type="button"
                          onClick={() => toggleCell(dayIdx, slotIdx)}
                          className={`h-8 w-full rounded transition-colors ${
                            active
                              ? 'bg-[#10B981] hover:bg-[#059669]'
                              : 'bg-[#0F172A] ring-1 ring-[#334155] hover:bg-[#263548]'
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-[#F8FAFC]">Preferences</span>
          <Button
            size="sm"
            onClick={handleSaveSchedule}
            className="h-7 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
          >
            Save Schedule
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Preferred Hours
            </Label>
            <div className="flex flex-wrap gap-2">
              {PREF_CHIPS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePreference(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    preferences.has(p)
                      ? 'bg-[#10B981] text-white'
                      : 'bg-[#0F172A] text-[#64748B] hover:bg-[#263548] hover:text-[#94A3B8]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Max Deliveries / Day
            </Label>
            <Input
              type="number"
              value={maxDeliveries}
              onChange={(e) => setMaxDeliveries(Number(e.target.value))}
              min={1}
              max={50}
              className="h-9 w-20 min-h-0 border-[#334155] bg-[#0F172A] text-center text-sm text-[#F8FAFC] focus-visible:ring-[#10B981]"
            />
          </div>
        </div>
      </div>

      {/* Time Off */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-[#F8FAFC]">Time Off</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTimeOffForm((v) => !v)}
            className="h-7 text-xs text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            + Request Time Off
          </Button>
        </div>

        {/* Existing requests */}
        <div className="space-y-2">
          <TimeOffRow
            dates="Mar 20–21"
            reason="Spring break"
            status="approved"
          />
          <TimeOffRow
            dates="Apr 5"
            reason="Personal"
            status="pending"
          />
        </div>

        {/* Request form */}
        {showTimeOffForm && (
          <div className="mt-4 rounded-lg border border-[#334155] bg-[#0F172A] p-4">
            <p className="mb-3 text-xs font-medium text-[#F8FAFC]">Request Time Off</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Start Date</Label>
                <Input
                  type="date"
                  className="h-9 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] focus-visible:ring-[#10B981] [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">End Date</Label>
                <Input
                  type="date"
                  className="h-9 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] focus-visible:ring-[#10B981] [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label className="mb-1 text-xs text-[#64748B]">Reason</Label>
              <Textarea
                rows={2}
                placeholder="Reason for time off..."
                className="min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTimeOffForm(false)}
                className="h-7 text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => { toast.success('Time off requested'); setShowTimeOffForm(false); }}
                className="h-7 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
              >
                Send Request
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time off row
// ---------------------------------------------------------------------------

function TimeOffRow({
  dates,
  reason,
  status,
}: {
  dates: string;
  reason: string;
  status: 'approved' | 'pending' | 'rejected';
}) {
  const styles = {
    approved: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', label: 'Approved' },
    pending: { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B', label: 'Pending' },
    rejected: { bg: 'rgba(239,68,68,0.2)', text: '#EF4444', label: 'Rejected' },
  };
  const s = styles[status];

  return (
    <div className="flex items-center justify-between rounded-md bg-[#0F172A] px-3 py-2.5">
      <div className="flex items-center gap-4 text-xs">
        <span className="font-medium text-[#F8FAFC]">{dates}</span>
        <span className="text-[#64748B]">{reason}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: s.bg, color: s.text }}
        >
          {s.label}
        </span>
        {status === 'pending' && (
          <button type="button" className="text-[11px] text-[#64748B] hover:text-[#EF4444]">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
