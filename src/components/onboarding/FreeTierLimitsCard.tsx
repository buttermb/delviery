/**
 * FreeTierLimitsCard Component
 * 
 * Animated cards showing FREE tier daily/monthly limits with stagger effects.
 * Uses pulse animations on limit badges to draw attention.
 */

import { motion } from 'framer-motion';
import {
    Clock,
    CalendarDays,
    AlertCircle,
    FileText,
    ShoppingCart,
    MessageSquare,
    Mail,
    CreditCard,
    Package,
    Users,
    User,
    MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FREE_TIER_LIMITS } from '@/lib/credits';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

interface FreeTierLimitsCardProps {
    className?: string;
    showAnimation?: boolean;
}

interface LimitItem {
    icon: React.ReactNode;
    label: string;
    limit: number | string;
    suffix?: string;
    category: 'daily' | 'feature';
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1
        }
    }
};

const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring' as const,
            damping: 25,
            stiffness: 400
        }
    }
};

const badgePulse = {
    initial: { scale: 1 },
    animate: {
        scale: [1, 1.05, 1],
        transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut' as const
        }
    }
};

// ============================================================================
// Component
// ============================================================================

export function FreeTierLimitsCard({
    className,
    showAnimation = true,
}: FreeTierLimitsCardProps) {
    const dailyLimits: LimitItem[] = [
        {
            icon: <FileText className="h-4 w-4" />,
            label: 'Menus created',
            limit: FREE_TIER_LIMITS.max_menus_per_day,
            suffix: '/day',
            category: 'daily'
        },
        {
            icon: <ShoppingCart className="h-4 w-4" />,
            label: 'Manual orders',
            limit: FREE_TIER_LIMITS.max_orders_per_day,
            suffix: '/day',
            category: 'daily'
        },
        {
            icon: <MessageSquare className="h-4 w-4" />,
            label: 'SMS messages',
            limit: FREE_TIER_LIMITS.max_sms_per_day,
            suffix: '/day',
            category: 'daily'
        },
        {
            icon: <CreditCard className="h-4 w-4" />,
            label: 'POS sales',
            limit: FREE_TIER_LIMITS.max_pos_sales_per_day,
            suffix: '/day',
            category: 'daily'
        },
    ];

    const featureLimits: LimitItem[] = [
        {
            icon: <Package className="h-4 w-4" />,
            label: 'Products',
            limit: FREE_TIER_LIMITS.max_products,
            category: 'feature'
        },
        {
            icon: <Users className="h-4 w-4" />,
            label: 'Customers',
            limit: FREE_TIER_LIMITS.max_customers,
            category: 'feature'
        },
        {
            icon: <User className="h-4 w-4" />,
            label: 'Team members',
            limit: FREE_TIER_LIMITS.max_team_members,
            category: 'feature'
        },
        {
            icon: <MapPin className="h-4 w-4" />,
            label: 'Locations',
            limit: FREE_TIER_LIMITS.max_locations,
            category: 'feature'
        },
    ];

    const LimitRow = ({ item, index }: { item: LimitItem; index: number }) => (
        <motion.div
            variants={cardVariants}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-background shadow-sm group-hover:shadow transition-shadow">
                    {item.icon}
                </div>
                <span className="text-sm font-medium">{item.label}</span>
            </div>
            <motion.div
                variants={showAnimation ? badgePulse : undefined}
                initial="initial"
                animate="animate"
                style={{ animationDelay: `${index * 0.2}s` }}
            >
                <Badge
                    variant="outline"
                    className={cn(
                        'font-mono',
                        item.category === 'daily'
                            ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800'
                            : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                    )}
                >
                    {item.limit}{item.suffix || ''}
                </Badge>
            </motion.div>
        </motion.div>
    );

    return (
        <div className={cn('space-y-6', className)}>
            {/* Daily Limits Section */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
            >
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                        <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm">Daily Limits</h4>
                        <p className="text-xs text-muted-foreground">Reset at midnight</p>
                    </div>
                </div>

                <div className="grid gap-2">
                    {dailyLimits.map((item, index) => (
                        <LimitRow key={item.label} item={item} index={index} />
                    ))}
                </div>
            </motion.div>

            {/* Feature Limits Section */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
            >
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                        <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm">Account Limits</h4>
                        <p className="text-xs text-muted-foreground">Expand with upgrade</p>
                    </div>
                </div>

                <div className="grid gap-2">
                    {featureLimits.map((item, index) => (
                        <LimitRow key={item.label} item={item} index={index + dailyLimits.length} />
                    ))}
                </div>
            </motion.div>

            {/* Info callout */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
            >
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Limits help us keep the free tier sustainable
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                        Upgrade anytime for unlimited usage and premium features.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default FreeTierLimitsCard;
