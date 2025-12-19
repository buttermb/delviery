/**
 * Feature Visibility Manager Component
 * 
 * UI for showing/hiding sidebar features
 */

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { FeatureId } from '@/lib/featureConfig';
import { getAllFeatures, ESSENTIAL_FEATURES } from '@/lib/sidebar/featureRegistry';
import { ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function FeatureVisibilityManager() {
  const { sidebarConfig, operationSize, businessTier } = useSidebarConfig();
  const { isFeatureVisible, toggleFeature, showAll, hideAll, resetToDefault } = useFeatureVisibility();
  const { canAccess } = useFeatureAccess();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Get all features from registry
  const allFeatures = getAllFeatures();

  // Filter features by operation size
  const operationSizes = ['street', 'small', 'medium', 'enterprise'];
  const currentSizeIndex = operationSizes.indexOf(operationSize || 'medium');

  const availableFeatures = allFeatures.filter(f => {
    const minSize = f.minOperationSize || 'street';
    const minSizeIndex = operationSizes.indexOf(minSize);
    return minSizeIndex <= currentSizeIndex;
  });

  // Group by category
  const groupedFeatures = availableFeatures.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, typeof allFeatures>);

  // Business tier ranking
  const tiers = ['street', 'trap', 'block', 'hood', 'empire'];
  const currentTierIndex = tiers.indexOf(businessTier || 'street');

  const handleShowAll = async () => {
    await showAll();
    toast.success('All features shown');
  };

  const handleHideAll = async () => {
    const idsToHide = availableFeatures.map(f => f.id);
    await hideAll(idsToHide);
    toast.success('All non-essential features hidden');
  };

  const handleReset = async () => {
    await resetToDefault();
    toast.success('Reset to default visibility');
  };

  const toggleSection = (category: string) => {
    setExpandedSections(prev =>
      prev.includes(category)
        ? prev.filter(s => s !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleShowAll} variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Show All
        </Button>
        <Button onClick={handleHideAll} variant="outline" size="sm">
          <EyeOff className="h-4 w-4 mr-2" />
          Hide All
        </Button>
        <Button onClick={handleReset} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      <div className="space-y-2">
        {Object.entries(groupedFeatures).map(([category, features]) => {
          const isExpanded = expandedSections.includes(category);

          return (
            <Collapsible
              key={category}
              open={isExpanded}
              onOpenChange={() => toggleSection(category)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                  <span className="font-medium">{category}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'transform rotate-180' : ''
                      }`}
                  />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="p-4 pt-0 space-y-2">
                    {features.map((feature) => {
                      const visible = isFeatureVisible(feature.id);
                      const featureTier = feature.minBusinessTier || feature.minTier || 'street';
                      const minTierIndex = tiers.indexOf(featureTier);
                      const isLocked = minTierIndex > currentTierIndex;
                      const isEssential = ESSENTIAL_FEATURES.includes(feature.id);

                      return (
                        <div
                          key={feature.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <feature.icon className="h-4 w-4 text-muted-foreground" />
                            <Label
                              htmlFor={`feature-${feature.id}`}
                              className="cursor-pointer flex-1"
                            >
                              {feature.name}
                            </Label>
                            {isLocked && (
                              <Badge variant="secondary" className="text-xs">
                                {featureTier} tier
                              </Badge>
                            )}
                            {isEssential && (
                              <Badge variant="outline" className="text-xs">
                                Essential
                              </Badge>
                            )}
                          </div>
                          <Switch
                            id={`feature-${feature.id}`}
                            checked={visible && !isLocked}
                            onCheckedChange={() => toggleFeature(feature.id)}
                            disabled={isEssential || isLocked}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Note: Essential features cannot be hidden. Locked features require a higher business tier.
      </p>
    </div>
  );
}
