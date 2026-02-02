/**
 * Quick Actions Widget
 * 
 * One-click access to top features from the dashboard.
 * Features alert badges, responsive grid, and tier-based items.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Zap from "lucide-react/dist/esm/icons/zap";
import { cn } from '@/lib/utils';
import {
    QUICK_ACTION_ITEMS,
    type NavItem,
    type SubscriptionTier,
} from '@/lib/sidebar/optimizedSidebarConfig';

interface QuickActionsWidgetProps {
    userTier: SubscriptionTier;
    className?: string;
    /** Optional badges to show on specific items */
    badges?: Record<string, number | string>;
    /** Maximum items to show (default: 7) */
    maxItems?: number;
}

export function QuickActionsWidget({
    userTier,
    className,
    badges = {},
    maxItems = 7,
}: QuickActionsWidgetProps) {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const navigate = useNavigate();

    // Get quick actions for tier
    const actions = QUICK_ACTION_ITEMS[userTier].slice(0, maxItems);

    // Build full path with tenant slug
    const getFullPath = (path: string) => {
        if (!tenantSlug) return path;
        return path.replace('/admin/', `/${tenantSlug}/admin/`);
    };

    // Handle action click
    const handleClick = (item: NavItem) => {
        navigate(getFullPath(item.path));
    };

    return (
        <Card className={cn('overflow-hidden', className)}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Quick Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                    {actions.map((item) => {
                        const badgeValue = badges[item.id];
                        const Icon = item.icon;

                        return (
                            <Button
                                key={item.id}
                                variant="outline"
                                className={cn(
                                    'h-auto flex-col gap-2 py-4 px-3 relative',
                                    'hover:bg-accent hover:border-primary/20',
                                    'transition-all duration-200',
                                    item.hot && 'border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20'
                                )}
                                onClick={() => handleClick(item)}
                            >
                                {/* Badge */}
                                {badgeValue && (
                                    <Badge
                                        variant="destructive"
                                        className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-xs"
                                    >
                                        {badgeValue}
                                    </Badge>
                                )}

                                {/* Hot indicator */}
                                {item.hot && (
                                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                                )}

                                {/* Icon */}
                                <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                    'bg-primary/10 text-primary',
                                    item.hot && 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400'
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>

                                {/* Label */}
                                <span className="text-xs font-medium text-center line-clamp-2">
                                    {item.name}
                                </span>
                            </Button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

export default QuickActionsWidget;
