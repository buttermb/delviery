import { logger } from '@/lib/logger';
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
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { SidebarSection as SidebarSectionType, SidebarItem } from '@/types/sidebar';
import type { FeatureId } from '@/lib/featureConfig';
import { useState, useEffect } from 'react';

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
  const { toggleCollapsedSection, preferences } = useSidebar();
  const { canAccess } = useFeatureAccess();
  const [isOpen, setIsOpen] = useState(!section.collapsed && (section.defaultExpanded || section.pinned));

  // Debug logging
  logger.debug(`SidebarSection [${section.section}]:`, {
    itemCount: section.items.length,
    isOpen,
    pinned: section.pinned,
    defaultExpanded: section.defaultExpanded,
    items: section.items.map(i => ({ id: i.id, name: i.name }))
  });

  // Sync with preferences
  useEffect(() => {
    // Guard: Ensure collapsedSections is an array
    const collapsedSections = Array.isArray(preferences?.collapsedSections) 
      ? preferences.collapsedSections 
      : [];
    
    const shouldBeCollapsed = collapsedSections.includes(section.section);
    if (section.pinned) {
      setIsOpen(true); // Pinned sections always open
    } else {
      setIsOpen(!shouldBeCollapsed);
    }
  }, [preferences?.collapsedSections, section.section, section.pinned]);

  const handleToggle = () => {
    if (section.pinned) return; // Don't allow collapsing pinned sections

    const newState = !isOpen;
    setIsOpen(newState);
    toggleCollapsedSection(section.section);
  };

  // Don't render if no items
  if (section.items.length === 0) {
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
          <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-accent/50 px-2 py-1.5 rounded-md">
            <span>{section.section}</span>
            {!section.pinned && (
              <div className="flex items-center">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item, index) => {
                const hasAccess = item.featureId ? canAccess(item.featureId) : true;
                
                logger.debug(`Rendering item [${item.id}] in [${section.section}]:`, {
                  hasAccess,
                  featureId: item.featureId,
                  name: item.name
                });
                
                return (
                  <SidebarMenuItem
                    key={`${section.section}-${item.id}-${index}`}
                    item={item}
                    isActive={isActive(item.path)}
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
    </SidebarGroup>
  );
}

