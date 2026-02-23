import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Clock, Mail, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useAccountLockStatus } from '@/hooks/useAccountLockStatus';

interface AccountLockedScreenProps {
  email: string;
  tenantSlug: string;
  lockDurationSeconds: number;
  businessName: string;
  onUnlocked: () => void;
  onBack: () => void;
}

/**
 * Account locked screen shown when a user's account is locked due to
 * too many failed login attempts. Shows:
 * - Lock status with remaining countdown
 * - Contact support link
 * - Option to request admin unlock via email
 * - Automatic unlock when timer expires
 */
export function AccountLockedScreen({
  email,
  tenantSlug,
  lockDurationSeconds,
  businessName,
  onUnlocked,
  onBack,
}: AccountLockedScreenProps) {
  const [unlockEmail, setUnlockEmail] = useState(email);
  const [requestingUnlock, setRequestingUnlock] = useState(false);
  const [unlockRequested, setUnlockRequested] = useState(false);

  const { isLocked, remainingSeconds } = useAccountLockStatus({
    email,
    tenantSlug,
    lockDurationSeconds,
    onUnlocked,
  });

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  const handleRequestUnlock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unlockEmail.trim()) {
      toast.error('Please enter your email address to request an unlock.');
      return;
    }

    setRequestingUnlock(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const _response = await fetch(
        `${supabaseUrl}/functions/v1/request-account-unlock`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            email: unlockEmail.trim().toLowerCase(),
            tenantSlug,
          }),
        }
      );

      // Always show success to avoid email enumeration
      setUnlockRequested(true);
      toast.success('Unlock Request Sent — If this email is associated with an account, the admin will be notified.');

      logger.info('Account unlock requested', { email: unlockEmail, tenantSlug });
    } catch (error: unknown) {
      // Still show success message to prevent email enumeration
      setUnlockRequested(true);
      toast.success('Unlock Request Sent — If this email is associated with an account, the admin will be notified.');
      logger.error('Account unlock request failed', error, { component: 'AccountLockedScreen' });
    } finally {
      setRequestingUnlock(false);
    }
  };

  // If the lock has already expired, notify immediately
  if (!isLocked) {
    return (
      <div className="text-center space-y-4">
        <div className="relative mx-auto w-fit">
          <div className="absolute inset-0 bg-green-500/20 rounded-full blur-lg" />
          <div className="relative rounded-full bg-green-100 p-4">
            <Shield className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">Account Unlocked</h2>
        <p className="text-sm text-muted-foreground">
          Your account is no longer locked. You can try logging in again.
        </p>
        <Button onClick={onBack} className="w-full">
          Return to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="relative mx-auto w-fit">
          <div className="absolute inset-0 bg-destructive/20 rounded-full blur-lg" />
          <div className="relative rounded-full bg-destructive/10 p-4">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">Account Locked</h2>
        <p className="text-sm text-muted-foreground">
          Your account has been temporarily locked due to too many failed login attempts.
        </p>
      </div>

      {/* Countdown Timer */}
      <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Unlock in</span>
        </div>
        <div className="text-3xl font-mono font-bold text-foreground">
          {formatTime(remainingSeconds)}
        </div>
        <p className="text-xs text-muted-foreground">
          The account will automatically unlock when the timer expires.
        </p>
      </div>

      {/* Request Admin Unlock */}
      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Request Early Unlock
        </h3>
        <p className="text-xs text-muted-foreground">
          Can't wait? Request an admin to unlock your account immediately.
        </p>

        {unlockRequested ? (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
            <Mail className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Request Sent</p>
            <p className="text-xs text-muted-foreground mt-1">
              The account administrator has been notified. They will review your request shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRequestUnlock} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="unlock-email" className="text-xs">
                Email Address
              </Label>
              <Input
                id="unlock-email"
                type="email"
                placeholder="your@email.com"
                value={unlockEmail}
                onChange={(e) => setUnlockEmail(e.target.value)}
                required
                disabled={requestingUnlock}
                autoComplete="email"
                inputMode="email"
                className="h-10 text-sm"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={requestingUnlock}
            >
              {requestingUnlock ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Request Admin Unlock
                </>
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Contact Support */}
      <div className="border-t border-border pt-4 text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Need immediate assistance?
        </p>
        <a
          href={`mailto:support@${tenantSlug}.floraiq.com?subject=Account%20Unlock%20Request%20-%20${encodeURIComponent(email)}&body=I%20am%20locked%20out%20of%20my%20account%20for%20${encodeURIComponent(businessName)}.%20Please%20help%20me%20regain%20access.%0A%0AEmail%3A%20${encodeURIComponent(email)}%0ATenant%3A%20${encodeURIComponent(tenantSlug)}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Contact Support
        </a>
      </div>

      {/* Back to Login */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="w-full text-muted-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Login
      </Button>
    </div>
  );
}
