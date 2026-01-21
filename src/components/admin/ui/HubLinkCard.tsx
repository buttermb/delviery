/**
 * Hub Link Card Component
 * Clickable card for hub pages that links to related functionality
 * with optional count/status indicators
 */

import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface HubLinkCardProps {
    title: string;
    description: string;
    icon: LucideIcon;
    href: string;
    count?: number;
    countLabel?: string;
    status?: 'active' | 'pending' | 'warning' | 'info';
    isExternal?: boolean;
    isLoading?: boolean;
}

const statusColors = {
    active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    pending: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
    warning: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
};

const iconColors = {
    active: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    pending: 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
    warning: 'text-red-600 dark:text-red-400 bg-red-500/10',
    info: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
};

export function HubLinkCard({
    title,
    description,
    icon: Icon,
    href,
    count,
    countLabel,
    status = 'info',
    isExternal = false,
    isLoading = false,
}: HubLinkCardProps) {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();

    // Build the full path with tenant slug
    const fullPath = href.startsWith('/')
        ? `/${tenantSlug}/admin${href}`
        : `/${tenantSlug}/admin/${href}`;

    const cardContent = (
        <Card
            className={cn(
                'group relative p-4 border hover:shadow-md transition-all duration-200',
                'hover:border-primary/50 cursor-pointer',
                'flex flex-col gap-3'
            )}
        >
            <div className="flex items-start justify-between">
                <div className={cn('p-2 rounded-lg', iconColors[status])}>
                    <Icon className="h-5 w-5" />
                </div>
                {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                ) : count !== undefined && count > 0 ? (
                    <Badge
                        variant="outline"
                        className={cn('font-medium', statusColors[status])}
                    >
                        {count} {countLabel || ''}
                    </Badge>
                ) : null}
            </div>

            <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                    {title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {description}
                </p>
            </div>

            <div className="flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
                <span>View</span>
                <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
        </Card>
    );

    if (isExternal) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer">
                {cardContent}
            </a>
        );
    }

    return <Link to={fullPath}>{cardContent}</Link>;
}

interface HubLinkGridProps {
    children: React.ReactNode;
    className?: string;
}

export function HubLinkGrid({ children, className }: HubLinkGridProps) {
    return (
        <div className={cn(
            'grid gap-4',
            'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
            className
        )}>
            {children}
        </div>
    );
}
