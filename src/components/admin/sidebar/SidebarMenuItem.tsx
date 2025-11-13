/**
 * Sidebar Menu Item Component
 * 
 * Individual menu item with tracking, favorites, and active state
 */

import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { SidebarMenuButton, SidebarMenuItem as UISidebarMenuItem } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Lock, Star } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useSidebar } from './SidebarContext';
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
  const { tenantSlug } = useParams();
  const { favorites, toggleFavorite, trackFeatureClick } = useSidebar();
  const { prefetchRoute } = useRoutePrefetch();
  const isFavorite = favorites.includes(item.id);

  const handleClick = () => {
    if (item.featureId) {
      trackFeatureClick(item.featureId);
    }
    onItemClick(item.id, item.featureId);
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
    return (
      <UISidebarMenuItem>
        <SidebarMenuButton
          onClick={() => onLockedItemClick(item.featureId!)}
          className="cursor-pointer opacity-60 hover:opacity-100"
        >
          <item.icon className="h-4 w-4" />
          <span>{item.name}</span>
          <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
          {item.badge && (
            <Badge variant="secondary" className="ml-auto">
              {item.badge}
            </Badge>
          )}
        </SidebarMenuButton>
      </UISidebarMenuItem>
    );
  }

  return (
    <UISidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        onMouseEnter={handleMouseEnter}
      >
        <NavLink
          to={`/${tenantSlug}${item.path}`}
          onClick={handleClick}
          className={cn(
            "flex items-center gap-2 w-full",
            item.hot && "font-semibold"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.name}</span>
          
          {/* Favorite star */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            className={cn(
              "ml-auto p-1 rounded hover:bg-accent transition-colors",
              isFavorite && "text-yellow-500"
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              className={cn(
                "h-3 w-3",
                isFavorite ? "fill-current" : "fill-none"
              )}
            />
          </button>

          {/* Badge */}
          {item.badge && (
            <Badge variant="secondary" className="ml-auto">
              {item.badge}
            </Badge>
          )}

          {/* Hot indicator */}
          {item.hot && (
            <span className="ml-1 text-xs text-orange-500">🔥</span>
          )}

          {/* Shortcut */}
          {item.shortcut && (
            <kbd className="ml-auto hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              {item.shortcut}
            </kbd>
          )}
        </NavLink>
      </SidebarMenuButton>
    </UISidebarMenuItem>
  );
});

