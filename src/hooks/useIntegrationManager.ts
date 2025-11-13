/**
 * useIntegrationManager Hook
 * 
 * Manages enabled/disabled integrations
 */

import { useSidebarPreferences } from './useSidebarPreferences';
import { getAvailableIntegrations, getIntegration } from '@/lib/sidebar/integrations';

export function useIntegrationManager() {
  const { preferences, updatePreferences } = useSidebarPreferences();

  const enabledIntegrations = preferences?.enabledIntegrations || ['mapbox', 'stripe'];

  /**
   * Get all available integrations with their status
   */
  const getIntegrationsWithStatus = () => {
    return getAvailableIntegrations().map(integration => ({
      ...integration,
      enabled: enabledIntegrations.includes(integration.id),
    }));
  };

  /**
   * Check if an integration is enabled
   */
  const isIntegrationEnabled = (integrationId: string): boolean => {
    return enabledIntegrations.includes(integrationId);
  };

  /**
   * Enable an integration
   */
  const enableIntegration = async (integrationId: string) => {
    if (!enabledIntegrations.includes(integrationId)) {
      const updated = [...enabledIntegrations, integrationId];
      await updatePreferences({ enabledIntegrations: updated });
    }
  };

  /**
   * Disable an integration
   */
  const disableIntegration = async (integrationId: string) => {
    const updated = enabledIntegrations.filter(id => id !== integrationId);
    await updatePreferences({ enabledIntegrations: updated });
  };

  /**
   * Toggle an integration
   */
  const toggleIntegration = async (integrationId: string) => {
    if (enabledIntegrations.includes(integrationId)) {
      await disableIntegration(integrationId);
    } else {
      await enableIntegration(integrationId);
    }
  };

  /**
   * Get status of a specific integration
   */
  const getIntegrationStatus = (integrationId: string) => {
    const integration = getIntegration(integrationId);
    if (!integration) return 'unknown';
    
    return integration.connected ? 'connected' : 'disconnected';
  };

  return {
    enabledIntegrations,
    getIntegrationsWithStatus,
    isIntegrationEnabled,
    enableIntegration,
    disableIntegration,
    toggleIntegration,
    getIntegrationStatus,
  };
}
