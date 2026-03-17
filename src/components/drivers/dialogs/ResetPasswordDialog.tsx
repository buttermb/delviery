import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#EF4444' };
  if (score === 2) return { score, label: 'Fair', color: '#F59E0B' };
  return { score, label: 'Strong', color: '#10B981' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: { id: string; full_name: string; email: string };
  tenantId: string;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  driver,
  tenantId,
}: ResetPasswordDialogProps) {
  const { token } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<'email' | 'manual'>('email');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requireChange, setRequireChange] = useState(true);

  useEffect(() => {
    if (open) {
      setMethod('email');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setRequireChange(true);
    }
  }, [open]);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const canSubmit =
    method === 'email' || (password.length >= 8 && passwordsMatch);

  const resetPassword = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        driver_id: driver.id,
        method,
      };
      if (method === 'manual') {
        body.new_password = password;
        body.require_change = requireChange;
      }
      const res = await supabase.functions.invoke('reset-driver-password', {
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
      return res.data as { success: boolean; method: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success(
        method === 'email' ? 'Password reset email sent' : 'Password updated successfully',
      );
      onOpenChange(false);
    },
    onError: (err) => {
      logger.error('Reset password failed', err);
      toast.error('Failed to reset password');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Reset Password</DialogTitle>
          <DialogDescription className="text-muted-foreground">{driver.full_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method selection */}
          <div className="space-y-2">
            <MethodCard
              selected={method === 'email'}
              onClick={() => setMethod('email')}
              title="Send password reset email"
              badge="Recommended"
            />
            <MethodCard
              selected={method === 'manual'}
              onClick={() => setMethod('manual')}
              title="Set temporary password manually"
            />
          </div>

          {/* Email method: readonly email display */}
          {method === 'email' && (
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Will be sent to</Label>
              <Input
                value={driver.email}
                readOnly
                className="h-9 min-h-0 border-border bg-background text-sm text-muted-foreground focus-visible:ring-border"
              />
            </div>
          )}

          {/* Manual method: password fields */}
          {method === 'manual' && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 min-h-0 border-border bg-background pr-10 text-sm text-foreground focus-visible:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Confirm Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPassword.length > 0 && !passwordsMatch}
                  className="h-9 min-h-0 border-border bg-background text-sm text-foreground focus-visible:ring-emerald-500"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1 text-xs text-destructive">Passwords don't match</p>
                )}
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2].map((seg) => (
                      <div
                        key={seg}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{
                          backgroundColor: seg < strength.score ? strength.color : '#334155',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}

              {/* Require change checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={requireChange}
                  onCheckedChange={(checked) => setRequireChange(checked === true)}
                  className="border-border data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                />
                <span className="text-sm text-muted-foreground">Require change on next login</span>
              </label>
            </div>
          )}
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
            onClick={() => resetPassword.mutate()}
            disabled={!canSubmit || resetPassword.isPending}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
          >
            {resetPassword.isPending
              ? 'Sending...'
              : method === 'email'
                ? 'Send Reset Email'
                : 'Set Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Method card
// ---------------------------------------------------------------------------

function MethodCard({
  selected,
  onClick,
  title,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-emerald-500 bg-emerald-500/5'
          : 'border-border bg-background hover:border-muted-foreground'
      }`}
    >
      <div
        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
          selected ? 'border-emerald-500' : 'border-muted-foreground'
        }`}
      >
        {selected && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
      </div>
      <span className="text-sm text-foreground">{title}</span>
      {badge && (
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
          {badge}
        </span>
      )}
    </button>
  );
}
