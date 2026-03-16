/**
 * FeatureSummaryStats — four stat cards showing feature overview + progress bar.
 */

import { CheckCircle2, Circle, Lock, LayoutGrid } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { FeatureStats } from '@/hooks/useUnifiedFeatures';

interface FeatureSummaryStatsProps {
  stats: FeatureStats;
}

const STAT_CONFIG = [
  {
    key: 'total' as const,
    label: 'Total Features',
    icon: LayoutGrid,
    color: 'text-foreground',
  },
  {
    key: 'enabled' as const,
    label: 'Enabled',
    icon: CheckCircle2,
    color: 'text-emerald-600',
  },
  {
    key: 'disabled' as const,
    label: 'Can Enable',
    icon: Circle,
    color: 'text-amber-600',
  },
  {
    key: 'locked' as const,
    label: 'Needs Upgrade',
    icon: Lock,
    color: 'text-muted-foreground',
  },
];

export function FeatureSummaryStats({ stats }: FeatureSummaryStatsProps) {
  const enabledPercent = stats.total > 0 ? Math.round((stats.enabled / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CONFIG.map(({ key, label, icon: Icon, color }) => (
          <Card key={key} className="shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${color}`}>
                {stats[key]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Progress value={enabledPercent} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
          {enabledPercent}%
        </span>
      </div>
    </div>
  );
}
