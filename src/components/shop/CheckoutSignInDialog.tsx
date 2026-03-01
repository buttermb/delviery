/**
 * Sign-in dialog for checkout — lets existing customers log in
 * to auto-fill contact info and link orders to their account.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

interface CheckoutSignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSignInSuccess: (customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }) => void;
}

export function CheckoutSignInDialog({
  open,
  onOpenChange,
  tenantId,
  onSignInSuccess,
}: CheckoutSignInDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      // Look up tenant slug from tenant_id
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantId)
        .maybeSingle();

      if (tenantError || !tenant?.slug) {
        throw new Error('Unable to verify store. Please try again.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/customer-auth?action=login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            tenantSlug: tenant.slug,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Login failed' }));
        if (response.status === 403 && body.requires_verification) {
          throw new Error('Please verify your email before signing in.');
        }
        throw new Error(body.error || 'Invalid email or password');
      }

      const data = await response.json();
      const customer = data.customer;

      onSignInSuccess({
        firstName: customer?.first_name || '',
        lastName: customer?.last_name || '',
        email: customer?.email || email,
        phone: customer?.phone || '',
      });

      toast.success('Signed in!', {
        description: 'Your info has been filled in.',
      });

      onOpenChange(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      logger.warn('Checkout sign-in failed', err instanceof Error ? err : new Error(message), {
        component: 'CheckoutSignInDialog',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to your account</DialogTitle>
          <DialogDescription>
            Sign in to auto-fill your info and track your orders.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
              minLength={8}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
