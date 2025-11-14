/**
 * Integration Manager Component
 * 
 * UI for enabling/disabling third-party integrations
 */

import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIntegrationManager } from '@/hooks/useIntegrationManager';
import { ExternalLink, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';

export function IntegrationManager() {
  const { getIntegrationsWithStatus, toggleIntegration, refreshConnectionStatus } = useIntegrationManager();
  const navigate = useNavigate();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const integrations = getIntegrationsWithStatus();

  // Helper to identify if an integration is for payment processing (not billing)
  const isPaymentIntegration = (id: string) => id === 'stripe';

  const handleRefreshStatus = async (integrationId: string) => {
    setRefreshingId(integrationId);
    try {
      const isConnected = await refreshConnectionStatus(integrationId);
      toast.success(
        isConnected 
          ? `${integrationId} is connected` 
          : `${integrationId} is not configured`
      );
    } catch (error) {
      toast.error('Failed to check connection status');
    } finally {
      setRefreshingId(null);
    }
  };

  const getStatusIcon = (connected: boolean) => {
    if (connected) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (integration: { enabled?: boolean; status?: string }) => {
    if (!integration.enabled) {
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Disabled
        </Badge>
      );
    }
    
    if (integration.connected) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="gap-1">
        <XCircle className="h-3 w-3" />
        Not Configured
      </Badge>
    );
  };

  const handleToggle = async (integrationId: string, currentlyEnabled: boolean) => {
    await toggleIntegration(integrationId);
    toast.success(
      currentlyEnabled
        ? `${integrationId} integration disabled`
        : `${integrationId} integration enabled`
    );
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <h4 className="font-medium text-sm mb-1">💳 About Stripe Integration</h4>
        <p className="text-sm text-muted-foreground">
          This Stripe integration is for <strong>accepting payments from your customers</strong>. 
          Your platform subscription billing (what you pay us) uses a separate Stripe account. 
          Enable this to add customer payment features to your admin panel.
        </p>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Enable or disable integrations to show/hide related features in your sidebar
      </p>

      {integrations.map((integration) => (
        <div
          key={integration.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <integration.icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{integration.name}</h4>
                {isPaymentIntegration(integration.id) && (
                  <Badge variant="secondary" className="text-xs">
                    Customer Payments
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {integration.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {integration.featuresEnabled.slice(0, 3).map((feature) => (
                  <Badge key={feature} variant="outline" className="text-xs">
                    {feature}
                  </Badge>
                ))}
                {integration.featuresEnabled.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{integration.featuresEnabled.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge(integration)}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRefreshStatus(integration.id)}
              disabled={refreshingId === integration.id}
              className="h-8 w-8"
              title="Check connection status"
            >
              <RefreshCw 
                className={`h-4 w-4 ${refreshingId === integration.id ? 'animate-spin' : ''}`} 
              />
            </Button>
            
            <Switch
              checked={integration.enabled}
              onCheckedChange={() => handleToggle(integration.id, integration.enabled)}
            />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(integration.setupUrl)}
              className="h-8 w-8"
              title="Configure integration"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <div className="p-4 border border-dashed rounded-lg text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Want to add more integrations?
        </p>
        <Button variant="outline" size="sm">
          Request Integration
        </Button>
      </div>
    </div>
  );
}
