/**
 * Tenant Smart Filters
 * Quick filter chips for common tenant states
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Clock from "lucide-react/dist/esm/icons/clock";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import X from "lucide-react/dist/esm/icons/x";

export type FilterType = 'all' | 'needs_attention' | 'onboarding' | 'trial_ending' | 'past_due' | 'high_value';

interface TenantFiltersProps {
    activeFilter: FilterType;
    onFilterChange: (filter: FilterType) => void;
    counts?: Record<FilterType, number>;
}

export function TenantFilters({ activeFilter, onFilterChange, counts }: TenantFiltersProps) {
    const filters = [
        {
            id: 'all',
            label: 'All Tenants',
            icon: null,
            color: 'default'
        },
        {
            id: 'needs_attention',
            label: 'Needs Attention',
            icon: AlertTriangle,
            color: 'destructive'
        },
        {
            id: 'onboarding',
            label: 'Onboarding',
            icon: Sparkles,
            color: 'blue' // Custom class needed or use variant
        },
        {
            id: 'trial_ending',
            label: 'Trial Ending',
            icon: Clock,
            color: 'orange'
        },
        {
            id: 'past_due',
            label: 'Past Due',
            icon: CreditCard,
            color: 'red'
        },
        {
            id: 'high_value',
            label: 'High Value',
            icon: TrendingUp,
            color: 'green'
        }
    ] as const;

    return (
        <div className="flex flex-wrap gap-2 pb-4">
            {filters.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;
                const count = counts?.[filter.id as FilterType];

                return (
                    <Button
                        key={filter.id}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => onFilterChange(filter.id as FilterType)}
                        className={`
              rounded-full h-8
              ${isActive ? '' : 'hover:bg-muted'}
              ${!isActive && filter.id === 'needs_attention' ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : ''}
            `}
                    >
                        {Icon && <Icon className="mr-2 h-3.5 w-3.5" />}
                        {filter.label}
                        {count !== undefined && (
                            <Badge
                                variant={isActive ? "secondary" : "outline"}
                                className={`ml-2 h-5 px-1.5 text-[10px] ${isActive ? 'bg-background text-foreground' : ''}`}
                            >
                                {count}
                            </Badge>
                        )}
                    </Button>
                );
            })}

            {activeFilter !== 'all' && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFilterChange('all')}
                    className="h-8 w-8 p-0 rounded-full"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear filters</span>
                </Button>
            )}
        </div>
    );
}
