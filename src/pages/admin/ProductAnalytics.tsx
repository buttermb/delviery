import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, Eye, ShoppingCart, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProductAnalytics() {
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      return data;
    },
  });

  // Calculate top sellers
  const topSellers = products?.map((product) => {
    const productOrders = orders?.filter((order) =>
      order.order_items?.some((item: any) => item.product_id === product.id)
    ) || [];
    
    const totalSold = productOrders.reduce((sum, order) => {
      const item = order.order_items?.find((i: any) => i.product_id === product.id);
      return sum + (item?.quantity || 0);
    }, 0);
    
    const revenue = productOrders.reduce((sum, order) => {
      const item = order.order_items?.find((i: any) => i.product_id === product.id);
      return sum + (item?.price || 0) * (item?.quantity || 1);
    }, 0);

    return {
      ...product,
      totalSold,
      revenue,
    };
  }).sort((a, b) => b.totalSold - a.totalSold).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Product Performance</h1>
        <p className="text-muted-foreground">Last 30 days</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-3xl font-bold">{products?.length || 0}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Products</p>
              <p className="text-3xl font-bold">
                {products?.filter((p) => p.in_stock).length || 0}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-3xl font-bold">{orders?.length || 0}</p>
            </div>
            <Eye className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-3xl font-bold">
                ${orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0).toFixed(0) || 0}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Top Sellers */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Top Selling Products</h2>
        <div className="space-y-4">
          {topSellers?.map((product, index) => (
            <div key={product.id} className="flex items-center gap-4">
              <span className="text-2xl font-bold text-muted-foreground w-8">
                {index + 1}
              </span>
              <img
                src={product.image_url || "/placeholder.svg"}
                alt={product.name}
                className="h-12 w-12 rounded object-cover"
              />
              <div className="flex-1">
                <p className="font-semibold">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {product.totalSold} sold • ${product.revenue.toFixed(2)} revenue
                </p>
              </div>
              <Badge variant={product.in_stock ? "default" : "secondary"}>
                {product.in_stock ? "Active" : "Inactive"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Low Performers */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Products Needing Attention</h2>
        <div className="space-y-4">
          {products
            ?.filter((p) => !p.in_stock || !p.image_url || !p.description)
            .slice(0, 5)
            .map((product) => (
              <div key={product.id} className="flex items-center gap-4">
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{product.name}</p>
                  <div className="flex gap-2 mt-1">
                    {!product.in_stock && (
                      <Badge variant="secondary">Out of Stock</Badge>
                    )}
                    {!product.image_url && (
                      <Badge variant="outline">Missing Image</Badge>
                    )}
                    {!product.description && (
                      <Badge variant="outline">No Description</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
