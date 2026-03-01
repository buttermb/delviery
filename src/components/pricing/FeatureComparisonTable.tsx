import { Card } from "@/components/ui/card";
import { CheckCircle, X } from "lucide-react";
import { FEATURES, TIER_NAMES, type SubscriptionTier } from "@/lib/featureConfig";
import { Badge } from "@/components/ui/badge";

const tiers: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];

export function FeatureComparisonTable() {
  // Group features by category
  const featuresByCategory = (Object.values(FEATURES) as (typeof FEATURES[keyof typeof FEATURES])[]).reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, (typeof FEATURES[keyof typeof FEATURES])[]>);

  // Sort categories for logical presentation
  const categoryOrder = [
    'Core',
    'Inventory',
    'Customers',
    'Orders',
    'Sales',
    'Operations',
    'Analytics',
    'Financial',
    'Delivery',
    'Team',
    'Marketing',
    'Compliance',
    'Support',
    'Communication',
    'Integrations',
    'Security',
    'Automation',
    'AI',
    'Branding',
    'Data',
    'Settings',
  ];

  const sortedCategories = categoryOrder.filter(cat => featuresByCategory[cat]);

  const hasFeatureAccess = (tier: SubscriptionTier, featureTier: SubscriptionTier): boolean => {
    const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
    const tierIndex = tierHierarchy.indexOf(tier);
    const featureTierIndex = tierHierarchy.indexOf(featureTier);
    return tierIndex >= featureTierIndex;
  };

  return (
    <div className="w-full overflow-x-auto">
      <Card className="min-w-[800px]">
        {/* Table Header */}
        <div className="grid grid-cols-4 border-b bg-muted/50 sticky top-0 z-10 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
          <div className="p-4 font-semibold text-[hsl(var(--marketing-text))] dark:text-gray-100">
            Feature
          </div>
          {tiers.map((tier) => (
            <div key={tier} className="p-4 text-center border-l dark:border-gray-700">
              <div className="font-bold text-lg text-[hsl(var(--marketing-text))] mb-1 dark:text-gray-100">
                {TIER_NAMES[tier]}
              </div>
              <Badge variant="outline" className="text-xs">
                {tier === 'starter' && '28 features'}
                {tier === 'professional' && '55 features'}
                {tier === 'enterprise' && '87 features'}
              </Badge>
            </div>
          ))}
        </div>

        {/* Feature Rows by Category */}
        {sortedCategories.map((category) => (
          <div key={category}>
            {/* Category Header */}
            <div className="bg-[hsl(var(--marketing-bg-subtle))] border-b dark:bg-gray-700 dark:border-gray-600">
              <div className="p-3 font-semibold text-sm text-[hsl(var(--marketing-primary))] dark:text-gray-100">
                {category}
              </div>
            </div>

            {/* Features in Category */}
            {featuresByCategory[category]
              .sort((a, b) => {
                // Sort by tier hierarchy first
                const tierOrder = ['starter', 'professional', 'enterprise'];
                const tierCompare = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
                if (tierCompare !== 0) return tierCompare;
                // Then alphabetically
                return a.name.localeCompare(b.name);
              })
              .map((feature, idx) => (
                <div
                  key={feature.id}
                  className={`grid grid-cols-4 border-b hover:bg-muted/30 transition-colors dark:border-gray-700 ${idx % 2 === 0 ? 'bg-background dark:bg-gray-800' : 'bg-muted/10 dark:bg-gray-750'
                    }`}
                >
                  <div className="p-3">
                    <div className="font-medium text-sm text-[hsl(var(--marketing-text))] dark:text-gray-100">
                      {feature.name}
                    </div>
                    <div className="text-xs text-[hsl(var(--marketing-text-light))] mt-1 dark:text-gray-300">
                      {feature.description}
                    </div>
                  </div>

                  {tiers.map((tier) => (
                    <div
                      key={tier}
                      className="p-3 border-l flex items-center justify-center dark:border-gray-700"
                    >
                      {hasFeatureAccess(tier, feature.tier) ? (
                        <CheckCircle className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground/30" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        ))}

        {/* Summary Row */}
        <div className="grid grid-cols-4 bg-muted/50 border-t-2 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600">
          <div className="p-4 font-bold text-[hsl(var(--marketing-text))] dark:text-gray-100">
            Total Features
          </div>
          {tiers.map((tier) => (
            <div key={tier} className="p-4 text-center border-l font-bold text-lg text-[hsl(var(--marketing-primary))] dark:border-gray-700 dark:text-gray-100">
              {tier === 'starter' && '28'}
              {tier === 'professional' && '55'}
              {tier === 'enterprise' && '87'}
            </div>
          ))}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-sm text-[hsl(var(--marketing-text-light))]">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
          <span>Included</span>
        </div>
        <div className="flex items-center gap-2">
          <X className="h-4 w-4 text-muted-foreground/30" />
          <span>Not included</span>
        </div>
      </div>
    </div>
  );
}
