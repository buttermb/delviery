/**
 * Product Price History Chart
 * Shows price changes over time with trend indicators
 * Displays wholesale, retail, and cost prices on a line chart
 * Task 094: Create product pricing history
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { usePriceHistoryChart, calculatePriceChangePercent, getPriceChangeDirection } from '@/hooks/usePriceHistory';
import type { PriceChartDataPoint } from '@/hooks/usePriceHistory';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import _Minus from 'lucide-react/dist/esm/icons/minus';
import History from 'lucide-react/dist/esm/icons/history';
import { chartSemanticColors } from '@/lib/chartColors';

interface ProductPriceHistoryChartProps {
  productId: string | undefined;
}

type TimeRange = '30d' | '90d' | '1y';

interface ChartDataPoint {
  date: string;
  displayDate: string;
  wholesalePrice: number | null;
  retailPrice: number | null;
  costPerUnit: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number | null;
    color: string;
    name: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const displayDate = label ? format(new Date(label), 'MMM d, yyyy h:mm a') : '';

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-sm font-medium mb-2">{displayDate}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          entry.value !== null && (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground">{entry.name}:</span>
              </div>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

interface PriceChangeBadgeProps {
  oldPrice: number | null;
  newPrice: number | null;
  label: string;
}

function PriceChangeBadge({ oldPrice, newPrice, label }: PriceChangeBadgeProps) {
  const direction = getPriceChangeDirection(oldPrice, newPrice);
  const percentChange = calculatePriceChangePercent(oldPrice, newPrice);

  if (direction === null || direction === 'unchanged') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <Badge
        variant="outline"
        className={
          direction === 'increase'
            ? 'text-green-600 border-green-600'
            : 'text-red-600 border-red-600'
        }
      >
        {direction === 'increase' ? (
          <TrendingUp className="h-3 w-3 mr-1" />
        ) : (
          <TrendingDown className="h-3 w-3 mr-1" />
        )}
        {percentChange !== null ? `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%` : ''}
      </Badge>
    </div>
  );
}

export function ProductPriceHistoryChart({ productId }: ProductPriceHistoryChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');

  const { data: chartData = [], rawHistory = [], isLoading, error } = usePriceHistoryChart(productId, timeRange);

  // Format data for chart
  const formattedData: ChartDataPoint[] = chartData.map((point: PriceChartDataPoint) => ({
    date: point.date,
    displayDate: format(new Date(point.date), 'MMM d, yyyy'),
    wholesalePrice: point.wholesalePrice,
    retailPrice: point.retailPrice,
    costPerUnit: point.costPerUnit,
  }));

  // Calculate price change stats from most recent history entry
  const lastChange = rawHistory && rawHistory.length > 0 ? rawHistory[rawHistory.length - 1] : null;

  const handleTimeRangeChange = (value: string) => {
    if (value) {
      setTimeRange(value as TimeRange);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Price History Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Price History Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-destructive">
            Failed to load price history
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Price History Chart
            </CardTitle>
            <CardDescription>
              Track price changes over time
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={handleTimeRangeChange}
            className="justify-start"
          >
            <ToggleGroupItem value="30d" aria-label="30 days" className="text-xs">
              30d
            </ToggleGroupItem>
            <ToggleGroupItem value="90d" aria-label="90 days" className="text-xs">
              90d
            </ToggleGroupItem>
            <ToggleGroupItem value="1y" aria-label="1 year" className="text-xs">
              1y
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {formattedData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mb-2 opacity-50" />
            <p>No price changes recorded in the selected time range</p>
            <p className="text-sm mt-1">Price changes will appear here when you update product prices</p>
          </div>
        ) : (
          <>
            {/* Recent Change Summary */}
            {lastChange && (
              <div className="flex flex-wrap items-center gap-4 mb-6 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Last Change:</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(lastChange.created_at), 'MMM d, yyyy h:mm a')}
                </span>
                <PriceChangeBadge
                  oldPrice={lastChange.wholesale_price_old}
                  newPrice={lastChange.wholesale_price_new}
                  label="Wholesale"
                />
                <PriceChangeBadge
                  oldPrice={lastChange.retail_price_old}
                  newPrice={lastChange.retail_price_new}
                  label="Retail"
                />
                {lastChange.change_reason && (
                  <span className="text-xs text-muted-foreground italic">
                    &quot;{lastChange.change_reason}&quot;
                  </span>
                )}
              </div>
            )}

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Changes</p>
                <p className="text-2xl font-bold text-blue-600">{rawHistory?.length ?? 0}</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Current Wholesale</p>
                <p className="text-lg font-bold text-green-600">
                  {formattedData.length > 0 && formattedData[formattedData.length - 1].wholesalePrice
                    ? formatCurrency(formattedData[formattedData.length - 1].wholesalePrice!)
                    : '-'}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Current Retail</p>
                <p className="text-lg font-bold text-purple-600">
                  {formattedData.length > 0 && formattedData[formattedData.length - 1].retailPrice
                    ? formatCurrency(formattedData[formattedData.length - 1].retailPrice!)
                    : '-'}
                </p>
              </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formattedData}>
                <defs>
                  <linearGradient id="colorWholesale" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartSemanticColors.success} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartSemanticColors.success} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartSemanticColors.tertiary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartSemanticColors.tertiary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: string) => {
                    const date = new Date(value);
                    return timeRange === '30d'
                      ? format(date, 'MMM d')
                      : timeRange === '90d'
                      ? format(date, 'MMM d')
                      : format(date, 'MMM yyyy');
                  }}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: number) => `$${value}`}
                  className="text-muted-foreground"
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value: string) => (
                    <span className="text-sm text-muted-foreground">{value}</span>
                  )}
                />
                <Line
                  type="stepAfter"
                  dataKey="wholesalePrice"
                  stroke={chartSemanticColors.success}
                  strokeWidth={2}
                  dot={{ r: 4, fill: chartSemanticColors.success }}
                  activeDot={{ r: 6, fill: chartSemanticColors.success }}
                  name="Wholesale"
                  connectNulls
                />
                <Line
                  type="stepAfter"
                  dataKey="retailPrice"
                  stroke={chartSemanticColors.tertiary}
                  strokeWidth={2}
                  dot={{ r: 4, fill: chartSemanticColors.tertiary }}
                  activeDot={{ r: 6, fill: chartSemanticColors.tertiary }}
                  name="Retail"
                  connectNulls
                />
                <Line
                  type="stepAfter"
                  dataKey="costPerUnit"
                  stroke={chartSemanticColors.cost}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: chartSemanticColors.cost }}
                  activeDot={{ r: 5, fill: chartSemanticColors.cost }}
                  name="Cost"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Legend Note */}
            <p className="text-xs text-muted-foreground text-center mt-4">
              Prices are displayed as step functions to show exact change points
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
