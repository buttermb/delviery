/**
 * Sidebar Recently Used Component
 * 
 * Displays the 5 most recently accessed features
 */

import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from '@/components/ui/sidebar';
import { SidebarMenuItem } from './SidebarMenuItem';
import { useSidebar } from './SidebarContext';
import { matchesSearchQuery } from './SidebarSearch';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useParams, useLocation } from 'react-router-dom';
import type { FeatureId } from '@/lib/featureConfig';
import type { SidebarItem } from '@/types/sidebar';
import { isRouteActive } from '@/lib/sidebar/isRouteActive';
import { Clock } from 'lucide-react';
import { useCallback, useMemo } from 'react';

export function SidebarRecentlyUsed() {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const location = useLocation();
    const { preferences, trackFeatureClick: _trackFeatureClick, searchQuery } = useSidebar();
    const { sidebarConfig } = useSidebarConfig();
    const { canAccess } = useFeatureAccess();

    // Get last accessed features (limit to 5) - memoized to stabilize deps
    const lastAccessed = useMemo(
        () => preferences?.lastAccessedFeatures?.slice(0, 5) ?? [],
        [preferences?.lastAccessedFeatures]
    );

    // Find items in config
    const recentItems = useMemo(() => {
        if (!lastAccessed.length || !sidebarConfig.length) return [];

        const foundItems = [];
        const seenIds = new Set();

        // Create a map for faster lookup if needed, but simple traversal is fine for < 100 items
        for (const access of lastAccessed) {
            // Skip if we already have this item (deduplication)
            if (seenIds.has(access.id)) continue;

            let found = null;

            // Search through sections
            for (const section of sidebarConfig) {
                const item = section.items.find(i => i.featureId === access.id);
                if (item) {
                    found = item;
                    break;
                }

                // Check submenus if they exist
                if (!found) {
                    for (const i of section.items) {
                        if ('submenu' in i && i.submenu) {
                            const sub = i.submenu.find(s => s.featureId === access.id);
                            if (sub) {
                                found = { ...sub, id: sub.id || sub.path } as SidebarItem;
                                break;
                            }
                        }
                    }
                }
            }

            if (found) {
                foundItems.push(found);
                seenIds.add(access.id);
            }
        }

        return foundItems;
    }, [lastAccessed, sidebarConfig]);

    // Filter recent items based on search query
    const filteredRecentItems = useMemo(() => {
        if (!searchQuery.trim()) return recentItems;
        return recentItems.filter((item) => matchesSearchQuery(item.name, searchQuery));
    }, [recentItems, searchQuery]);

    const isActive = useCallback((url: string) => {
        if (!tenantSlug) return false;
        return isRouteActive(url, tenantSlug, location.pathname, location.search);
    }, [tenantSlug, location.pathname, location.search]);

    const handleItemClick = useCallback((_itemId: string, _featureId?: string) => {
        // Tracking is handled by SidebarMenuItem context call
    }, []);

    const handleLockedItemClick = useCallback((_featureId: FeatureId) => {
        // Upgrade modal is handled by parent AdaptiveSidebar
    }, []);

    if (filteredRecentItems.length === 0) return null;

    return (
        <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 flex items-center gap-2 px-3 py-2 min-h-[40px]">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Recently Used</span>
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
                <SidebarMenu>
                    {filteredRecentItems.map((item) => (
                        <SidebarMenuItem
                            key={`recent-${item.id}`}
                            item={item}
                            isActive={isActive(item.path)}
                            hasAccess={item.featureId ? canAccess(item.featureId) : true}
                            onItemClick={handleItemClick}
                            onLockedItemClick={handleLockedItemClick}
                        />
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
