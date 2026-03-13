import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ToggleRight, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';

interface FeatureFlag {
  id: string;
  flag_name: string;
  enabled: boolean;
  updated_at: string;
}

const FEATURE_FLAGS = [
  {
    name: 'marketplace_enabled',
    label: 'Marketplace',
    description: 'Enable marketplace features for buying/selling',
  },
  {
    name: 'wholesale_enabled',
    label: 'Wholesale Orders',
    description: 'Enable wholesale ordering functionality',
  },
  {
    name: 'delivery_tracking',
    label: 'Delivery Tracking',
    description: 'Real-time delivery tracking and updates',
  },
  {
    name: 'customer_portal',
    label: 'Customer Portal',
    description: 'Self-service customer portal access',
  },
  {
    name: 'inventory_forecasting',
    label: 'Inventory Forecasting',
    description: 'AI-powered inventory predictions',
  },
  {
    name: 'advanced_analytics',
    label: 'Advanced Analytics',
    description: 'Detailed reports and insights',
  },
  {
    name: 'multi_location',
    label: 'Multi-Location',
    description: 'Manage multiple store locations',
  },
  {
    name: 'api_access',
    label: 'API Access',
    description: 'REST API for custom integrations',
  },
  {
    name: 'white_label',
    label: 'White Label',
    description: 'Custom branding and domain',
  },
  {
    name: 'loyalty_program',
    label: 'Loyalty Program',
    description: 'Customer rewards and points system',
  },
];

export function FeatureFlagManagement() {
  const { tenant } = useTenantAdminAuth();
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFeatureFlags();
  }, [tenant]);

  const loadFeatureFlags = async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      const flags: Record<string, boolean> = {};
      data?.forEach((flag: FeatureFlag) => {
        flags[flag.flag_name] = flag.enabled;
      });

      setFeatureFlags(flags);
    } catch (error) {
      logger.error('Error loading feature flags:', error);
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlag = async (flagName: string, enabled: boolean) => {
    if (!tenant?.id) return;

    // Optimistic update
    setFeatureFlags((prev) => ({ ...prev, [flagName]: enabled }));

    try {
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          tenant_id: tenant.id,
          flag_name: flagName,
          enabled,
        });

      if (error) throw error;

      toast.success(`${flagName} ${enabled ? 'enabled' : 'disabled'}`);
      logger.info('Feature flag updated', { tenantId: tenant.id, flagName, enabled });
    } catch (error) {
      // Rollback on error
      setFeatureFlags((prev) => ({ ...prev, [flagName]: !enabled }));
      logger.error('Error updating feature flag:', error);
      toast.error('Failed to update feature flag');
    }
  };

  const getFeatureStatus = (flagName: string) => {
    return featureFlags[flagName] ?? false;
  };

  const getFeatureBadge = (flagName: string) => {
    // Check if feature is available based on subscription plan
    const enterpriseFeatures = ['white_label', 'api_access', 'multi_location', 'advanced_analytics'];
    const professionalFeatures = ['delivery_tracking', 'inventory_forecasting', 'loyalty_program'];

    if (enterpriseFeatures.includes(flagName) && tenant?.subscription_plan !== 'enterprise') {
      return <Badge variant="outline">Enterprise Only</Badge>;
    }

    if (professionalFeatures.includes(flagName) && tenant?.subscription_plan === 'starter') {
      return <Badge variant="outline">Professional+</Badge>;
    }

    return null;
  };

  const isFeatureAvailable = (flagName: string) => {
    const enterpriseFeatures = ['white_label', 'api_access', 'multi_location', 'advanced_analytics'];
    const professionalFeatures = ['delivery_tracking', 'inventory_forecasting', 'loyalty_program'];

    if (enterpriseFeatures.includes(flagName) && tenant?.subscription_plan !== 'enterprise') {
      return false;
    }

    if (professionalFeatures.includes(flagName) && tenant?.subscription_plan === 'starter') {
      return false;
    }

    return true;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <ToggleRight className="h-5 w-5" />
        Feature Flag Management
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Enable or disable features for your organization. Some features require a higher subscription
        tier.
      </p>

      <div className="space-y-4">
        {FEATURE_FLAGS.map((feature) => {
          const isEnabled = getFeatureStatus(feature.name);
          const isAvailable = isFeatureAvailable(feature.name);
          const badge = getFeatureBadge(feature.name);

          return (
            <div
              key={feature.name}
              className={`border rounded-lg p-4 ${!isAvailable ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="font-medium">{feature.label}</Label>
                    {badge}
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggleFlag(feature.name, checked)}
                  disabled={!isAvailable}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t">
        <p className="text-xs text-muted-foreground">
          Current Plan: <strong className="capitalize">{tenant?.subscription_plan}</strong>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Upgrade your subscription to unlock more features.
        </p>
      </div>
    </Card>
  );
}
