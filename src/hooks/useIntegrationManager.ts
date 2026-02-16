/**
 * useIntegrationManager Hook
 * 
 * Manages enabled/disabled integrations with real-time connection status
 */

import { useSidebarPreferences } from './useSidebarPreferences';
import { getAvailableIntegrations, checkIntegrationConnection } from '@/lib/sidebar/integrations';
import { useState, useEffect } from 'react';

export function useIntegrationManager() {
  const { preferences, updatePreferences } = useSidebarPreferences();
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, boolean>>({});

  const enabledIntegrations = preferences?.enabledIntegrations || ['mapbox', 'stripe'];

  // Check connection status for all integrations on mount
  useEffect(() => {
    const checkAllConnections = async () => {
      const integrations = getAvailableIntegrations();
      const statuses: Record<string, boolean> = {};
      
      await Promise.all(
        integrations.map(async (integration) => {
          statuses[integration.id] = await checkIntegrationConnection(integration.id);
        })
      );
      
      setConnectionStatuses(statuses);
    };

    checkAllConnections();
  }, []);

  /**
   * Get all available integrations with their status
   */
  const getIntegrationsWithStatus = () => {
    return getAvailableIntegrations().map(integration => ({
      ...integration,
      enabled: enabledIntegrations.includes(integration.id),
      connected: connectionStatuses[integration.id] ?? integration.connected,
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
    const isConnected = connectionStatuses[integrationId];
    return isConnected ? 'connected' : 'disconnected';
  };

  /**
   * Refresh connection status for a specific integration
   */
  const refreshConnectionStatus = async (integrationId: string) => {
    const isConnected = await checkIntegrationConnection(integrationId);
    setConnectionStatuses(prev => ({
      ...prev,
      [integrationId]: isConnected,
    }));
    return isConnected;
  };

  return {
    enabledIntegrations,
    getIntegrationsWithStatus,
    isIntegrationEnabled,
    enableIntegration,
    disableIntegration,
    toggleIntegration,
    getIntegrationStatus,
    refreshConnectionStatus,
    connectionStatuses,
  };
}
