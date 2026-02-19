/**
 * TeamActivityFeed
 * Displays recent actions performed by team members.
 * Shows activity timeline with team member info, action details, and timestamps.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Users from "lucide-react/dist/esm/icons/users";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Package from "lucide-react/dist/esm/icons/package";
import Settings from "lucide-react/dist/esm/icons/settings";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Truck from "lucide-react/dist/esm/icons/truck";
import Activity from "lucide-react/dist/esm/icons/activity";
import User from "lucide-react/dist/esm/icons/user";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Filter from "lucide-react/dist/esm/icons/filter";
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { useTeamActivity, type TeamActivityEntry } from '@/hooks/useTeamActivity';

interface TeamActivityFeedProps {
  limit?: number;
  maxHeight?: string;
  showFilters?: boolean;
  showHeader?: boolean;
  className?: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  order: { icon: ShoppingCart, label: 'Order', color: 'text-blue-500' },
  inventory: { icon: Package, label: 'Inventory', color: 'text-amber-500' },
  user: { icon: User, label: 'User', color: 'text-violet-500' },
  system: { icon: Activity, label: 'System', color: 'text-gray-500' },
  payment: { icon: CreditCard, label: 'Payment', color: 'text-emerald-500' },
  settings: { icon: Settings, label: 'Settings', color: 'text-slate-500' },
  crm: { icon: Users, label: 'CRM', color: 'text-indigo-500' },
  delivery: { icon: Truck, label: 'Delivery', color: 'text-orange-500' },
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.system;
}

function getInitials(firstName: string | null, lastName: string | null, email: string | null): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'TM';
}

function getFullName(firstName: string | null, lastName: string | null, email: string | null): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  return email || 'Team Member';
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'owner':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'admin':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'member':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'viewer':
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
}

export function TeamActivityFeed({
  limit = 20,
  maxHeight = '500px',
  showFilters = true,
  showHeader = true,
  className = '',
}: TeamActivityFeedProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { activities, isLoading, error, refetch } = useTeamActivity({
    limit,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
  });

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, TeamActivityEntry[]> = {};

    for (const activity of activities) {
      const dateKey = new Date(activity.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    }

    return groups;
  }, [activities]);

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Team Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Failed to load activity</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Team Activity
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Live
              </Badge>
              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={handleRefresh} aria-label="Refresh activity feed">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="pt-0">
        {showFilters && (
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="user">Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium">No team activity yet</p>
            <p className="text-xs mt-1">Actions by team members will appear here.</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-6 pr-4">
              {Object.entries(groupedActivities).map(([dateKey, dateActivities]) => (
                <div key={dateKey}>
                  <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-1 mb-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {dateKey}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {dateActivities.map((activity) => {
                      const categoryConfig = getCategoryConfig(activity.category);
                      const CategoryIcon = categoryConfig.icon;
                      const member = activity.team_member;
                      const fullName = getFullName(
                        member?.first_name ?? null,
                        member?.last_name ?? null,
                        activity.user_email
                      );
                      const initials = getInitials(
                        member?.first_name ?? null,
                        member?.last_name ?? null,
                        activity.user_email
                      );

                      return (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          {/* Team member avatar */}
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarImage src={member?.avatar_url ?? undefined} alt={fullName} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>

                          {/* Activity content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{fullName}</span>
                              {member?.role && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs px-1.5 py-0 ${getRoleBadgeColor(member.role)}`}
                                >
                                  {member.role}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <CategoryIcon className={`h-3.5 w-3.5 ${categoryConfig.color}`} />
                              <span className="text-sm">{activity.action}</span>
                            </div>

                            {activity.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {activity.description}
                              </p>
                            )}

                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {categoryConfig.label}
                              </Badge>
                              {activity.resource && (
                                <span className="text-muted-foreground/70">
                                  {activity.resource}
                                  {activity.resource_id ? ` #${activity.resource_id.slice(0, 8)}` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Timestamp */}
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatRelativeTime(activity.created_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export type { TeamActivityFeedProps };
