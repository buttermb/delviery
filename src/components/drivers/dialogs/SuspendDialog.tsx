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
      <DialogContent className="max-w-[420px] border-border bg-card text-foreground">
        {/* Amber header */}
        <DialogHeader className="rounded-t-lg bg-amber-500/10 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
            <DialogTitle className="text-foreground">Suspend {driver.full_name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Suspended drivers cannot log in or accept deliveries. You can reactivate them at any
            time.
          </p>

          {/* Reason dropdown */}
          <div ref={dropdownRef}>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Reason
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setReasonDropdownOpen((v) => !v)}
                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors ${
                  reason
                    ? 'border-border bg-background text-foreground'
                    : 'border-border bg-background text-muted-foreground'
                } focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500`}
              >
                {reason || 'Select a reason...'}
                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {reasonDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-background py-1 shadow-lg">
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
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'text-foreground hover:bg-accent'
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
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
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
                      ? 'bg-amber-500 text-white'
                      : 'bg-background text-muted-foreground hover:bg-accent hover:text-muted-foreground'
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
              className="border-border data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
            />
            <span className="text-sm text-muted-foreground">Notify driver via email</span>
          </label>
        </div>

        <DialogFooter className="border-border">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={() => suspendDriver.mutate()}
            disabled={!canSubmit || suspendDriver.isPending}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            {suspendDriver.isPending ? 'Suspending...' : 'Suspend Driver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
