/**
 * Integration Logic
 * 
 * Defines which features are controlled by which integrations.
 */

export const INTEGRATION_FEATURES: Record<string, string[]> = {
    mapbox: ['logistics', 'route-planning', 'driver-tracking', 'live-map'],
    stripe: ['subscriptions', 'payment-links', 'invoices', 'crm-invoices', 'invoice-management'],
    twilio: ['sms-notifications', '2fa', 'customer-alerts'],
    sendgrid: ['email-campaigns', 'email-notifications', 'marketing', 'marketing-automation'],
    custom: ['webhooks', 'custom-integrations'],
};

export function getHiddenFeaturesByIntegrations(enabledIntegrations: string[]): string[] {
    const hiddenFeatures: string[] = [];

    Object.entries(INTEGRATION_FEATURES).forEach(([integrationId, features]) => {
        if (!enabledIntegrations.includes(integrationId)) {
            hiddenFeatures.push(...features);
        }
    });

    return hiddenFeatures;
}
