/**
 * Sidebar Section Component
 * 
 * Collapsible section with memory (stores collapsed state in preferences)
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from '@/components/ui/sidebar';
import { SidebarMenuItem } from './SidebarMenuItem';
import { useSidebar } from './SidebarContext';
import { matchesSearchQuery } from './SidebarSearch';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import type { SidebarSection as SidebarSectionType } from '@/types/sidebar';
import type { FeatureId } from '@/lib/featureConfig';
import type { FeatureToggleKey } from '@/lib/featureFlags';
import { resolveMostSpecificActive } from '@/lib/sidebar/isRouteActive';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SidebarSectionProps {
  section: SidebarSectionType;
  isActive: (url: string) => boolean;
  onItemClick: (itemId: string, featureId?: string) => void;
  onLockedItemClick: (featureId: FeatureId) => void;
}

export function SidebarSection({
  section,
  isActive,
  onItemClick,
  onLockedItemClick,
}: SidebarSectionProps) {
  const { toggleCollapsedSection, preferences, searchQuery } = useSidebar();
  const { canAccess } = useFeatureAccess();
  const { isEnabled: isFeatureFlagEnabled } = useTenantFeatureToggles();
  const [isOpen, setIsOpen] = useState(!section.collapsed && (section.defaultExpanded || section.pinned));

  // Filter items based on feature flags and search query
  const filteredItems = useMemo(() => {
    const flagFiltered = section.items.filter((item) => {
      if (!item.featureFlag) return true;
      return isFeatureFlagEnabled(item.featureFlag as FeatureToggleKey);
    });
    if (!searchQuery.trim()) return flagFiltered;
    return flagFiltered.filter((item) => matchesSearchQuery(item.name, searchQuery));
  }, [section.items, searchQuery, isFeatureFlagEnabled]);

  // Check if any item in this section is active
  const hasActiveItem = useMemo(() => {
    return section.items.some((item) => isActive(item.path));
  }, [section.items, isActive]);

  // Resolve active states: when multiple items match (e.g., "/admin/orders" and
  // "/admin/orders?tab=wholesale"), only highlight the most specific match
  const resolvedActiveStates = useMemo(() => {
    const rawStates = filteredItems.map((item) => isActive(item.path));
    return resolveMostSpecificActive(filteredItems, rawStates);
  }, [filteredItems, isActive]);

  // Auto-expand section when search matches items
  useEffect(() => {
    if (searchQuery.trim() && filteredItems.length > 0) {
      setIsOpen(true);
    }
  }, [searchQuery, filteredItems.length]);

  // Auto-expand section when it contains the active route
  useEffect(() => {
    if (hasActiveItem && !isOpen) {
      setIsOpen(true);
    }
  }, [hasActiveItem, isOpen]);

  // Sync with preferences
  useEffect(() => {
    // Guard: Ensure collapsedSections is an array
    const collapsedSections = Array.isArray(preferences?.collapsedSections)
      ? preferences.collapsedSections
      : [];

    const shouldBeCollapsed = collapsedSections.includes(section.section);
    if (section.pinned) {
      setIsOpen(true); // Pinned sections always open
    } else if (!hasActiveItem) {
      // Only apply collapsed preference if there's no active item
      setIsOpen(!shouldBeCollapsed);
    }
  }, [preferences?.collapsedSections, section.section, section.pinned, hasActiveItem]);

  const handleToggle = () => {
    if (section.pinned) return; // Don't allow collapsing pinned sections

    const newState = !isOpen;
    setIsOpen(newState);
    toggleCollapsedSection(section.section);
  };

  // Don't render if no items or no items match search
  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <Collapsible
        open={isOpen}
        onOpenChange={handleToggle}
        disabled={section.pinned}
      >
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={cn(
              "flex items-center justify-between cursor-pointer hover:bg-accent/50 px-3 py-2 rounded-md min-h-[40px] transition-all",
              isOpen && "border-l-2 border-primary/50"
            )}
          >
            <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground capitalize">{section.section}</span>
            {!section.pinned && (
              <div className="flex items-center">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {filteredItems.map((item, index) => {
                const hasAccess = item.featureId ? canAccess(item.featureId as FeatureId) : true;

                return (
                  <SidebarMenuItem
                    key={`${section.section}-${item.id}-${index}`}
                    item={item}
                    isActive={resolvedActiveStates[index]}
                    hasAccess={hasAccess}
                    onItemClick={onItemClick}
                    onLockedItemClick={onLockedItemClick}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup >
  );
}

