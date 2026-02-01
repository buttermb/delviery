/**
 * CreditBurnRateDisplay Component
 * 
 * Shows credit burn rate and projected depletion date.
 * Helps users understand their usage patterns.
 */

import { TrendingDown, TrendingUp, Calendar, Activity, AlertTriangle, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import { projectDepletion, type CreditProjection } from '@/lib/credits/creditProjection';

export interface CreditBurnRateDisplayProps {
  className?: string;
  variant?: 'card' | 'inline' | 'compact';
}

export function CreditBurnRateDisplay({ 
  className,
  variant = 'card',
}: CreditBurnRateDisplayProps) {
  const { tenant } = useTenantAdminAuth();
  const { balance, isFreeTier, isLoading: creditsLoading } = useCredits();
  const tenantId = tenant?.id;

  // Fetch projection data
  const { data: projection, isLoading } = useQuery({
    queryKey: ['credit-projection', tenantId, balance],
    queryFn: async () => {
      if (!tenantId) return null;
      return projectDepletion(tenantId, balance);
    },
    enabled: !!tenantId && isFreeTier && balance > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Don't show for paid tier
  if (!isFreeTier && !creditsLoading) {
    return null;
  }

  // Loading state
  if (isLoading || creditsLoading) {
    if (variant === 'compact') {
      return <Skeleton className="h-6 w-32" />;
    }
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!projection) {
    return null;
  }

  // Get trend icon
  const TrendIcon = projection.trend === 'increasing' 
    ? TrendingUp 
    : projection.trend === 'decreasing'
      ? TrendingDown
      : Minus;

  // Get confidence badge color
  const getConfidenceColor = () => {
    switch (projection.confidence) {
      case 'high': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'low': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Compact variant - single line
  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">~{Math.round(projection.avgDailyBurn)}/day</span>
        {projection.daysRemaining !== null && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className={cn(
              projection.daysRemaining <= 3 ? 'text-red-600' :
              projection.daysRemaining <= 7 ? 'text-orange-600' :
              'text-muted-foreground'
            )}>
              ~{projection.daysRemaining}d left
            </span>
          </>
        )}
      </div>
    );
  }

  // Inline variant - horizontal layout
  if (variant === 'inline') {
    return (
      <div className={cn(
        "flex items-center justify-between p-3 rounded-lg bg-muted/50",
        className
      )}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {Math.round(projection.avgDailyBurn).toLocaleString()}/day
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendIcon className={cn(
              "h-4 w-4",
              projection.trend === 'increasing' ? 'text-red-500' :
              projection.trend === 'decreasing' ? 'text-emerald-500' :
              'text-muted-foreground'
            )} />
            <span className="text-xs text-muted-foreground capitalize">
              {projection.trend}
            </span>
          </div>
        </div>

        {projection.daysRemaining !== null && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              "text-sm font-medium",
              projection.daysRemaining <= 3 ? 'text-red-600' :
              projection.daysRemaining <= 7 ? 'text-orange-600' :
              'text-foreground'
            )}>
              {projection.daysRemaining <= 0 
                ? 'Depleted' 
                : `~${projection.daysRemaining} day${projection.daysRemaining !== 1 ? 's' : ''} left`
              }
            </span>
          </div>
        )}
      </div>
    );
  }

  // Card variant - full display
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Usage Projection
          </span>
          <Badge variant="outline" className={cn("text-xs", getConfidenceColor())}>
            {projection.confidence} confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Burn Rate Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Daily Average</p>
            <p className="text-2xl font-bold">
              {Math.round(projection.avgDailyBurn).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">credits/day</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Weekly Average</p>
            <p className="text-2xl font-bold">
              {Math.round(projection.avgWeeklyBurn).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">credits/week</p>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">Usage Trend</span>
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
            projection.trend === 'increasing' 
              ? 'bg-red-500/10 text-red-600'
              : projection.trend === 'decreasing'
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-muted text-muted-foreground'
          )}>
            <TrendIcon className="h-4 w-4" />
            <span className="capitalize">{projection.trend}</span>
          </div>
        </div>

        {/* Depletion Estimate */}
        {projection.daysRemaining !== null && (
          <div className={cn(
            "p-4 rounded-lg border",
            projection.daysRemaining <= 3 
              ? 'bg-red-500/10 border-red-500/20' 
              : projection.daysRemaining <= 7
                ? 'bg-orange-500/10 border-orange-500/20'
                : 'bg-muted/50 border-border'
          )}>
            <div className="flex items-center gap-2 mb-2">
              {projection.daysRemaining <= 7 && (
                <AlertTriangle className={cn(
                  "h-4 w-4",
                  projection.daysRemaining <= 3 ? 'text-red-500' : 'text-orange-500'
                )} />
              )}
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Estimated Depletion</span>
            </div>
            
            <p className={cn(
              "text-xl font-bold",
              projection.daysRemaining <= 3 ? 'text-red-600' :
              projection.daysRemaining <= 7 ? 'text-orange-600' :
              'text-foreground'
            )}>
              {projection.daysRemaining <= 0 
                ? 'Today or Tomorrow'
                : projection.daysRemaining === 1
                  ? 'Tomorrow'
                  : `In ~${projection.daysRemaining} days`
              }
            </p>
            
            {projection.depletionDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Around {projection.depletionDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        )}

        {/* Message */}
        <p className="text-xs text-muted-foreground">
          {projection.message}
        </p>
      </CardContent>
    </Card>
  );
}

export default CreditBurnRateDisplay;





