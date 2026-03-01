import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { Shield, Save, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const securitySchema = z.object({
  twoFactorEnabled: z.boolean(),
  requirePasswordChange: z.boolean(),
  sessionTimeout: z.number().min(5).max(1440),
  passwordMinLength: z.number().min(8).max(32),
});

type SecurityFormValues = z.infer<typeof securitySchema>;

function SecuritySkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-6 w-1/4" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function TenantSecuritySettings() {
  const { account, refreshAccount, loading: accountLoading } = useAccount();
  const [saving, setSaving] = useState(false);
  const [_initialized, setInitialized] = useState(false);

  const form = useForm<SecurityFormValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      twoFactorEnabled: false,
      requirePasswordChange: false,
      sessionTimeout: 30,
      passwordMinLength: 8,
    },
  });

  useEffect(() => {
    if (account) {
      const metadata = (account as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      const secSettings = (metadata?.security as Record<string, unknown>) || {};
      form.reset({
        twoFactorEnabled: (secSettings.twoFactorEnabled as boolean) ?? false,
        requirePasswordChange: (secSettings.requirePasswordChange as boolean) ?? false,
        sessionTimeout: (secSettings.sessionTimeout as number) || 30,
        passwordMinLength: (secSettings.passwordMinLength as number) || 8,
      });
    }
    // Mark initialized once loading completes, even if account is null
    if (!accountLoading) {
      setInitialized(true);
    }
  }, [account, accountLoading, form]);

  const onSave = async (data: SecurityFormValues) => {
    if (!account) return;
    setSaving(true);
    try {
      const metadata = ((account as unknown as Record<string, unknown>).metadata as object) || {};
      const { error } = await supabase
        .from('accounts')
        .update({
          metadata: {
            ...metadata,
            security: data,
          },
        })
        .eq('id', account.id);

      if (error) throw error;
      await refreshAccount();
      toast.success('Security settings updated successfully.');
    } catch (err) {
      logger.error('Error saving security settings', err);
      toast.error('Failed to save security settings.', { description: humanizeError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (accountLoading) {
    return <SecuritySkeleton />;
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5" />
        Security Settings
      </h3>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Two-Factor Authentication</Label>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security to your account
            </p>
          </div>
          <Switch
            checked={form.watch('twoFactorEnabled')}
            onCheckedChange={(checked) => form.setValue('twoFactorEnabled', checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Require Password Change</Label>
            <p className="text-sm text-muted-foreground">
              Force password changes every 90 days
            </p>
          </div>
          <Switch
            checked={form.watch('requirePasswordChange')}
            onCheckedChange={(checked) => form.setValue('requirePasswordChange', checked)}
          />
        </div>
        <div>
          <Label>Session Timeout (minutes)</Label>
          <Input
            type="number"
            {...form.register('sessionTimeout', { valueAsNumber: true })}
          />
          {form.formState.errors.sessionTimeout && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.sessionTimeout.message}
            </p>
          )}
        </div>
        <div>
          <Label>Minimum Password Length</Label>
          <Input
            type="number"
            {...form.register('passwordMinLength', { valueAsNumber: true })}
          />
          {form.formState.errors.passwordMinLength && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.passwordMinLength.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Security Settings
        </Button>
      </form>
    </Card>
  );
}
