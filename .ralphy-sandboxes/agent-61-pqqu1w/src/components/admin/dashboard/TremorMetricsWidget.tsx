/**
 * Tremor Metrics Widget - Beautiful dashboard components
 * Inspired by Tremor repo - https://github.com/tremorlabs/tremor
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Card as TremorCard, 
  Metric, 
  Text, 
  BadgeDelta,
  DeltaType,
  CategoryBar,
  Legend
} from '@tremor/react';

interface MetricData {
  title: string;
  value: string | number;
  delta?: string;
  deltaType?: DeltaType;
  trend?: number[];
  categories?: { name: string; value: number; color: string }[];
}

interface TremorMetricsWidgetProps {
  metrics: MetricData[];
  title?: string;
}

export function TremorMetricsWidget({ metrics, title = 'Key Metrics' }: TremorMetricsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <TremorCard key={index} className="max-w-xs mx-auto">
              <Text>{metric.title}</Text>
              <Metric>{metric.value}</Metric>
              {metric.delta && (
                <BadgeDelta deltaType={metric.deltaType || 'neutral'}>
                  {metric.delta}
                </BadgeDelta>
              )}
              {metric.categories && metric.categories.length > 0 && (
                <div className="mt-4">
                  <CategoryBar
                    values={metric.categories.map(c => c.value)}
                    colors={metric.categories.map(c => c.color) as ("amber" | "blue" | "cyan" | "emerald" | "fuchsia" | "gray" | "green" | "indigo" | "lime" | "neutral" | "orange" | "pink" | "purple" | "red" | "rose" | "sky" | "slate" | "stone" | "teal" | "violet" | "yellow" | "zinc")[]}
                    className="mt-2"
                  />
                  <Legend
                    categories={metric.categories.map(c => c.name)}
                    colors={metric.categories.map(c => c.color) as ("amber" | "blue" | "cyan" | "emerald" | "fuchsia" | "gray" | "green" | "indigo" | "lime" | "neutral" | "orange" | "pink" | "purple" | "red" | "rose" | "sky" | "slate" | "stone" | "teal" | "violet" | "yellow" | "zinc")[]}
                    className="mt-3"
                  />
                </div>
              )}
            </TremorCard>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Example usage component
export function RevenueMetricsExample() {
  const metrics: MetricData[] = [
    {
      title: 'Total Revenue',
      value: '$71,465',
      delta: '12.5%',
      deltaType: 'increase',
      categories: [
        { name: 'Sales', value: 60, color: 'emerald' },
        { name: 'Services', value: 30, color: 'blue' },
        { name: 'Other', value: 10, color: 'gray' },
      ],
    },
    {
      title: 'Orders',
      value: '1,234',
      delta: '8.2%',
      deltaType: 'increase',
    },
    {
      title: 'Customers',
      value: '456',
      delta: '2.1%',
      deltaType: 'moderateIncrease',
    },
  ];

  return <TremorMetricsWidget metrics={metrics} title="Revenue Metrics" />;
}

