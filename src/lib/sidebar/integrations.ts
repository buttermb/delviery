/**
 * Third-party integration definitions
 */

import { MapPin, CreditCard, MessageSquare, Mail, Zap } from 'lucide-react';
import type { IntegrationConfig } from '@/types/sidebar';

export const INTEGRATIONS: Record<string, IntegrationConfig> = {
  mapbox: {
    id: 'mapbox',
    name: 'Mapbox',
    description: 'Maps, geocoding, and route optimization',
    icon: MapPin,
    featuresEnabled: ['logistics', 'route-planning', 'driver-tracking', 'live-map'],
    setupUrl: '/admin/settings?tab=integrations&setup=mapbox',
    connected: true, // Check if VITE_MAPBOX_TOKEN exists
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and subscriptions',
    icon: CreditCard,
    featuresEnabled: ['billing', 'subscriptions', 'payment-links', 'invoices'],
    setupUrl: '/admin/settings?tab=integrations&setup=stripe',
    connected: false, // Check if Stripe is configured
  },
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS notifications and 2FA',
    icon: MessageSquare,
    featuresEnabled: ['sms-notifications', '2fa', 'customer-alerts'],
    setupUrl: '/admin/settings?tab=integrations&setup=twilio',
    connected: false,
  },
  sendgrid: {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Email campaigns and notifications',
    icon: Mail,
    featuresEnabled: ['email-campaigns', 'email-notifications', 'marketing'],
    setupUrl: '/admin/settings?tab=integrations&setup=sendgrid',
    connected: false,
  },
  custom: {
    id: 'custom',
    name: 'Custom API',
    description: 'Connect your own APIs and webhooks',
    icon: Zap,
    featuresEnabled: ['webhooks', 'custom-integrations'],
    setupUrl: '/admin/settings?tab=integrations&setup=custom',
    connected: false,
  },
};

/**
 * Get list of all available integrations
 */
export function getAvailableIntegrations(): IntegrationConfig[] {
  return Object.values(INTEGRATIONS);
}

/**
 * Get integration by ID
 */
export function getIntegration(id: string): IntegrationConfig | undefined {
  return INTEGRATIONS[id];
}

/**
 * Check if an integration is enabled
 */
export function isIntegrationEnabled(
  id: string,
  enabledIntegrations?: string[]
): boolean {
  if (!enabledIntegrations) return true; // All enabled by default
  return enabledIntegrations.includes(id);
}

/**
 * Get features that should be hidden based on disabled integrations
 */
export function getHiddenFeaturesByIntegrations(
  enabledIntegrations?: string[]
): string[] {
  if (!enabledIntegrations) return [];
  
  const hiddenFeatures: string[] = [];
  
  Object.values(INTEGRATIONS).forEach(integration => {
    if (!enabledIntegrations.includes(integration.id)) {
      hiddenFeatures.push(...integration.featuresEnabled);
    }
  });
  
  return hiddenFeatures;
}
