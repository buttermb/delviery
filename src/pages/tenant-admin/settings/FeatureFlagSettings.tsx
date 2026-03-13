import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Switch } from '@/components/ui/switch';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface FeatureFlags {
  delivery_tracking: boolean;
  loyalty_program: boolean;
  age_verification: boolean;
  product_reviews: boolean;
  live_inventory: boolean;
  multi_currency: boolean;
  advanced_analytics: boolean;
  ai_recommendations: boolean;
  sms_notifications: boolean;
  email_marketing: boolean;
  subscription_orders: boolean;
  gift_cards: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  delivery_tracking: true,
  loyalty_program: false,
  age_verification: true,
  product_reviews: false,
  live_inventory: true,
  multi_currency: false,
  advanced_analytics: false,
  ai_recommendations: false,
  sms_notifications: false,
  email_marketing: false,
  subscription_orders: false,
  gift_cards: false,
};

const FEATURE_DEFINITIONS = [
  {
    key: 'delivery_tracking' as keyof FeatureFlags,
    label: 'Delivery Tracking',
    description: 'Real-time delivery status and driver location',
    category: 'Operations',
  },
  {
    key: 'loyalty_program' as keyof FeatureFlags,
    label: 'Loyalty Program',
    description: 'Points and rewards for repeat customers',
    category: 'Marketing',
  },
  {
    key: 'age_verification' as keyof FeatureFlags,
    label: 'Age Verification',
    description: 'Require ID verification for age-restricted products',
    category: 'Compliance',
  },
  {
    key: 'product_reviews' as keyof FeatureFlags,
    label: 'Product Reviews',
    description: 'Allow customers to review and rate products',
    category: 'Storefront',
  },
  {
    key: 'live_inventory' as keyof FeatureFlags,
    label: 'Live Inventory',
    description: 'Show real-time stock levels on storefront',
    category: 'Inventory',
  },
  {
    key: 'multi_currency' as keyof FeatureFlags,
    label: 'Multi-Currency',
    description: 'Support multiple currencies and exchange rates',
    category: 'Payments',
  },
  {
    key: 'advanced_analytics' as keyof FeatureFlags,
    label: 'Advanced Analytics',
    description: 'Detailed reports and business intelligence',
    category: 'Analytics',
  },
  {
    key: 'ai_recommendations' as keyof FeatureFlags,
    label: 'AI Recommendations',
    description: 'Personalized product suggestions using AI',
    category: 'Storefront',
  },
  {
    key: 'sms_notifications' as keyof FeatureFlags,
    label: 'SMS Notifications',
    description: 'Send order updates via SMS',
    category: 'Communications',
  },
  {
    key: 'email_marketing' as keyof FeatureFlags,
    label: 'Email Marketing',
    description: 'Send promotional emails and newsletters',
    category: 'Marketing',
  },
  {
    key: 'subscription_orders' as keyof FeatureFlags,
    label: 'Subscription Orders',
    description: 'Recurring orders with auto-billing',
    category: 'Operations',
  },
  {
    key: 'gift_cards' as keyof FeatureFlags,
    label: 'Gift Cards',
    description: 'Sell and redeem digital gift cards',
    category: 'Payments',
  },
];

export default function FeatureFlagSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'feature_flags'),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (error) throw error;

      const record = data as Record<string, unknown> | null;
      if (record?.metadata) {
        const metadata = record.metadata as Record<string, unknown>;
        const featureFlags = metadata.feature_flags as FeatureFlags | undefined;
        if (featureFlags) {
          setFlags({ ...DEFAULT_FLAGS, ...featureFlags });
        }
      }

      return data;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (newFlags: FeatureFlags) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data: currentData, error: fetchError } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentMetadata = (currentData?.metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('tenants')
        .update({
          metadata: {
            ...currentMetadata,
            feature_flags: newFlags,
          } as Record<string, unknown>,
        })
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'feature_flags') });
      toast.success('Feature flags updated');
    },
    onError: (error) => {
      logger.error('Failed to save feature flags', { error });
      toast.error(humanizeError(error));
    },
  });

  const handleToggle = (key: keyof FeatureFlags) => {
    const newFlags = { ...flags, [key]: !flags[key] };
    setFlags(newFlags);
    saveMutation.mutate(newFlags);
  };

  const groupedFeatures = FEATURE_DEFINITIONS.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, typeof FEATURE_DEFINITIONS>);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
        <p className="text-muted-foreground mt-1">
          Enable or disable features across your application
        </p>
      </div>

      {Object.entries(groupedFeatures).map(([category, features]) => (
        <SettingsSection
          key={category}
          title={category}
          description={`${category}-related features`}
          icon={Flag}
        >
          <SettingsCard>
            {features.map((feature) => (
              <SettingsRow
                key={feature.key}
                label={feature.label}
                description={feature.description}
                action={
                  <Switch
                    checked={flags[feature.key]}
                    onCheckedChange={() => handleToggle(feature.key)}
                  />
                }
              />
            ))}
          </SettingsCard>
        </SettingsSection>
      ))}

      <SaveStatusIndicator
        status={saveMutation.isPending ? 'saving' : 'saved'}
      />
    </div>
  );
}
