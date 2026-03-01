/**
 * Sidebar Menu Item Component
 * 
 * Individual menu item with tracking, favorites, and active state
 */

import { memo, useEffect, useRef } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { SidebarMenuButton, SidebarMenuItem as UISidebarMenuItem, useSidebar as useUiSidebar } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Lock, Star } from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { useLiveBadge } from './LiveBadgeContext';
import { LiveCountBadge } from './LiveCountBadge';
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch';
import type { SidebarItem } from '@/types/sidebar';
import type { FeatureId } from '@/lib/featureConfig';
import { cn } from '@/lib/utils';

interface SidebarMenuItemProps {
  item: SidebarItem;
  isActive: boolean;
  hasAccess: boolean;
  onItemClick: (itemId: string, featureId?: string) => void;
  onLockedItemClick: (featureId: FeatureId) => void;
}

export const SidebarMenuItem = memo(function SidebarMenuItem({
  item,
  isActive,
  hasAccess,
  onItemClick,
  onLockedItemClick,
}: SidebarMenuItemProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { favorites, toggleFavorite, trackFeatureClick } = useSidebar();
  const liveBadgeContext = useLiveBadge();
  const { prefetchRoute } = useRoutePrefetch();
  const itemRef = useRef<HTMLLIElement>(null);

  // Scroll into view when item becomes active
  // Using requestAnimationFrame to ensure DOM is ready after section expansion
  useEffect(() => {
    if (isActive && itemRef.current) {
      // Use requestAnimationFrame to wait for any layout changes (e.g., section expansion)
      const rafId = requestAnimationFrame(() => {
        // Additional small delay to allow collapsible animations to complete
        const timeoutId = setTimeout(() => {
          if (itemRef.current) {
            itemRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'nearest',
            });
          }
        }, 100);

        // Cleanup timeout on unmount
        return () => clearTimeout(timeoutId);
      });

      return () => cancelAnimationFrame(rafId);
    }
  }, [isActive]);

  // Guard: Ensure favorites is an array
  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  const isFavorite = safeFavorites.includes(item.id);

  // Use UI Sidebar context for mobile control
  // We need to aliasing import because of naming conflict
  const { setOpenMobile, isMobile } = useUiSidebar(); // Imported as useUiSidebar

  const handleClick = () => {
    if (item.featureId) {
      trackFeatureClick(item.featureId);
    }
    onItemClick(item.id, item.featureId);

    // Close mobile sheet if open
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(item.id);
  };

  const handleMouseEnter = () => {
    if (item.path) {
      prefetchRoute(`/${tenantSlug}${item.path}`);
    }
  };

  if (!hasAccess && item.featureId) {
    const IconComponent = item.icon;
    return (
      <UISidebarMenuItem ref={itemRef}>
        <SidebarMenuButton
          onClick={() => onLockedItemClick(item.featureId! as FeatureId)}
          className="cursor-pointer opacity-60 hover:opacity-100"
          tooltip={item.name}
        >
          {IconComponent && <IconComponent className="h-5 w-5 flex-shrink-0" />}
          <span className="flex-1 truncate text-sm">{item.name}</span>
          <Lock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </SidebarMenuButton>
      </UISidebarMenuItem>
    );
  }

  const IconComponent = item.icon;

  // Check for live badge data
  const liveBadge = liveBadgeContext?.getBadge(item.path) ?? null;

  return (
    <UISidebarMenuItem ref={itemRef}>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        onMouseEnter={handleMouseEnter}
        tooltip={item.name}
      >
        <NavLink
          to={`/${tenantSlug}${item.path}`}
          onClick={handleClick}
          className={cn(
            "flex items-center gap-3 w-full",
            item.hot && "font-semibold",
            isActive && "font-bold"
          )}
        >
          {IconComponent && <IconComponent className="h-5 w-5 flex-shrink-0" />}
          <span className="flex-1 truncate text-sm">{item.name}</span>

          {/* Priority: live count badge > static badge > hot > favorite */}
          {liveBadge ? (
            <LiveCountBadge
              count={liveBadge.count}
              level={liveBadge.level}
              pulse={liveBadge.pulse}
            />
          ) : item.badge ? (
            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs flex-shrink-0">
              {item.badge}
            </Badge>
          ) : item.hot ? (
            <span className="flex-shrink-0 text-orange-500 font-bold text-xs">HOT</span>
          ) : isFavorite ? (
            <Star
              className="h-4 w-4 flex-shrink-0 text-warning fill-warning"
              onClick={handleFavoriteClick}
            />
          ) : null}
        </NavLink>
      </SidebarMenuButton>
    </UISidebarMenuItem>
  );
});

