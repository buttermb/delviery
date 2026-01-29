import { useState } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { haptics } from '@/utils/haptics';

const CONFIRMATION_TEXT = 'DELETE';

interface AccountDangerZoneProps {
  /**
   * ID of the user whose account will be deleted
   */
  userId: string;
  /**
   * Tenant ID for multi-tenant context
   */
  tenantId: string;
  /**
   * User's email (displayed in warning and for context)
   */
  userEmail: string;
  /**
   * Callback after successful account deletion (e.g., navigate to login)
   */
  onAccountDeleted: () => void;
  /**
   * Optional list of items that will be deleted/affected
   */
  affectedData?: string[];
}

export function AccountDangerZone({
  userId,
  tenantId,
  userEmail,
  onAccountDeleted,
  affectedData,
}: AccountDangerZoneProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'password' | 'confirm'>('password');

  const defaultAffectedData = [
    'Your profile information and personal data',
    'Order history (anonymized, not deleted, for compliance)',
    'Saved addresses and payment preferences',
    'Active sessions and authentication tokens',
    'Notification preferences and settings',
  ];

  const dataToDelete = affectedData ?? defaultAffectedData;

  const isConfirmTextValid = confirmText === CONFIRMATION_TEXT;
  const isPasswordValid = password.length >= 1;

  const resetState = () => {
    setPassword('');
    setConfirmText('');
    setError(null);
    setStep('password');
    setLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    setDialogOpen(open);
  };

  const handlePasswordStep = async () => {
    if (!isPasswordValid) return;

    setLoading(true);
    setError(null);

    try {
      // Verify password by attempting sign-in with the user's email
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (signInError) {
        setError('Incorrect password. Please try again.');
        haptics.error();
        return;
      }

      // Password verified, move to confirmation step
      setStep('confirm');
    } catch (err: unknown) {
      logger.error('Password verification failed', err, { component: 'AccountDangerZone' });
      setError('Failed to verify password. Please try again.');
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isConfirmTextValid) return;

    setLoading(true);
    setError(null);

    try {
      haptics.heavy();

      const { data, error: fnError } = await supabase.functions.invoke(
        'delete-customer-account',
        {
          body: {
            customer_user_id: userId,
            tenant_id: tenantId,
            reason: 'User requested account deletion from settings',
          },
        }
      );

      if (fnError) {
        throw fnError;
      }

      // Check for error in response body
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : 'Failed to delete account';
        throw new Error(errorMessage);
      }

      haptics.success();

      toast({
        title: 'Account Deleted',
        description: 'Your account has been permanently deleted. Your data has been anonymized.',
      });

      onAccountDeleted();
    } catch (err: unknown) {
      logger.error('Account deletion failed', err, { component: 'AccountDangerZone' });

      const message = err instanceof Error
        ? err.message
        : 'Failed to delete your account. Please try again or contact support.';

      setError(message);
      haptics.error();

      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-destructive/50 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Actions in this section are irreversible. Please proceed with caution.
        </p>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="space-y-1">
            <p className="font-medium">Delete Account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setDialogOpen(true)}
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>Delete Your Account</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              This action is permanent and cannot be undone. Your account for{' '}
              <span className="font-medium text-foreground">{userEmail}</span>{' '}
              will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* What will be deleted */}
          <div className="space-y-3">
            <p className="text-sm font-medium">The following will be affected:</p>
            <ul className="space-y-1.5">
              {dataToDelete.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-destructive mt-0.5 shrink-0">&#x2022;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Password verification */}
          {step === 'password' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="danger-zone-password">
                  Enter your password to continue
                </Label>
                <PasswordInput
                  id="danger-zone-password"
                  placeholder="Your current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isPasswordValid && !loading) {
                      handlePasswordStep();
                    }
                  }}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>
          )}

          {/* Step 2: Type DELETE confirmation */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="danger-zone-confirm">
                  Type <span className="font-mono font-bold text-destructive">{CONFIRMATION_TEXT}</span> to confirm
                </Label>
                <Input
                  id="danger-zone-confirm"
                  type="text"
                  placeholder={CONFIRMATION_TEXT}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isConfirmTextValid && !loading) {
                      handleDeleteAccount();
                    }
                  }}
                  disabled={loading}
                  autoComplete="off"
                  className="font-mono"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} onClick={() => handleOpenChange(false)}>
              Cancel
            </AlertDialogCancel>

            {step === 'password' && (
              <Button
                variant="destructive"
                onClick={handlePasswordStep}
                disabled={!isPasswordValid || loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Verifying...' : 'Continue'}
              </Button>
            )}

            {step === 'confirm' && (
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!isConfirmTextValid || loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Deleting...' : 'Permanently Delete Account'}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
