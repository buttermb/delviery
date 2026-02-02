import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Minus from "lucide-react/dist/esm/icons/minus";
import { motion } from 'framer-motion';

interface ComparisonMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  format?: 'number' | 'currency' | 'percentage';
}

interface ComparisonMetricsCardProps {
  title: string;
  metrics: ComparisonMetric[];
  periodLabel?: string;
}

export const ComparisonMetricsCard = ({ 
  title, 
  metrics,
  periodLabel = 'vs previous period'
}: ComparisonMetricsCardProps) => {
  const formatValue = (value: number, format?: string) => {
    switch (format) {
      case 'currency':
        return `$${value.toFixed(2)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, percentage: 0 };
    const diff = current - previous;
    const percentage = ((diff / previous) * 100);
    return { value: diff, percentage };
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4" />;
    if (change < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-primary bg-primary/10 border-primary/20';
    if (change < 0) return 'text-destructive bg-destructive/10 border-destructive/20';
    return 'text-muted-foreground bg-muted border-muted';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric, index) => {
            const change = calculateChange(metric.currentValue, metric.previousValue);
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-bold">
                      {formatValue(metric.currentValue, metric.format)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      from {formatValue(metric.previousValue, metric.format)}
                    </p>
                  </div>
                </div>
                <Badge className={getTrendColor(change.percentage)}>
                  {getTrendIcon(change.percentage)}
                  <span className="ml-1 font-semibold">
                    {change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(1)}%
                  </span>
                </Badge>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
