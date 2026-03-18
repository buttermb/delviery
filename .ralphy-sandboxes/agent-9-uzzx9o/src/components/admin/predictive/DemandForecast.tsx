import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function DemandForecast() {
  const { tenant } = useTenantAdminAuth();

  const { data: forecastData, isLoading } = useQuery({
    queryKey: queryKeys.demandForecast.byTenant(tenant?.id),
    queryFn: async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, quantity, orders!inner(created_at, tenant_id)")
        .eq("orders.tenant_id", tenant?.id)
        .gte("orders.created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString());

      const productDemand = items?.reduce((acc: Record<string, { product: string; current: number; forecast: number }>, item) => {
        if (!acc[item.product_name]) {
          acc[item.product_name] = { product: item.product_name, current: 0, forecast: 0 };
        }
        acc[item.product_name].current += item.quantity;
        acc[item.product_name].forecast = Math.round(acc[item.product_name].current * 1.15);
        return acc;
      }, {});

      return Object.values(productDemand || {}).slice(0, 10);
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Demand Forecasting</CardTitle>
          <CardDescription>
            Top 10 products with demand predictions based on historical sales
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forecastData && forecastData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product" angle={-45} textAnchor="end" height={120} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="current" fill="hsl(var(--primary))" name="Current Demand" />
                <Bar dataKey="forecast" fill="hsl(var(--accent))" name="Forecasted (+15%)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales data available yet.</p>
              <p className="text-sm mt-2">Complete some orders to see demand forecasts.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

