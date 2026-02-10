/**
 * Integration Manager Component
 * 
 * UI for enabling/disabling third-party integrations
 */

import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIntegrationManager } from '@/hooks/useIntegrationManager';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Settings, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';
import { IntegrationSetupDialog } from './IntegrationSetupDialog';
import { CustomIntegrationForm } from './CustomIntegrationForm';

export function IntegrationManager() {
  const { getIntegrationsWithStatus, toggleIntegration, refreshConnectionStatus } = useIntegrationManager();
  const _navigate = useNavigate();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<{ id: string; name: string } | null>(null);
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState<Record<string, Date>>({});

  const integrations = getIntegrationsWithStatus();

  // Helper to identify if an integration is for payment processing (not billing)
  const isPaymentIntegration = (id: string) => id === 'stripe';

  const handleRefreshStatus = async (integrationId: string, integrationName: string) => {
    setRefreshingId(integrationId);
    try {
      const isConnected = await refreshConnectionStatus(integrationId);
      setLastChecked({ ...lastChecked, [integrationId]: new Date() });
      
      if (isConnected) {
        toast.success(`${integrationName} is connected and working`, {
          description: 'Connection verified successfully',
        });
      } else {
        toast.warning(`${integrationName} is not configured`, {
          description: 'Click the configure button to set it up',
          action: {
            label: 'Configure',
            onClick: () => handleConfigureClick(integrationId, integrationName),
          },
        });
      }
    } catch {
      toast.error(`Failed to check ${integrationName} connection`, {
        description: 'Please try again or check your network connection',
      });
    } finally {
      setRefreshingId(null);
    }
  };

  const _getStatusIcon = (connected: boolean) => {
    if (connected) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (integration: { id: string; enabled?: boolean; status?: string; connected?: boolean }) => {
    const timeSince = getTimeSinceCheck(integration.id);
    
    if (!integration.enabled) {
      return (
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Disabled
          </Badge>
          {timeSince && <span className="text-xs text-muted-foreground">{timeSince}</span>}
        </div>
      );
    }
    
    if (integration.connected) {
      return (
        <div className="flex flex-col items-end gap-1">
          <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </Badge>
          {timeSince && <span className="text-xs text-muted-foreground">{timeSince}</span>}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Not Configured
        </Badge>
        {timeSince && <span className="text-xs text-muted-foreground">{timeSince}</span>}
      </div>
    );
  };

  const handleToggle = async (
    integrationId: string,
    currentlyEnabled: boolean,
    isConnected: boolean,
    integrationName: string
  ) => {
    // Warn if enabling without configuration
    if (!currentlyEnabled && !isConnected) {
      toast.warning(`${integrationName} is not configured yet`, {
        description: 'You can enable it, but you\'ll need to configure it before use',
        action: {
          label: 'Configure Now',
          onClick: () => handleConfigureClick(integrationId, integrationName),
        },
      });
    }

    await toggleIntegration(integrationId);
    toast.success(
      currentlyEnabled
        ? `${integrationName} disabled`
        : `${integrationName} enabled`
    );
  };

  const handleConfigureClick = (integrationId: string, integrationName: string) => {
    setSelectedIntegration({ id: integrationId, name: integrationName });
    setSetupDialogOpen(true);
  };

  const handleSetupComplete = async () => {
    if (selectedIntegration) {
      await refreshConnectionStatus(selectedIntegration.id);
      setLastChecked({ ...lastChecked, [selectedIntegration.id]: new Date() });
    }
  };

  const getTimeSinceCheck = (integrationId: string): string => {
    const lastCheck = lastChecked[integrationId];
    if (!lastCheck) return '';
    
    const seconds = Math.floor((Date.now() - lastCheck.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
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
              onClick={() => handleRefreshStatus(integration.id, integration.name)}
              disabled={refreshingId === integration.id}
              className="h-8 w-8"
              title="Check connection status"
            >
              <RefreshCw 
                className={`h-4 w-4 ${refreshingId === integration.id ? 'animate-spin' : ''}`} 
              />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConfigureClick(integration.id, integration.name)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Configure
            </Button>
            
            <Switch
              checked={integration.enabled}
              onCheckedChange={() =>
                handleToggle(integration.id, integration.enabled, integration.connected, integration.name)
              }
            />
          </div>
        </div>
      ))}

      <div className="p-4 border border-dashed rounded-lg text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Need a custom integration?
        </p>
        <Button variant="outline" size="sm" onClick={() => setCustomFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Integration
        </Button>
      </div>

      {selectedIntegration && (
        <IntegrationSetupDialog
          open={setupDialogOpen}
          onOpenChange={setSetupDialogOpen}
          integrationId={selectedIntegration.id}
          integrationName={selectedIntegration.name}
          onSetupComplete={handleSetupComplete}
        />
      )}

      <CustomIntegrationForm
        open={customFormOpen}
        onOpenChange={setCustomFormOpen}
        onIntegrationAdded={() => {
          toast.success('Custom integration added');
          // Refresh integrations list if needed
        }}
      />
    </div>
  );
}
