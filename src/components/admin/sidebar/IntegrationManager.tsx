/**
 * Integration Manager Component
 * 
 * UI for enabling/disabling third-party integrations
 */

import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIntegrationManager } from '@/hooks/useIntegrationManager';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function IntegrationManager() {
  const { getIntegrationsWithStatus, toggleIntegration } = useIntegrationManager();
  const navigate = useNavigate();

  const integrations = getIntegrationsWithStatus();

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
              <h4 className="font-medium">{integration.name}</h4>
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

          <div className="flex items-center gap-3">
            <Badge
              variant={integration.connected ? 'default' : 'secondary'}
              className="hidden sm:inline-flex"
            >
              {integration.connected ? 'Connected' : 'Not Setup'}
            </Badge>
            <Switch
              checked={integration.enabled}
              onCheckedChange={() => handleToggle(integration.id, integration.enabled)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(integration.setupUrl)}
              className="hidden sm:inline-flex"
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
