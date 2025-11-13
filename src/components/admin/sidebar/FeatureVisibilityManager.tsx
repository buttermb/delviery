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
import { ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function FeatureVisibilityManager() {
  const { sidebarConfig } = useSidebarConfig();
  const { isFeatureVisible, toggleFeature, showAll, hideAll, resetToDefault } = useFeatureVisibility();
  const { currentTier, canAccess } = useFeatureAccess();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Get all feature IDs
  const allFeatureIds = sidebarConfig.flatMap(section => 
    section.items.map(item => item.id)
  );

  const handleShowAll = async () => {
    await showAll();
    toast.success('All features shown');
  };

  const handleHideAll = async () => {
    await hideAll(allFeatureIds);
    toast.success('All non-essential features hidden');
  };

  const handleReset = async () => {
    await resetToDefault();
    toast.success('Reset to default visibility');
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(s => s !== sectionName)
        : [...prev, sectionName]
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
        {sidebarConfig.map((section) => {
          const isExpanded = expandedSections.includes(section.section);

          return (
            <Collapsible
              key={section.section}
              open={isExpanded}
              onOpenChange={() => toggleSection(section.section)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                  <span className="font-medium">{section.section}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isExpanded ? 'transform rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="p-4 pt-0 space-y-2">
                    {section.items.map((item) => {
                      const visible = isFeatureVisible(item.id);
                      const hasAccess = item.featureId ? canAccess(item.featureId as any) : true;
                      const isEssential = ['dashboard', 'settings', 'billing'].includes(item.id);

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            <Label
                              htmlFor={`feature-${item.id}`}
                              className="cursor-pointer flex-1"
                            >
                              {item.name}
                            </Label>
                            {!hasAccess && (
                              <Badge variant="secondary" className="text-xs">
                                Upgrade
                              </Badge>
                            )}
                            {isEssential && (
                              <Badge variant="outline" className="text-xs">
                                Essential
                              </Badge>
                            )}
                          </div>
                          <Switch
                            id={`feature-${item.id}`}
                            checked={visible}
                            onCheckedChange={() => toggleFeature(item.id)}
                            disabled={isEssential}
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
        Note: Essential features like Dashboard and Settings cannot be hidden.
      </p>
    </div>
  );
}
