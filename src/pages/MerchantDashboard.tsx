import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Package, DollarSign, TrendingUp, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MerchantDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isMerchant, setIsMerchant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  useEffect(() => {
    const checkMerchant = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("merchants")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      setIsMerchant(!!data && !error);
      setMerchantId(data?.id || null);
      setLoading(false);
    };

    checkMerchant();
  }, [user]);

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["merchant-orders", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*,products(*)), addresses(*), profiles!orders_user_id_fkey(phone)")
        .eq("merchant_id", merchantId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isMerchant && !!merchantId,
  });

  const { data: stats } = useQuery({
    queryKey: ["merchant-stats", merchantId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [allOrders, todayOrders, inventory] = await Promise.all([
        supabase
          .from("orders")
          .select("total_amount, status")
          .eq("merchant_id", merchantId!),
        supabase
          .from("orders")
          .select("total_amount")
          .eq("merchant_id", merchantId!)
          .gte("created_at", today.toISOString()),
        supabase
          .from("inventory")
          .select("stock")
          .eq("merchant_id", merchantId!),
      ]);

      const totalRevenue =
        allOrders.data?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const todayRevenue =
        todayOrders.data?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const activeOrders = allOrders.data?.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length || 0;
      const lowStock = inventory.data?.filter((i) => i.stock < 10).length || 0;

      return {
        totalRevenue,
        todayRevenue,
        activeOrders,
        lowStock,
      };
    },
    enabled: isMerchant && !!merchantId,
  });

  const acceptOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "accepted" })
        .eq("id", orderId);
      if (error) throw error;

      await supabase.from("order_tracking").insert({
        order_id: orderId,
        status: "accepted",
        message: "Order accepted by merchant",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      toast({ title: "Order accepted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to accept order", variant: "destructive" });
    },
  });

  const startPreparing = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "preparing" })
        .eq("id", orderId);
      if (error) throw error;

      await supabase.from("order_tracking").insert({
        order_id: orderId,
        status: "preparing",
        message: "Order is being prepared",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      toast({ title: "Order marked as preparing" });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "accepted":
        return "default";
      case "preparing":
        return "default";
      case "out_for_delivery":
        return "default";
      case "delivered":
        return "default";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !isMerchant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You need merchant access to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Merchant Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalRevenue.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.todayRevenue.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeOrders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.lowStock || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {ordersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {orders
                ?.filter((o) => o.status === "pending")
                .map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">Order #{order.order_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <h4 className="font-medium">Items:</h4>
                        {order.order_items.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>
                              {item.products.name} x{item.quantity}
                            </span>
                            <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t">
                        <p className="font-semibold">Total: ${order.total_amount}</p>
                        <p className="text-sm text-muted-foreground">Payment: {order.payment_method}</p>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => acceptOrder.mutate(order.id)}
                          disabled={acceptOrder.isPending}
                        >
                          Accept Order
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

              {orders?.filter((o) => o.status === "pending").length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No pending orders</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-4">
            {orders
              ?.filter((o) => ["accepted", "preparing", "out_for_delivery"].includes(o.status))
              .map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">Order #{order.order_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      {order.order_items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>
                            {item.products.name} x{item.quantity}
                          </span>
                          <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {order.status === "accepted" && (
                      <Button size="sm" onClick={() => startPreparing.mutate(order.id)}>
                        Start Preparing
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="grid gap-4">
            {orders
              ?.filter((o) => ["delivered", "cancelled"].includes(o.status))
              .map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">Order #{order.order_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                        <p className="font-semibold mt-2">${order.total_amount}</p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MerchantDashboard;
