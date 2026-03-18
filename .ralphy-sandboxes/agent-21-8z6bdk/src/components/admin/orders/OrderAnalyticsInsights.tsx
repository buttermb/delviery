/**
 * OrderAnalyticsInsights Component
 *
 * Displays contextual analytics for an order:
 * - Is this customer's largest order
 * - How does it compare to average order value
 * - What time of day was it placed
 * - Is the product mix typical for this customer
 *
 * Connects order view to analytics module naturally.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import Clock from "lucide-react/dist/esm/icons/clock";
import Package from "lucide-react/dist/esm/icons/package";
import Target from "lucide-react/dist/esm/icons/target";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

interface OrderAnalyticsInsightsProps {
  orderId: string;
  customerId: string | null;
  orderTotal: number;
  orderCreatedAt: string;
  orderItems?: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
  }>;
  className?: string;
}

interface OrderInsight {
  type: 'positive' | 'neutral' | 'info';
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}

interface AnalyticsData {
  customerOrderCount: number;
  customerTotalSpent: number;
  customerAvgOrder: number;
  customerLargestOrder: number;
  isLargestOrder: boolean;
  tenantAvgOrderValue: number;
  comparedToAvg: number; // percentage difference
  orderHour: number;
  timeOfDayLabel: string;
  isTypicalTime: boolean;
  topCustomerProducts: string[];
  hasNewProducts: boolean;
  newProductCount: number;
}

function getTimeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

function getTimePeriodPrefix(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

export function OrderAnalyticsInsights({
  orderId,
  customerId,
  orderTotal,
  orderCreatedAt,
  orderItems = [],
  className,
}: OrderAnalyticsInsightsProps) {
  const { tenant } = useTenantAdminAuth();

  // Fetch analytics data
  const { data: analytics, isLoading, isError } = useQuery({
    queryKey: queryKeys.orderAnalyticsInsights.byOrder(tenant?.id, orderId, customerId),
    queryFn: async (): Promise<AnalyticsData | null> => {
      if (!tenant?.id) return null;

      const orderDate = new Date(orderCreatedAt);
      const orderHour = orderDate.getHours();

      // Default values
      let customerOrderCount = 0;
      let customerTotalSpent = 0;
      let customerAvgOrder = 0;
      let customerLargestOrder = 0;
      let topCustomerProducts: string[] = [];

      // Fetch customer order history if we have a customer ID
      if (customerId) {
        const { data: customerOrders, error: customerError } = await supabase
          .from('unified_orders')
          .select('id, total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .eq('customer_id', customerId)
          .not('status', 'in', '("cancelled","rejected","refunded")')
          .order('created_at', { ascending: false });

        if (customerError) {
          logger.warn('Failed to fetch customer orders for analytics', customerError, {
            component: 'OrderAnalyticsInsights',
          });
        } else if (customerOrders && customerOrders.length > 0) {
          customerOrderCount = customerOrders.length;
          customerTotalSpent = customerOrders.reduce(
            (sum, o) => sum + (Number(o.total_amount) || 0),
            0
          );
          customerAvgOrder = customerTotalSpent / customerOrderCount;
          customerLargestOrder = Math.max(
            ...customerOrders.map((o) => Number(o.total_amount) || 0)
          );
        }

        // Fetch customer's most-ordered products
        const { data: customerProducts, error: productsError } = await supabase
          .from('unified_order_items')
          .select('product_name, product_id, unified_orders!inner(customer_id, tenant_id)')
          .eq('unified_orders.tenant_id', tenant.id)
          .eq('unified_orders.customer_id', customerId)
          .limit(100);

        if (productsError) {
          logger.warn('Failed to fetch customer product history', productsError, {
            component: 'OrderAnalyticsInsights',
          });
        } else if (customerProducts && customerProducts.length > 0) {
          // Count product frequency
          const productCounts = new Map<string, number>();
          customerProducts.forEach((item) => {
            const name = item.product_name;
            productCounts.set(name, (productCounts.get(name) ?? 0) + 1);
          });
          // Get top 5 products
          topCustomerProducts = Array.from(productCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);
        }
      }

      // Fetch tenant-wide average order value (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: tenantOrders, error: tenantError } = await supabase
        .from('unified_orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .not('status', 'in', '("cancelled","rejected","refunded")');

      let tenantAvgOrderValue = 0;
      if (tenantError) {
        logger.warn('Failed to fetch tenant orders for AOV', tenantError, {
          component: 'OrderAnalyticsInsights',
        });
      } else if (tenantOrders && tenantOrders.length > 0) {
        const totalRevenue = tenantOrders.reduce(
          (sum, o) => sum + (Number(o.total_amount) || 0),
          0
        );
        tenantAvgOrderValue = totalRevenue / tenantOrders.length;
      }

      // Calculate comparison to average
      const comparedToAvg =
        tenantAvgOrderValue > 0
          ? ((orderTotal - tenantAvgOrderValue) / tenantAvgOrderValue) * 100
          : 0;

      // Check if order time is typical for customer (if we have customer data)
      let isTypicalTime = true;
      if (customerId && customerOrderCount > 3) {
        // This is a simplification - in a real scenario, we'd analyze order times
        // For now, we'll consider morning/afternoon typical and evening/night less typical
        isTypicalTime = orderHour >= 8 && orderHour <= 18;
      }

      // Check for new products (products customer hasn't ordered before)
      const currentProductNames = orderItems.map((item) => item.product_name);
      const newProducts = currentProductNames.filter(
        (name) => !topCustomerProducts.includes(name)
      );

      return {
        customerOrderCount,
        customerTotalSpent,
        customerAvgOrder,
        customerLargestOrder,
        isLargestOrder: orderTotal >= customerLargestOrder && customerOrderCount > 0,
        tenantAvgOrderValue,
        comparedToAvg,
        orderHour,
        timeOfDayLabel: getTimeOfDayLabel(orderHour),
        isTypicalTime,
        topCustomerProducts,
        hasNewProducts: newProducts.length > 0 && topCustomerProducts.length > 0,
        newProductCount: newProducts.length,
      };
    },
    enabled: !!tenant?.id && !!orderId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate insights from analytics data
  const insights = useMemo((): OrderInsight[] => {
    if (!analytics) return [];

    const result: OrderInsight[] = [];
    const orderDate = new Date(orderCreatedAt);
    const orderHour = orderDate.getHours();

    // Insight 1: Customer's largest order
    if (analytics.isLargestOrder && analytics.customerOrderCount > 1) {
      result.push({
        type: 'positive',
        icon: <Trophy className="h-4 w-4 text-amber-500" />,
        label: 'Largest Order',
        value: `#${analytics.customerOrderCount}`,
        description: `This is the customer's largest order out of ${analytics.customerOrderCount} total orders`,
      });
    } else if (analytics.customerOrderCount > 0) {
      const rank = orderTotal >= analytics.customerAvgOrder ? 'above' : 'below';
      result.push({
        type: rank === 'above' ? 'positive' : 'neutral',
        icon:
          rank === 'above' ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-orange-500" />
          ),
        label: 'Customer Avg',
        value: formatCurrency(analytics.customerAvgOrder),
        description: `This order is ${rank} their average of ${formatCurrency(analytics.customerAvgOrder)}`,
      });
    }

    // Insight 2: Compared to tenant AOV
    if (analytics.tenantAvgOrderValue > 0) {
      const pctDiff = Math.abs(Math.round(analytics.comparedToAvg));
      const isAbove = analytics.comparedToAvg >= 0;
      result.push({
        type: isAbove ? 'positive' : 'neutral',
        icon: isAbove ? (
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-orange-500" />
        ),
        label: 'vs Store AOV',
        value: `${isAbove ? '+' : '-'}${pctDiff}%`,
        description: `${isAbove ? 'Above' : 'Below'} your store's average order of ${formatCurrency(analytics.tenantAvgOrderValue)}`,
      });
    }

    // Insight 3: Time of day
    result.push({
      type: 'info',
      icon: <Clock className="h-4 w-4 text-blue-500" />,
      label: 'Order Time',
      value: `${getTimePeriodPrefix(orderHour)} - ${analytics.timeOfDayLabel}`,
      description: `Placed at ${formatSmartDate(orderDate, { includeTime: true })}`,
    });

    // Insight 4: New products for this customer
    if (analytics.hasNewProducts && customerId) {
      result.push({
        type: 'info',
        icon: <Sparkles className="h-4 w-4 text-purple-500" />,
        label: 'New Products',
        value: `${analytics.newProductCount} new`,
        description: `Customer is trying ${analytics.newProductCount} product(s) they haven't ordered before`,
      });
    }

    // Insight 5: Customer loyalty indicator
    if (analytics.customerOrderCount > 5) {
      result.push({
        type: 'positive',
        icon: <Target className="h-4 w-4 text-emerald-500" />,
        label: 'Loyal Customer',
        value: `${analytics.customerOrderCount} orders`,
        description: `Total lifetime value: ${formatCurrency(analytics.customerTotalSpent)}`,
      });
    } else if (analytics.customerOrderCount === 1) {
      result.push({
        type: 'info',
        icon: <Package className="h-4 w-4 text-blue-500" />,
        label: 'First Order',
        value: 'New Customer',
        description: 'This is their first order with your store',
      });
    }

    return result;
  }, [analytics, customerId, orderCreatedAt, orderTotal]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Order Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !analytics) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Order Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Unable to load insights</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return null; // Don't show the card if there are no insights
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Order Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {insights.map((insight, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'p-3 rounded-lg border cursor-help transition-colors',
                      insight.type === 'positive' &&
                        'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10',
                      insight.type === 'neutral' &&
                        'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10',
                      insight.type === 'info' &&
                        'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {insight.icon}
                      <span className="text-xs font-medium text-muted-foreground">
                        {insight.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{insight.value}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">{insight.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Summary row for customer with history */}
          {analytics.customerOrderCount > 1 && (
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Customer Lifetime Value</span>
                <Badge variant="secondary" className="font-mono">
                  {formatCurrency(analytics.customerTotalSpent)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
