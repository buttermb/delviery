/**
 * RunnerLeaderboard Component
 *
 * Displays a ranked list of runners based on performance metrics.
 * Shows on the delivery dashboard for runner management and optimization.
 */

import { useState } from 'react';
import {
  Trophy,
  Medal,
  Clock,
  CheckCircle,
  Star,
  Package,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';

import { useRunnerLeaderboard, type LeaderboardEntry } from '@/hooks/useRunnerMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface RunnerLeaderboardProps {
  className?: string;
  limit?: number;
  showPeriodSelector?: boolean;
  onRunnerClick?: (runnerId: string) => void;
}

type Period = 'week' | 'month' | 'all';

// =============================================================================
// Helper Components
// =============================================================================

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-500/20">
        <Trophy className="h-4 w-4 text-yellow-500" />
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-400/20">
        <Medal className="h-4 w-4 text-slate-400" />
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-700/20">
        <Medal className="h-4 w-4 text-amber-700" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
      <span className="text-sm font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

function LeaderboardRow({
  entry,
  onClick,
  expanded,
  onToggleExpand,
}: {
  entry: LeaderboardEntry;
  onClick?: (runnerId: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        entry.rank <= 3 ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-border'
      )}
    >
      {/* Main Row */}
      <div
        className={cn(
          'flex items-center gap-4 p-4',
          onClick && 'cursor-pointer hover:bg-muted/50'
        )}
        onClick={() => onClick?.(entry.runnerId)}
      >
        <RankBadge rank={entry.rank} />

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{entry.runnerName}</div>
          <div className="text-xs text-muted-foreground">
            Score: {entry.score}
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          {/* Deliveries */}
          <div className="text-center">
            <div className="font-bold">{entry.deliveriesCompleted}</div>
            <div className="text-xs text-muted-foreground">deliveries</div>
          </div>

          {/* On-Time Rate */}
          <div className="text-center hidden sm:block">
            <div className="font-bold">{entry.onTimeRate}%</div>
            <div className="text-xs text-muted-foreground">on-time</div>
          </div>

          {/* Avg Time */}
          <div className="text-center hidden md:block">
            <div className="font-bold">{entry.avgDeliveryTimeMinutes}</div>
            <div className="text-xs text-muted-foreground">min avg</div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span className="font-bold">{entry.rating?.toFixed(1) ?? 'N/A'}</span>
          </div>
        </div>

        {onToggleExpand && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          </Button>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Deliveries</div>
                <div className="font-medium">{entry.deliveriesCompleted}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">On-Time Rate</div>
                <div className="font-medium">{entry.onTimeRate}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Avg Time</div>
                <div className="font-medium">{entry.avgDeliveryTimeMinutes} min</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Score</div>
                <div className="font-medium">{entry.score}/100</div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-1">Performance Score</div>
            <Progress value={entry.score} className="h-2" />
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex gap-6">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function RunnerLeaderboard({
  className,
  limit = 10,
  showPeriodSelector = true,
  onRunnerClick,
}: RunnerLeaderboardProps) {
  const [period, setPeriod] = useState<Period>('week');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: leaderboard, isLoading, error } = useRunnerLeaderboard({
    limit,
    period,
  });

  const periodLabel = {
    week: 'This Week',
    month: 'This Month',
    all: 'All Time',
  }[period];

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="p-6 text-center">
          <Trophy className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load leaderboard</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Runner Leaderboard
            </CardTitle>
            <CardDescription>
              Top performers ranked by composite score
            </CardDescription>
          </div>
          {showPeriodSelector && (
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <LeaderboardRow
                key={entry.runnerId}
                entry={entry}
                onClick={onRunnerClick}
                expanded={expandedId === entry.runnerId}
                onToggleExpand={() =>
                  setExpandedId(expandedId === entry.runnerId ? null : entry.runnerId)
                }
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No runner data for {periodLabel.toLowerCase()}</p>
          </div>
        )}

        {/* Score Legend */}
        {leaderboard && leaderboard.length > 0 && (
          <div className="mt-6 p-3 bg-muted/50 rounded-lg">
            <div className="text-xs font-medium mb-2">Scoring Formula</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div>Deliveries: 30%</div>
              <div>On-Time Rate: 30%</div>
              <div>Avg Time: 20%</div>
              <div>Rating: 20%</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RunnerLeaderboard;
