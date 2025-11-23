// @ts-nocheck
import { logger } from '@/lib/logger';
/**
 * Third-party integration definitions
 */

import { MapPin, CreditCard, MessageSquare, Mail, Zap } from 'lucide-react';
import type { IntegrationConfig } from '@/types/sidebar';

/**
 * Check if an integration is actually connected (has valid API keys/config)
 */
export async function checkIntegrationConnection(integrationId: string): Promise<boolean> {
  switch (integrationId) {
    case 'mapbox':
      // Check if Mapbox token exists in environment or account settings
      if (import.meta.env.VITE_MAPBOX_TOKEN) return true;
      
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        
        const { data: tenantUser } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();
        
        if (!tenantUser) return false;
        
        // Get account.id from accounts table first
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('tenant_id', tenantUser.tenant_id)
          .single();
        
        if (!account) return false;
        
        // Now query account_settings using the correct account.id
        const { data: settings } = await supabase
          .from('account_settings')
          .select('integration_settings')
          .eq('account_id', account.id)
          .single();
        
        const integrationSettings = settings?.integration_settings as Record<string, any> | null;
        return !!(integrationSettings && typeof integrationSettings === 'object' && integrationSettings.mapbox_token);
      } catch (error) {
        logger.error('Mapbox connection check error', error, { component: 'integrations' });
        return false;
      }
    
    case 'stripe':
      // Check if Stripe secret exists (would need to call edge function)
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('check-stripe-config');
        if (error) {
          logger.debug('Stripe connection check failed', { error, component: 'integrations' });
        }
        return !error && data?.configured === true;
      } catch (error) {
        logger.error('Stripe connection check error', error, { component: 'integrations' });
        return false;
      }
    
    case 'twilio':
      // Check if Twilio is configured
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('check-twilio-config');
        if (error) {
          logger.debug('Twilio connection check failed', { error, component: 'integrations' });
        }
        return !error && data?.configured === true;
      } catch (error) {
        logger.error('Twilio connection check error', error, { component: 'integrations' });
        return false;
      }
    
    case 'sendgrid':
      // Check if SendGrid is configured
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('check-sendgrid-config');
        if (error) {
          logger.debug('SendGrid connection check failed', { error, component: 'integrations' });
        }
        return !error && data?.configured === true;
      } catch (error) {
        logger.error('SendGrid connection check error', error, { component: 'integrations' });
        return false;
      }
    
    case 'custom':
      // Custom integrations are checked via database
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.from('custom_integrations').select('id').limit(1).maybeSingle();
        if (error) {
          logger.debug('Custom integrations table check failed', { error, component: 'integrations' });
        }
        return !!data;
      } catch (error) {
        logger.error('Custom integrations check error', error, { component: 'integrations' });
        return false;
      }
    
    default:
      return false;
  }
}

export const INTEGRATIONS: Record<string, IntegrationConfig> = {
  mapbox: {
    id: 'mapbox',
    name: 'Mapbox',
    description: 'Maps, geocoding, and route optimization',
    icon: MapPin,
    featuresEnabled: ['logistics', 'route-planning', 'driver-tracking', 'live-map'],
    setupUrl: '/admin/settings?tab=integrations&setup=mapbox',
    connected: !!import.meta.env.VITE_MAPBOX_TOKEN,
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept customer payments (separate from your platform billing)',
    icon: CreditCard,
    featuresEnabled: ['subscriptions', 'payment-links', 'invoices'],
    setupUrl: '/admin/settings?tab=integrations&setup=stripe',
    connected: false, // Will be checked dynamically
  },
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS notifications and 2FA',
    icon: MessageSquare,
    featuresEnabled: ['sms-notifications', '2fa', 'customer-alerts'],
    setupUrl: '/admin/settings?tab=integrations&setup=twilio',
    connected: false, // Will be checked dynamically
  },
  sendgrid: {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Email campaigns and notifications',
    icon: Mail,
    featuresEnabled: ['email-campaigns', 'email-notifications', 'marketing'],
    setupUrl: '/admin/settings?tab=integrations&setup=sendgrid',
    connected: false, // Will be checked dynamically
  },
  custom: {
    id: 'custom',
    name: 'Custom API',
    description: 'Connect your own APIs and webhooks',
    icon: Zap,
    featuresEnabled: ['webhooks', 'custom-integrations'],
    setupUrl: '/admin/settings?tab=integrations&setup=custom',
    connected: false, // Will be checked dynamically
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
