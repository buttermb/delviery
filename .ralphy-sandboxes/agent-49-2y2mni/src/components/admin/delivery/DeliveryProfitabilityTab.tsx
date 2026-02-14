/**
 * DeliveryProfitabilityTab
 * Shows delivery P&L analytics: profitable vs unprofitable breakdown,
 * zone profitability, and route optimization suggestions.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Lightbulb from 'lucide-react/dist/esm/icons/lightbulb';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';

import type { DeliveryCost, DeliveryPLSummary, ZoneProfitability } from '@/types/deliveryCosts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

interface DeliveryProfitabilityTabProps {
  costs: DeliveryCost[];
  isLoading: boolean;
}

export function DeliveryProfitabilityTab({ costs, isLoading }: DeliveryProfitabilityTabProps) {
  // Calculate P&L summary
  const summary = useMemo((): DeliveryPLSummary => {
    if (costs.length === 0) {
      return {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        profitMargin: 0,
        profitableCount: 0,
        unprofitableCount: 0,
        avgProfit: 0,
        avgCostPerDelivery: 0,
        avgRevenuePerDelivery: 0,
      };
    }

    const totalRevenue = costs.reduce(
      (sum, c) => sum + c.delivery_fee_collected + c.tip_amount,
      0
    );
    const totalCost = costs.reduce(
      (sum, c) => sum + c.runner_pay + c.fuel_estimate + c.time_cost + c.other_costs,
      0
    );
    const totalProfit = totalRevenue - totalCost;
    const profitableCount = costs.filter(
      (c) => c.delivery_fee_collected + c.tip_amount >= c.runner_pay + c.fuel_estimate + c.time_cost + c.other_costs
    ).length;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
      profitableCount,
      unprofitableCount: costs.length - profitableCount,
      avgProfit: Math.round((totalProfit / costs.length) * 100) / 100,
      avgCostPerDelivery: Math.round((totalCost / costs.length) * 100) / 100,
      avgRevenuePerDelivery: Math.round((totalRevenue / costs.length) * 100) / 100,
    };
  }, [costs]);

  // Zone profitability breakdown
  const zoneProfitability = useMemo((): ZoneProfitability[] => {
    if (costs.length === 0) return [];

    const zoneMap = new Map<string, DeliveryCost[]>();
    costs.forEach((cost) => {
      const zone = cost.delivery_zone || cost.delivery_borough || 'Unknown';
      const existing = zoneMap.get(zone) || [];
      zoneMap.set(zone, [...existing, cost]);
    });

    return Array.from(zoneMap.entries())
      .map(([zone, zoneCosts]) => {
        const totalRevenue = zoneCosts.reduce(
          (sum, c) => sum + c.delivery_fee_collected + c.tip_amount,
          0
        );
        const totalCost = zoneCosts.reduce(
          (sum, c) => sum + c.runner_pay + c.fuel_estimate + c.time_cost + c.other_costs,
          0
        );
        const totalProfit = totalRevenue - totalCost;
        const costsWithDistance = zoneCosts.filter((c) => c.distance_miles !== null);
        const costsWithTime = zoneCosts.filter((c) => c.delivery_time_minutes !== null);

        return {
          zone,
          deliveryCount: zoneCosts.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          totalProfit: Math.round(totalProfit * 100) / 100,
          profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
          avgDistanceMiles: costsWithDistance.length > 0
            ? Math.round(
                (costsWithDistance.reduce((sum, c) => sum + (c.distance_miles || 0), 0) /
                  costsWithDistance.length) * 10
              ) / 10
            : 0,
          avgDeliveryTimeMinutes: costsWithTime.length > 0
            ? Math.round(
                costsWithTime.reduce((sum, c) => sum + (c.delivery_time_minutes || 0), 0) /
                  costsWithTime.length
              )
            : 0,
          isProfitable: totalProfit >= 0,
        };
      })
      .sort((a, b) => a.totalProfit - b.totalProfit);
  }, [costs]);

  // Route optimization suggestions for unprofitable zones
  const optimizationSuggestions = useMemo(() => {
    const unprofitableZones = zoneProfitability.filter((z) => !z.isProfitable);
    if (unprofitableZones.length === 0) return [];

    return unprofitableZones.map((zone) => {
      const suggestions: string[] = [];
      const lossPerDelivery = Math.abs(zone.totalProfit / zone.deliveryCount);

      if (zone.avgDistanceMiles > 5) {
        suggestions.push(
          `High distance zone (${zone.avgDistanceMiles} mi avg). Consider raising delivery fee or batching orders in this area.`
        );
      }

      if (zone.avgDeliveryTimeMinutes > 45) {
        suggestions.push(
          `Slow delivery times (${zone.avgDeliveryTimeMinutes} min avg). Consider positioning a runner closer to this zone during peak hours.`
        );
      }

      if (lossPerDelivery > 5) {
        suggestions.push(
          `Losing ${formatCurrency(lossPerDelivery)} per delivery. Consider a ${formatCurrency(lossPerDelivery + 2)} minimum delivery fee surcharge for this zone.`
        );
      }

      if (zone.deliveryCount < 5) {
        suggestions.push(
          `Low volume zone (${zone.deliveryCount} deliveries). Consider batching deliveries for this area on specific days to reduce per-trip costs.`
        );
      }

      if (suggestions.length === 0) {
        suggestions.push(
          `Review runner pay rates and fuel estimates for this zone. Current margin: ${zone.profitMargin}%.`
        );
      }

      return { zone: zone.zone, suggestions, loss: zone.totalProfit };
    });
  }, [zoneProfitability]);

  // Pie chart data for profitable vs unprofitable
  const profitabilityPieData = useMemo(() => {
    if (costs.length === 0) return [];
    return [
      { name: 'Profitable', value: summary.profitableCount, fill: '#22c55e' },
      { name: 'Unprofitable', value: summary.unprofitableCount, fill: '#ef4444' },
    ].filter((d) => d.value > 0);
  }, [costs.length, summary]);

  // Bar chart data for zone profitability
  const zoneChartData = useMemo(() => {
    return zoneProfitability.map((z) => ({
      zone: z.zone.length > 15 ? z.zone.slice(0, 15) + '...' : z.zone,
      profit: z.totalProfit,
      revenue: z.totalRevenue,
      cost: z.totalCost,
    }));
  }, [zoneProfitability]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (costs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium text-muted-foreground">No delivery cost data</p>
          <p className="text-sm text-muted-foreground mt-1">
            Record delivery costs on individual orders to see profitability analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Avg {formatCurrency(summary.avgRevenuePerDelivery)} per delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</p>
                <p className="text-xs text-muted-foreground">Total Costs</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Avg {formatCurrency(summary.avgCostPerDelivery)} per delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                summary.totalProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              )}>
                {summary.totalProfit >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div>
                <p className={cn(
                  'text-2xl font-bold',
                  summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {summary.totalProfit >= 0 ? '+' : ''}{formatCurrency(summary.totalProfit)}
                </p>
                <p className="text-xs text-muted-foreground">Net Profit</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {summary.profitMargin}% margin • Avg {formatCurrency(summary.avgProfit)}/delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {summary.profitableCount}/{costs.length}
                </p>
                <p className="text-xs text-muted-foreground">Profitable Deliveries</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                {summary.profitableCount} profitable
              </Badge>
              {summary.unprofitableCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600">
                  {summary.unprofitableCount} loss
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profitable vs Unprofitable Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Profitability Split</CardTitle>
            <CardDescription>Profitable vs unprofitable deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            {profitabilityPieData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={profitabilityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {profitabilityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zone Profitability Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Profit by Zone
            </CardTitle>
            <CardDescription>Net profit per delivery zone</CardDescription>
          </CardHeader>
          <CardContent>
            {zoneChartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={zoneChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => `$${v}`}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="zone"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value)]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                      {zoneChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                No zone data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zone Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Zone Profitability Breakdown</CardTitle>
          <CardDescription>Detailed P&L by delivery zone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {zoneProfitability.map((zone) => (
              <div
                key={zone.zone}
                className={cn(
                  'flex items-center justify-between p-4 border rounded-lg',
                  !zone.isProfitable && 'border-red-500/20 bg-red-50/50 dark:bg-red-950/10'
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{zone.zone}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        zone.isProfitable
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-red-500/10 text-red-600'
                      )}
                    >
                      {zone.isProfitable ? 'Profitable' : 'Loss'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {zone.deliveryCount} deliveries
                    {zone.avgDistanceMiles > 0 && ` • ${zone.avgDistanceMiles} mi avg`}
                    {zone.avgDeliveryTimeMinutes > 0 && ` • ${zone.avgDeliveryTimeMinutes} min avg`}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className={cn(
                    'font-bold',
                    zone.isProfitable ? 'text-green-600' : 'text-red-600'
                  )}>
                    {zone.totalProfit >= 0 ? '+' : ''}{formatCurrency(zone.totalProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Rev: {formatCurrency(zone.totalRevenue)} • Cost: {formatCurrency(zone.totalCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {zone.profitMargin}% margin
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Route Optimization Suggestions */}
      {optimizationSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Route Optimization Suggestions
            </CardTitle>
            <CardDescription>
              Recommendations for improving unprofitable delivery zones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {optimizationSuggestions.map((item) => (
                <div
                  key={item.zone}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold">{item.zone}</span>
                    </div>
                    <Badge variant="destructive">
                      {formatCurrency(item.loss)} loss
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {item.suggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
