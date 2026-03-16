import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TERMINATE_REASONS = [
  'Policy violation',
  'Performance issues',
  'Driver request',
  'Compliance failure',
  'Fraud',
  'Other',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TerminateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: { id: string; full_name: string };
  tenantId: string;
}

export function TerminateDialog({ open, onOpenChange, driver, tenantId }: TerminateDialogProps) {
  const { token, tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [reason, setReason] = useState('');
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setReasonDropdownOpen(false);
      setConfirmName('');
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

  const nameMatches =
    confirmName.trim().toLowerCase() === driver.full_name.trim().toLowerCase();
  const canSubmit = reason.length > 0 && nameMatches;

  const terminateDriver = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('terminate-driver', {
        body: { driver_id: driver.id, reason },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Driver terminated');
      onOpenChange(false);
      // Navigate to drivers list
      const slug = tenant?.slug ?? tenant?.id ?? '';
      if (slug) navigate(`/${slug}/admin/drivers`);
    },
    onError: (err) => {
      logger.error('Terminate driver failed', err);
      toast.error('Failed to terminate driver');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] border-[#334155] bg-[#1E293B] text-[#F8FAFC]">
        {/* Red header */}
        <DialogHeader className="rounded-t-lg bg-[#EF4444]/10 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EF4444]/20">
              <svg className="h-4 w-4 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <div>
              <DialogTitle className="text-[#F8FAFC]">Terminate Driver</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs font-medium text-[#EF4444]">
                Cannot Be Undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Warning card */}
          <div className="rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3">
            <p className="text-sm text-[#F8FAFC]">
              This permanently deactivates their account and removes portal access. Delivery
              history is preserved.
            </p>
          </div>

          {/* Reason dropdown */}
          <div ref={dropdownRef}>
            <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Reason <span className="text-[#EF4444]">*</span>
            </Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setReasonDropdownOpen((v) => !v)}
                className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors ${
                  reason
                    ? 'border-[#334155] bg-[#0F172A] text-[#F8FAFC]'
                    : 'border-[#334155] bg-[#0F172A] text-[#475569]'
                } focus:border-[#EF4444] focus:outline-none focus:ring-1 focus:ring-[#EF4444]`}
              >
                {reason || 'Select a reason...'}
                <svg className="h-4 w-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {reasonDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-[#334155] bg-[#0F172A] py-1 shadow-lg">
                  {TERMINATE_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setReason(r);
                        setReasonDropdownOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2 text-sm transition-colors ${
                        reason === r
                          ? 'bg-[#EF4444]/10 text-[#EF4444]'
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

          {/* Name confirmation */}
          <div>
            <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              Type "{driver.full_name}" to confirm
            </Label>
            <div className="relative">
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={driver.full_name}
                className={`h-9 min-h-0 bg-[#0F172A] pr-8 text-sm text-[#F8FAFC] focus-visible:ring-1 ${
                  confirmName.length === 0
                    ? 'border-[#334155] focus-visible:ring-[#334155]'
                    : nameMatches
                      ? 'border-[#10B981] focus-visible:ring-[#10B981]'
                      : 'border-[#EF4444] focus-visible:ring-[#EF4444]'
                }`}
              />
              {confirmName.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {nameMatches ? (
                    <svg className="h-4 w-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              )}
            </div>
            {confirmName.length > 0 && !nameMatches && (
              <p className="mt-1 text-xs text-[#EF4444]">Name doesn't match yet</p>
            )}
          </div>
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
            onClick={() => terminateDriver.mutate()}
            disabled={!canSubmit || terminateDriver.isPending}
            className={`${
              canSubmit
                ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]'
                : 'bg-[#334155] text-[#64748B]'
            }`}
          >
            {terminateDriver.isPending ? 'Terminating...' : 'Permanently Terminate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
