/**
 * CreditOptimizationTips Component
 * 
 * Shows users how to use credits more efficiently.
 * Builds trust by helping them get more value from the free tier.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Lightbulb,
  TrendingDown,
  Clock,
  Users,
  FileText,
  MessageSquare,
  Package,
  ChevronRight,
  Sparkles,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import { CREDIT_COSTS } from '@/lib/credits';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export interface CreditOptimizationTipsProps {
  className?: string;
  compact?: boolean;
  maxTips?: number;
}

interface OptimizationTip {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  potentialSavings?: number;
  savingsLabel?: string;
  action?: string;
  actionUrl?: string;
  category: 'bulk' | 'timing' | 'workflow' | 'upgrade';
  priority: number;
}

const OPTIMIZATION_TIPS: OptimizationTip[] = [
  {
    id: 'bulk-sms',
    icon: MessageSquare,
    title: 'Send bulk SMS instead of individual messages',
    description: 'Bulk SMS costs 20 credits each vs 25 for individual sends. Save 20% on large campaigns.',
    potentialSavings: 20,
    savingsLabel: '20% less',
    category: 'bulk',
    priority: 1,
  },
  {
    id: 'bulk-email',
    icon: MessageSquare,
    title: 'Use bulk email for newsletters',
    description: 'Bulk email costs 8 credits each vs 10 for individual sends. Perfect for updates to all customers.',
    potentialSavings: 20,
    savingsLabel: '20% less',
    category: 'bulk',
    priority: 2,
  },
  {
    id: 'schedule-reports',
    icon: Clock,
    title: 'Schedule reports weekly instead of daily',
    description: 'Generating reports costs 75+ credits. Weekly reports give you the same insights at 1/7 the cost.',
    potentialSavings: 85,
    savingsLabel: '85% less',
    category: 'timing',
    priority: 1,
  },
  {
    id: 'menu-links',
    icon: FileText,
    title: 'Share menu links instead of creating new menus',
    description: 'Creating a new menu costs 100 credits, but sharing an existing link is free. Reuse menus when possible.',
    potentialSavings: 100,
    savingsLabel: '100 credits',
    category: 'workflow',
    priority: 1,
  },
  {
    id: 'batch-inventory',
    icon: Package,
    title: 'Batch your inventory updates',
    description: 'Individual updates cost 3 credits each. Update multiple items at once using bulk update to save.',
    potentialSavings: 50,
    savingsLabel: '50%+ less',
    category: 'bulk',
    priority: 3,
  },
  {
    id: 'customer-import',
    icon: Users,
    title: 'Import customers in bulk',
    description: 'Adding customers one by one costs 5 credits each. Bulk import is just 50 credits for any number.',
    potentialSavings: 90,
    savingsLabel: '90%+ less',
    category: 'bulk',
    priority: 2,
  },
  {
    id: 'export-timing',
    icon: TrendingDown,
    title: 'Export data less frequently',
    description: 'Exports cost 150 credits. Export weekly or monthly instead of daily, or upgrade for unlimited exports.',
    potentialSavings: 80,
    savingsLabel: '80% less',
    category: 'timing',
    priority: 2,
  },
  {
    id: 'upgrade-unlimited',
    icon: Sparkles,
    title: 'Upgrade for unlimited usage',
    description: 'Heavy users save money by upgrading. If you use more than 4,000 credits weekly, subscription is cheaper.',
    action: 'View Plans',
    actionUrl: '/select-plan',
    category: 'upgrade',
    priority: 4,
  },
];

export function CreditOptimizationTips({
  className,
  compact = false,
  maxTips = 5,
}: CreditOptimizationTipsProps) {
  const { tenant } = useTenantAdminAuth();
  const { isFreeTier } = useCredits();
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());

  const tenantId = tenant?.id;

  // Fetch usage patterns to personalize tips
  const { data: usageData } = useQuery({
    queryKey: queryKeys.creditOptimizationUsage.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      // Get action breakdown from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: transactions } = await supabase
        .from('credit_transactions')
        .select('action_type, amount')
        .eq('tenant_id', tenantId)
        .eq('transaction_type', 'usage')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!transactions) return null;

      // Analyze patterns
      const actionCounts: Record<string, { count: number; credits: number }> = {};

      transactions.forEach((t) => {
        const action = t.action_type || 'unknown';
        if (!actionCounts[action]) {
          actionCounts[action] = { count: 0, credits: 0 };
        }
        actionCounts[action].count++;
        actionCounts[action].credits += Math.abs(t.amount);
      });

      return {
        actionCounts,
        totalActions: transactions.length,
        topActions: Object.entries(actionCounts)
          .sort((a, b) => b[1].credits - a[1].credits)
          .slice(0, 5),
      };
    },
    enabled: !!tenantId && isFreeTier,
    staleTime: 10 * 60 * 1000,
  });

  // Personalize tips based on usage
  const personalizedTips = useMemo(() => {
    let tips = [...OPTIMIZATION_TIPS];

    // Filter out dismissed tips
    tips = tips.filter((tip) => !dismissedTips.has(tip.id));

    // Prioritize based on usage patterns
    if (usageData?.actionCounts) {
      const { actionCounts } = usageData;

      // If sending lots of individual SMS, prioritize bulk SMS tip
      if ((actionCounts['send_sms']?.count ?? 0) > 10) {
        tips = tips.map((t) =>
          t.id === 'bulk-sms' ? { ...t, priority: 0 } : t
        );
      }

      // If creating many menus, prioritize menu links tip
      if ((actionCounts['menu_create']?.count ?? 0) > 5) {
        tips = tips.map((t) =>
          t.id === 'menu-links' ? { ...t, priority: 0 } : t
        );
      }

      // If exporting frequently, prioritize export timing tip
      if (
        (actionCounts['export_csv']?.count ?? 0) +
        (actionCounts['export_pdf']?.count ?? 0) >
        3
      ) {
        tips = tips.map((t) =>
          t.id === 'export-timing' ? { ...t, priority: 0 } : t
        );
      }

      // If heavy user, prioritize upgrade tip
      if (usageData.totalActions > 100) {
        tips = tips.map((t) =>
          t.id === 'upgrade-unlimited' ? { ...t, priority: 0 } : t
        );
      }
    }

    // Sort by priority
    tips.sort((a, b) => a.priority - b.priority);

    return tips.slice(0, maxTips);
  }, [usageData, dismissedTips, maxTips]);

  // Handle dismiss
  const handleDismiss = (tipId: string) => {
    setDismissedTips((prev) => new Set([...prev, tipId]));
  };

  // Don't show for paid tier
  if (!isFreeTier) {
    return null;
  }

  // Compact variant
  if (compact) {
    return (
      <Card className={cn('bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200', className)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <span className="font-medium">Credit-Saving Tips</span>
          </div>

          {personalizedTips.slice(0, 2).map((tip) => (
            <div key={tip.id} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{tip.title}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Full variant
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Credit-Saving Tips
        </CardTitle>
        <CardDescription>
          Get more value from your free credits with these optimization strategies
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Accordion type="single" collapsible className="w-full">
          {personalizedTips.map((tip) => (
            <AccordionItem key={tip.id} value={tip.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    tip.category === 'bulk' && 'bg-blue-100 dark:bg-blue-900',
                    tip.category === 'timing' && 'bg-purple-100 dark:bg-purple-900',
                    tip.category === 'workflow' && 'bg-emerald-100 dark:bg-emerald-900',
                    tip.category === 'upgrade' && 'bg-amber-100 dark:bg-amber-900',
                  )}>
                    <tip.icon className={cn(
                      'h-4 w-4',
                      tip.category === 'bulk' && 'text-blue-600',
                      tip.category === 'timing' && 'text-purple-600',
                      tip.category === 'workflow' && 'text-emerald-600',
                      tip.category === 'upgrade' && 'text-amber-600',
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{tip.title}</p>
                    {tip.savingsLabel && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        Save {tip.savingsLabel}
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-11 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {tip.description}
                  </p>

                  <div className="flex items-center justify-between">
                    {tip.actionUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={tip.actionUrl}>
                          {tip.action}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </a>
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(tip.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Category breakdown */}
        {usageData?.topActions && usageData.topActions.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Your Top Credit Uses</h4>
            <div className="space-y-2">
              {usageData.topActions.slice(0, 3).map(([action, data]) => {
                const actionInfo = CREDIT_COSTS[action];
                return (
                  <div key={action} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {actionInfo?.actionName || action.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {data.count}x
                      </span>
                      <Badge variant="outline">
                        {data.credits.toLocaleString()} credits
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-4 mt-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                Go unlimited for $79/month
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                No more worrying about credits. All features, unlimited usage.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}







