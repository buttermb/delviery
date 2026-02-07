/**
 * Sidebar Hot Items Component
 * 
 * Displays contextual quick actions based on business context
 */

import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from '@/components/ui/sidebar';
import { SidebarMenuItem } from './SidebarMenuItem';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useParams, useLocation } from 'react-router-dom';
import type { FeatureId } from '@/lib/featureConfig';

export function SidebarHotItems() {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const { hotItems } = useSidebarConfig();
  const { canAccess } = useFeatureAccess();

  // Guard: Ensure hotItems is an array
  const safeHotItems = Array.isArray(hotItems) ? hotItems : [];
  
  // Guard: Early return if no hot items
  if (safeHotItems.length === 0) {
    return null;
  }

  const isActive = (url: string) => {
    const fullPath = `/${tenantSlug}${url}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleItemClick = (itemId: string, featureId?: string) => {
    // Tracking is handled by SidebarMenuItem
  };

  const handleLockedItemClick = (featureId: FeatureId) => {
    // Upgrade modal is handled by parent AdaptiveSidebar
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-orange-600 dark:text-orange-400 px-3 py-2 min-h-[40px]">
        <span className="text-xs font-semibold uppercase tracking-wider">🔥 Quick Access</span>
      </SidebarGroupLabel>
      <SidebarGroupContent className="mt-1">
        <SidebarMenu>
          {safeHotItems.map((hot) => {
            const hasAccess = hot.featureId ? canAccess(hot.featureId) : true;
            return (
              <SidebarMenuItem
                key={hot.id}
                item={{
                  id: hot.id,
                  name: hot.name,
                  path: hot.path,
                  icon: hot.icon,
                  featureId: hot.featureId,
                  hot: true,
                  badge: hot.badge,
                }}
                isActive={isActive(hot.path)}
                hasAccess={hasAccess}
                onItemClick={handleItemClick}
                onLockedItemClick={handleLockedItemClick}
              />
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

