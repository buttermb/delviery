import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
// Helpers
// ---------------------------------------------------------------------------

function generatePin(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => String(b % 10)).join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ResetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: { id: string; full_name: string };
  tenantId: string;
}

export function ResetPinDialog({ open, onOpenChange, driver, tenantId }: ResetPinDialogProps) {
  const { token } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [autoGenerate, setAutoGenerate] = useState(true);
  const [generatedPin, setGeneratedPin] = useState(generatePin);
  const [manualDigits, setManualDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAutoGenerate(true);
      setGeneratedPin(generatePin());
      setManualDigits(['', '', '', '', '', '']);
      setNotifyEmail(true);
    }
  }, [open]);

  const regenerate = useCallback(() => {
    setGeneratedPin(generatePin());
  }, []);

  const handleManualInput = useCallback(
    (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      setManualDigits((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
      // Auto-advance to next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [],
  );

  const handleManualKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !manualDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [manualDigits],
  );

  const pinToSubmit = autoGenerate ? generatedPin : manualDigits.join('');
  const isManualComplete = manualDigits.every((d) => d !== '');
  const canSubmit = autoGenerate || isManualComplete;

  const resetPin = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('reset-driver-pin', {
        body: {
          driver_id: driver.id,
          pin: pinToSubmit,
          notify_email: notifyEmail,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
      return res.data as { pin: string; email_sent: boolean };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('PIN reset successfully');
      onOpenChange(false);
    },
    onError: (err) => {
      logger.error('Reset PIN failed', err);
      toast.error('Failed to reset PIN');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Reset Driver PIN</DialogTitle>
          <DialogDescription className="text-muted-foreground">{driver.full_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current PIN */}
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              Current PIN
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-background"
                >
                  <span className="text-lg text-muted-foreground">•</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-generate toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Auto-generate</span>
            <Switch
              checked={autoGenerate}
              onCheckedChange={setAutoGenerate}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          {/* Auto-generated PIN display */}
          {autoGenerate && (
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                New PIN
              </span>
              <div className="mt-1.5 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                <span className="font-['Space_Grotesk'] text-2xl font-bold tracking-[0.25em] text-foreground">
                  {generatedPin}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={regenerate}
                  className="h-7 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          <div className="h-px bg-muted" />

          {/* Manual entry toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Manual entry</span>
            <Switch
              checked={!autoGenerate}
              onCheckedChange={(checked) => setAutoGenerate(!checked)}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          {/* Manual PIN entry */}
          {!autoGenerate && (
            <div className="flex items-center justify-center gap-2">
              {manualDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleManualInput(i, e.target.value)}
                  onKeyDown={(e) => handleManualKeyDown(i, e)}
                  className={`h-12 w-12 rounded-lg border text-center font-['Space_Grotesk'] text-xl font-bold text-foreground transition-colors ${
                    digit
                      ? 'border-emerald-500 bg-background'
                      : 'border-border bg-background'
                  } placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                  placeholder="_"
                />
              ))}
            </div>
          )}

          {/* Notify checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={notifyEmail}
              onCheckedChange={(checked) => setNotifyEmail(checked === true)}
              className="border-border data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
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
            onClick={() => resetPin.mutate()}
            disabled={!canSubmit || resetPin.isPending}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
          >
            {resetPin.isPending ? 'Resetting...' : 'Reset PIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
