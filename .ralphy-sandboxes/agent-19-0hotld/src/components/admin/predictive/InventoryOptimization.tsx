import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function InventoryOptimization() {
  const { tenant } = useTenantAdminAuth();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: queryKeys.inventoryOptimization.byTenant(tenant?.id),
    queryFn: async () => {
      const { data: products } = await supabase
        .from("products")
        .select("name, stock_quantity, category")
        .eq("tenant_id", tenant?.id);

      return products?.map((product) => {
        const optimalStock = 50;
        const difference = product.stock_quantity - optimalStock;
        let status = "optimal";
        let action = "No action needed";
        
        if (difference < -20) {
          status = "critical";
          action = `Restock ${Math.abs(difference)} units immediately`;
        } else if (difference < 0) {
          status = "low";
          action = `Order ${Math.abs(difference)} units soon`;
        } else if (difference > 30) {
          status = "excess";
          action = `Consider reducing orders by ${difference} units`;
        }

        return {
          product: product.name,
          current: product.stock_quantity,
          optimal: optimalStock,
          status,
          action,
        };
      }).sort((a, b) => {
        const priority: Record<string, number> = { critical: 0, low: 1, excess: 2, optimal: 3 };
        return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
      });
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "critical":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Critical</Badge>;
      case "low":
        return <Badge variant="default" className="gap-1"><TrendingUp className="h-3 w-3" />Low Stock</Badge>;
      case "excess":
        return <Badge variant="secondary" className="gap-1"><Package className="h-3 w-3" />Excess</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3" />Optimal</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventory Optimization Recommendations</CardTitle>
          <CardDescription>
            AI-powered recommendations to optimize stock levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recommendations && recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec: { product: string; status: string; action: string; current: number; optimal: number }) => (
                <Card key={rec.product} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{rec.product}</span>
                        {getStatusBadge(rec.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Current: {rec.current} | Optimal: {rec.optimal}
                      </p>
                      <p className="text-sm font-medium mt-1">{rec.action}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products found.</p>
              <p className="text-sm mt-2">Add products to see optimization recommendations.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

