import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REASONS = [
  'Complaint received',
  'Performance issues',
  'Inactive too long',
  'Policy violation',
  'Other',
] as const;

const DURATION_OPTIONS = [
  { label: '3 days', value: 3 },
  { label: '1 week', value: 7 },
  { label: '2 weeks', value: 14 },
  { label: '1 month', value: 30 },
  { label: 'Indefinite', value: null },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: { id: string; full_name: string };
  tenantId: string;
}

export function SuspendDialog({ open, onOpenChange, driver, tenantId }: SuspendDialogProps) {
  const { token } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState('');
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [duration, setDuration] = useState<number | null>(7);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setReasonDropdownOpen(false);
      setDuration(7);
      setNotifyEmail(true);
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!reasonDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setReasonDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [reasonDropdownOpen]);

  const canSubmit = reason.length > 0;

  const suspendDriver = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('suspend-driver', {
        body: {
          driver_id: driver.id,
          reason,
          duration_days: duration,
          notify_email: notifyEmail,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
      return res.data as { success: boolean; suspended_until: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Driver suspended');
      onOpenChange(false);
    },
    onError: (err) => {
      logger.error('Suspend driver failed', err);
      toast.error('Failed to suspend driver');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] border-[#334155] bg-[#1E293B] text-[#F8FAFC]">
        {/* Amber header */}
        <DialogHeader className="rounded-t-lg bg-[#F59E0B]/10 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F59E0B]/20">
              <svg className="h-4 w-4 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
            <DialogTitle className="text-[#F8FAFC]">Suspend {driver.full_name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-[#94A3B8]">
            Suspended drivers cannot log in or accept deliveries. You can reactivate them at any
            time.
          </p>

          {/* Reason dropdown */}
          <div ref={dropdownRef}>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Reason
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setReasonDropdownOpen((v) => !v)}
                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors ${
                  reason
                    ? 'border-[#334155] bg-[#0F172A] text-[#F8FAFC]'
                    : 'border-[#334155] bg-[#0F172A] text-[#475569]'
                } focus:border-[#F59E0B] focus:outline-none focus:ring-1 focus:ring-[#F59E0B]`}
              >
                {reason || 'Select a reason...'}
                <svg className="h-4 w-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {reasonDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-[#334155] bg-[#0F172A] py-1 shadow-lg">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setReason(r);
                        setReasonDropdownOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2 text-sm transition-colors ${
                        reason === r
                          ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                          : 'text-[#F8FAFC] hover:bg-[#263548]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Duration chips */}
          <div>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Duration
            </span>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    duration === opt.value
                      ? 'bg-[#F59E0B] text-white'
                      : 'bg-[#0F172A] text-[#64748B] hover:bg-[#263548] hover:text-[#94A3B8]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notify checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={notifyEmail}
              onCheckedChange={(checked) => setNotifyEmail(checked === true)}
              className="border-[#334155] data-[state=checked]:border-[#F59E0B] data-[state=checked]:bg-[#F59E0B]"
            />
            <span className="text-sm text-[#94A3B8]">Notify driver via email</span>
          </label>
        </div>

        <DialogFooter className="border-[#334155]">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => suspendDriver.mutate()}
            disabled={!canSubmit || suspendDriver.isPending}
            className="bg-[#F59E0B] text-white hover:bg-[#D97706]"
          >
            {suspendDriver.isPending ? 'Suspending...' : 'Suspend Driver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
