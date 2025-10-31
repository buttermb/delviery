import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticsStat {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

interface EnhancedAnalyticsCardProps {
  stats: AnalyticsStat[];
}

export const EnhancedAnalyticsCard = ({ stats }: EnhancedAnalyticsCardProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold">{stat.value}</p>
                {stat.change !== undefined && (
                  <Badge
                    variant={stat.trend === 'up' ? 'default' : stat.trend === 'down' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : stat.trend === 'down' ? (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    ) : (
                      <Activity className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(stat.change)}%
                  </Badge>
                )}
              </div>
            </div>
            {stat.icon && (
              <div className="text-muted-foreground">
                {stat.icon}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};