import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Package, ArrowRight, Users, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Badge } from "@/components/ui/badge";
import { formatSmartDate } from '@/lib/formatters';

interface TraceabilityViewProps {
  batchId: string | null;
  onBatchSelect: (batchId: string | null) => void;
}

export function TraceabilityView({
  batchId,
  onBatchSelect,
}: TraceabilityViewProps) {
  const [searchInput, setSearchInput] = useState("");
  const { tenant } = useTenantAdminAuth();

  const { data: traceData, refetch } = useQuery({
    queryKey: queryKeys.traceability.byBatch(batchId, tenant?.id),
    queryFn: async () => {
      if (!batchId) return null;

      const { data: products } = await supabase
        .from("products")
        .select("id, name, batch_number")
        .eq("tenant_id", tenant?.id)
        .eq("batch_number", batchId);

      if (!products || products.length === 0) return null;

      const productIds = products.map(p => p.id);
      
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("quantity, orders!inner(order_number, customer_name, status, created_at)")
        .in("product_id", productIds);

      const affectedOrders = orderItems?.length || 0;
      const affectedCustomers = new Set(orderItems?.map((item: { orders?: { customer_name?: string } }) => item.orders?.customer_name).filter(Boolean)).size;
      const totalUnits = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      return {
        batchId,
        products,
        orderItems,
        affectedOrders,
        affectedCustomers,
        totalUnits,
      };
    },
    enabled: !!batchId && !!tenant?.id,
  });

  const handleSearch = () => {
    if (searchInput.trim()) {
      onBatchSelect(searchInput.trim());
      refetch();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Traceability</CardTitle>
        <CardDescription>
          Track products from batch to customer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="batch_search">Search by Batch Number</Label>
          <div className="flex gap-2">
            <Input
              id="batch_search"
              placeholder="e.g., BD-2024-001"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="min-h-[44px] touch-manipulation"
            />
            <Button onClick={handleSearch} className="min-h-[44px] touch-manipulation">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        {traceData ? (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{traceData.totalUnits}</p>
                    <p className="text-sm text-muted-foreground">Units Sold</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{traceData.affectedOrders}</p>
                    <p className="text-sm text-muted-foreground">Orders</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{traceData.affectedCustomers}</p>
                    <p className="text-sm text-muted-foreground">Customers</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span className="font-medium">Batch</span>
              </div>
              <ArrowRight className="h-4 w-4" />
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-medium">Orders</span>
              </div>
              <ArrowRight className="h-4 w-4" />
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="font-medium">Customers</span>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Products in Batch</h3>
              <div className="space-y-2">
                {traceData.products.map((product: { id: string; name: string; batch_id?: string }) => (
                  <div key={product.id} className="p-3 border rounded-lg">
                    <p className="font-medium">{product.name}</p>
                    <Badge variant="outline" className="mt-1">{product.batch_id || "N/A"}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {traceData.orderItems && traceData.orderItems.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Order History</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {traceData.orderItems.map((item: { quantity: number; orders: { order_number: string; customer_name: string; status: string; created_at: string } }, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.orders.order_number}</p>
                          <p className="text-sm text-muted-foreground">{item.orders.customer_name}</p>
                        </div>
                        <Badge>{item.orders.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Qty: {item.quantity} | {formatSmartDate(item.orders.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : batchId ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No data found for batch: {batchId}</p>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter a batch number to view traceability</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
