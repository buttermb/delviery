import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriverInfo {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
  status: string;
  vehicle_type: string | null;
  zone_id: string | null;
}

interface ChecklistItem {
  key: string;
  label: string;
  status: 'complete' | 'waiting' | 'action_required';
  statusLabel: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ActivationBannerProps {
  driver: DriverInfo;
  tenantId: string;
  onAssignZone?: () => void;
  onEditVehicle?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivationBanner({
  driver,
  tenantId,
  onAssignZone,
  onEditVehicle,
}: ActivationBannerProps) {
  const { token } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [forceActivateOpen, setForceActivateOpen] = useState(false);

  const sendReminder = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('add-driver', {
        body: { resend_invite: true, driver_id: driver.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
    },
    onSuccess: () => toast.success('Reminder email sent'),
    onError: (err) => {
      logger.error('Send reminder failed', err);
      toast.error('Failed to send reminder');
    },
  });

  const forceActivate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('couriers')
        .update({ status: 'active', is_active: true })
        .eq('id', driver.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Driver force activated');
      setForceActivateOpen(false);
    },
    onError: (err) => {
      logger.error('Force activate failed', err);
      toast.error('Failed to activate driver');
    },
  });

  const checklist = useMemo<ChecklistItem[]>(() => [
    {
      key: 'auth',
      label: 'Auth account created',
      status: driver.user_id ? 'complete' : 'action_required',
      statusLabel: driver.user_id ? 'Complete' : 'Action required',
    },
    {
      key: 'invite',
      label: 'Invite email sent',
      status: 'complete',
      statusLabel: 'Complete',
    },
    {
      key: 'login',
      label: 'Driver logged in',
      status: 'waiting',
      statusLabel: 'Waiting for driver',
    },
    {
      key: 'pin',
      label: 'PIN verified',
      status: 'waiting',
      statusLabel: 'Waiting for driver',
    },
    {
      key: 'vehicle',
      label: 'Vehicle registered',
      status: driver.vehicle_type ? 'complete' : 'action_required',
      statusLabel: driver.vehicle_type ? 'Complete' : 'Action required',
      actionLabel: driver.vehicle_type ? undefined : 'Complete Now',
      onAction: driver.vehicle_type ? undefined : onEditVehicle,
    },
    {
      key: 'zone',
      label: 'Zone assigned',
      status: driver.zone_id ? 'complete' : 'action_required',
      statusLabel: driver.zone_id ? 'Complete' : 'Action required',
      actionLabel: driver.zone_id ? undefined : 'Assign Zone',
      onAction: driver.zone_id ? undefined : onAssignZone,
    },
  ], [driver, onAssignZone, onEditVehicle]);

  const completed = checklist.filter((i) => i.status === 'complete').length;
  const total = checklist.length;
  const pct = Math.round((completed / total) * 100);

  if (driver.status !== 'pending') return null;

  return (
    <div className="space-y-4">
      {/* Amber banner */}
      <div className="rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-5 py-3">
        <p className="text-sm font-medium text-[#F59E0B]">
          Driver Not Yet Activated —{' '}
          <span className="font-normal text-[#F59E0B]/80">
            Complete the steps below to enable this driver.
          </span>
        </p>
      </div>

      {/* Checklist card */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-[#F8FAFC]">Activation Checklist</span>
          <span className="text-xs font-medium text-[#F59E0B]">
            {completed} of {total} complete ({pct}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-[#334155]">
          <div
            className="h-full rounded-full bg-[#F59E0B] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Checklist rows */}
        <div className="space-y-0">
          {checklist.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between border-b border-[#334155] py-3 last:border-0"
            >
              <div className="flex items-center gap-3">
                <ChecklistIcon status={item.status} />
                <span className="text-sm text-[#F8FAFC]">{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-medium"
                  style={{
                    color:
                      item.status === 'complete'
                        ? '#10B981'
                        : item.status === 'action_required'
                          ? '#F59E0B'
                          : '#64748B',
                  }}
                >
                  {item.statusLabel}
                </span>
                {item.actionLabel && item.onAction && (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="text-xs font-medium text-[#10B981] hover:underline"
                  >
                    {item.actionLabel} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => sendReminder.mutate()}
            disabled={sendReminder.isPending}
            className="h-8 text-xs text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            {sendReminder.isPending ? 'Sending...' : 'Send Reminder Email'}
          </Button>

          <Popover open={forceActivateOpen} onOpenChange={setForceActivateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-[#EF4444]/40 bg-transparent text-xs text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
              >
                Force Activate
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-72 border-[#334155] bg-[#1E293B] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F59E0B]/20">
                  <span className="text-sm text-[#F59E0B]">!</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F8FAFC]">Force Activate?</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Activate without completing all steps? Driver may not be able to log in
                    correctly.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForceActivateOpen(false)}
                      className="h-7 text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => forceActivate.mutate()}
                      disabled={forceActivate.isPending}
                      className="h-7 bg-[#EF4444] text-xs text-white hover:bg-[#DC2626]"
                    >
                      {forceActivate.isPending ? 'Activating...' : 'Activate Anyway'}
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist icon
// ---------------------------------------------------------------------------

function ChecklistIcon({ status }: { status: ChecklistItem['status'] }) {
  if (status === 'complete') {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10B981]/20">
        <svg className="h-3 w-3 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'action_required') {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F59E0B]/20">
        <span className="text-[10px] font-bold text-[#F59E0B]">!</span>
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#64748B]/20">
      <svg className="h-3 w-3 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 6v6l3 3" />
      </svg>
    </div>
  );
}
