import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function CashFlowProjection() {
  const { tenant } = useTenantAdminAuth();

  const { data: cashFlowData, isLoading } = useQuery({
    queryKey: ["cashflow-projection", tenant?.id],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount, created_at, status")
        .eq("tenant_id", tenant?.id)
        .eq("status", "delivered")
        .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true });

      const monthlyData = orders?.reduce((acc: Record<string, { month: string; revenue: number }>, order) => {
        const month = new Date(order.created_at).toLocaleDateString("en-US", { month: "short" });
        if (!acc[month]) acc[month] = { month, revenue: 0 };
        acc[month].revenue += Number(order.total_amount);
        return acc;
      }, {});

      const chartData = Object.values(monthlyData || {}) as { month: string; revenue: number }[];
      const avgMonthly = chartData.length > 0 
        ? chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length 
        : 0;

      return {
        chartData,
        projections: [
          { period: "30 days", amount: avgMonthly * 1.05, trend: "up" },
          { period: "60 days", amount: avgMonthly * 1.08, trend: "up" },
          { period: "90 days", amount: avgMonthly * 1.12, trend: "up" },
        ],
      };
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cashFlowData?.projections.map((proj: { period: string; amount: number; trend: string }) => (
          <Card key={proj.period}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{proj.period}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">${proj.amount.toFixed(0)}</span>
                {proj.trend === "up" ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historical Cash Flow</CardTitle>
          <CardDescription>Revenue trends over the last 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashFlowData?.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number | string) => `$${typeof value === 'number' ? value.toFixed(2) : value}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

