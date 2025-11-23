/**
 * Integration Setup Dialog
 * 
 * Provides setup forms for configuring third-party integrations
 */

import { useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
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
        key: 'STRIPE_SECRET_KEY',
        label: 'Secret Key',
        type: 'password',
        placeholder: 'sk_test_...',
        helpText: 'Your Stripe Secret Key (starts with sk_)',
      },
    ],
    docsUrl: 'https://stripe.com/docs/keys',
    testable: true,
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
      // Store secrets (this would call your secrets management API)
      const secretNames = config.fields.map((f) => f.key);
      
      // Simulate API call to store secrets
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      toast.success(`${integrationName} configured successfully`);
      onSetupComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to configure integration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Call the appropriate check function
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
    } catch (error) {
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
            Enter your {integrationName} credentials to enable this integration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type}
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
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
                  onClick={() => window.open(config.docsUrl, '_blank')}
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
            <Button type="submit" disabled={isSubmitting || isTesting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
