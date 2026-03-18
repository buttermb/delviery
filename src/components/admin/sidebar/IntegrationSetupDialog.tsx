/**
 * Integration Setup Dialog
 *
 * Provides setup forms for configuring third-party integrations.
 * All credentials are saved via the save-integration-secrets edge function.
 */

import { useState } from 'react';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationName: string;
  onSetupComplete: () => void;
}

type IntegrationConfig = {
  [key: string]: {
    fields: Array<{
      key: string;
      label: string;
      type: string;
      placeholder: string;
      helpText?: string;
    }>;
    docsUrl?: string;
    testable?: boolean;
  };
};

const INTEGRATION_CONFIGS: IntegrationConfig = {
  stripe: {
    fields: [
      {
        key: 'TENANT_STRIPE_SECRET_KEY',
        label: 'Your Stripe Secret Key',
        type: 'password',
        placeholder: 'sk_live_... or sk_test_...',
        helpText: 'Your own Stripe secret key for accepting payments from customers'
      },
      {
        key: 'TENANT_STRIPE_PUBLISHABLE_KEY',
        label: 'Your Stripe Publishable Key',
        type: 'text',
        placeholder: 'pk_live_... or pk_test_...',
        helpText: 'Your Stripe publishable key for checkout forms'
      }
    ],
    docsUrl: 'https://stripe.com/docs/keys',
    testable: false,
  },
  twilio: {
    fields: [
      {
        key: 'TWILIO_ACCOUNT_SID',
        label: 'Account SID',
        type: 'text',
        placeholder: 'AC...',
        helpText: 'Your Twilio Account SID',
      },
      {
        key: 'TWILIO_AUTH_TOKEN',
        label: 'Auth Token',
        type: 'password',
        placeholder: 'Your auth token',
        helpText: 'Your Twilio Auth Token',
      },
    ],
    docsUrl: 'https://www.twilio.com/console',
    testable: true,
  },
  sendgrid: {
    fields: [
      {
        key: 'SENDGRID_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'SG...',
        helpText: 'Your SendGrid API Key',
      },
    ],
    docsUrl: 'https://app.sendgrid.com/settings/api_keys',
    testable: true,
  },
  mapbox: {
    fields: [
      {
        key: 'VITE_MAPBOX_TOKEN',
        label: 'Public Access Token',
        type: 'text',
        placeholder: 'pk.ey...',
        helpText: 'Your Mapbox public token (starts with pk.)',
      },
    ],
    docsUrl: 'https://account.mapbox.com/access-tokens',
    testable: false,
  },
};

export function IntegrationSetupDialog({
  open,
  onOpenChange,
  integrationId,
  integrationName,
  onSetupComplete,
}: IntegrationSetupDialogProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const config = INTEGRATION_CONFIGS[integrationId];

  if (!config) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTestResult(null);

    try {
      const { supabase } = await import('@/integrations/supabase/client');

      const { data, error } = await supabase.functions.invoke('save-integration-secrets', {
        body: {
          integration_id: integrationId,
          credentials: formData,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to save integration credentials');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`${integrationName} configured successfully`);
      onSetupComplete();
      onOpenChange(false);
    } catch (error) {
      logger.error('Setup error:', error instanceof Error ? error : new Error(String(error)), { component: 'IntegrationSetupDialog' });
      toast.error(humanizeError(error, 'Failed to configure integration'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const { supabase } = await import('@/integrations/supabase/client');

      let result;
      switch (integrationId) {
        case 'stripe':
          result = await supabase.functions.invoke('check-stripe-config');
          break;
        case 'twilio':
          result = await supabase.functions.invoke('check-twilio-config');
          break;
        case 'sendgrid':
          result = await supabase.functions.invoke('check-sendgrid-config');
          break;
        default:
          throw new Error('Test not supported for this integration');
      }

      if (result.error) {
        setTestResult({
          success: false,
          message: 'Connection test failed. Please check your credentials.',
        });
      } else if (result.data?.configured) {
        setTestResult({
          success: true,
          message: 'Connection successful! Integration is working correctly.',
        });
      } else {
        setTestResult({
          success: false,
          message: 'Integration is not configured yet.',
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Failed to test connection. Please try again.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure {integrationName}</DialogTitle>
          <DialogDescription>
            {integrationId === 'stripe'
              ? 'Enter your own Stripe API keys to accept payments from your customers. This is separate from the platform subscription billing.'
              : `Enter your ${integrationName} credentials to enable this integration.`}
          </DialogDescription>
          {integrationId === 'stripe' && formData.TENANT_STRIPE_SECRET_KEY?.startsWith('sk_test_') && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Test Mode Active</span>
              <Badge variant="secondary">No real charges will be made</Badge>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type}
                placeholder={field.placeholder}
                value={formData[field.key] ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, [field.key]: e.target.value })
                }
                required
              />
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          ))}

          {config.docsUrl && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <span className="text-sm">Need help finding your credentials?</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => window.open(config.docsUrl, '_blank', 'noopener,noreferrer')}
                >
                  View Documentation
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <AlertDescription className="flex items-center gap-2">
                {testResult.success && <CheckCircle2 className="h-4 w-4" />}
                {testResult.message}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            {config.testable && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || isSubmitting}
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
            )}
            {config.fields.length > 0 && (
              <Button type="submit" disabled={isSubmitting || isTesting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
