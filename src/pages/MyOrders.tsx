import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomerLayout from "@/layouts/CustomerLayout";
import { ShoppingBag, Package } from "lucide-react";
import { QuickReorderButton } from "@/components/QuickReorderButton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/PullToRefresh";
import { haptics } from "@/utils/haptics";
import { EmptyState } from "@/components/EmptyState";
import { OrderCardSkeleton } from "@/components/SkeletonLoader";

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Define fetchOrders function - used by both useEffect and PullToRefresh
  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // First try with join
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            product_id,
            quantity,
            selected_weight
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        // If join fails, try without join as fallback
        console.warn("Order items join failed, fetching orders without items:", error);
        
        // Check if it's an RLS/permission error for order_items
        const isRLSError = error.message?.toLowerCase().includes('permission') || 
                          error.message?.toLowerCase().includes('policy') ||
                          error.code === 'PGRST116' || error.code === '42501';
        
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (ordersError) throw ordersError;
        
        // Only try to fetch order_items if it wasn't an RLS/permission error
        // 400 Bad Request often indicates RLS blocking the query
        if (!isRLSError && error.code !== 'PGRST301' && ordersData && ordersData.length > 0) {
          const orderIds = ordersData.map(o => o.id);
          
          try {
            // Batch fetch all order items in one query using .in() for better performance
            const { data: itemsData, error: itemsError } = await supabase
              .from("order_items")
              .select("order_id, product_id, quantity, selected_weight")
              .in("order_id", orderIds);
            
            // Check for 400 Bad Request - means we can't access order_items due to RLS
            if (itemsError) {
              const isBadRequest = (itemsError as any).code === 'PGRST301' || 
                                  itemsError.message?.includes('400') ||
                                  (itemsError as any).status === 400;
              if (isBadRequest) {
                console.warn("Cannot access order_items (likely RLS restriction), showing orders without items");
              } else {
                console.warn("Failed to fetch order items:", itemsError);
              }
            } else if (itemsData) {
              // Successfully fetched items - combine with orders
              const ordersWithItems = ordersData.map((order) => ({
                ...order,
                order_items: itemsData.filter((item: any) => item.order_id === order.id) || []
              }));
              setOrders(ordersWithItems);
              haptics.light();
              return; // Exit early on success
            }
          } catch (itemsErr: any) {
            // Check if it's a 400 error
            const isBadRequest = itemsErr?.code === 'PGRST301' || 
                                itemsErr?.message?.includes('400') ||
                                itemsErr?.status === 400;
            if (isBadRequest) {
              console.warn("Order items query blocked (RLS/permissions), showing orders without items");
            } else {
              console.warn("Failed to fetch order items:", itemsErr);
            }
            // Continue to show orders without items
          }
        } else {
          // RLS error detected - skip order_items fetch entirely
          console.info("Skipping order_items fetch due to RLS restrictions");
        }
        
        // If order_items fetch failed or was skipped, show orders without items
        const ordersWithoutItems = (ordersData || []).map(order => ({
          ...order,
          order_items: [] // Empty array - orders will display but without item details
        }));
        
        setOrders(ordersWithoutItems);
        haptics.light();
        return;
      }
      
      // Original query succeeded with join
      setOrders(data || []);
      
      haptics.light(); // Light feedback on successful refresh
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error loading orders",
        description: error.message || "Could not load your order history. Please try refreshing.",
        variant: "destructive",
      });
      haptics.error(); // Error feedback
      // Set empty array on error to prevent stale data
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    fetchOrders();

    // Realtime subscription for order updates
    const channel = supabase
      .channel('user-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Order updated:', payload);
          fetchOrders();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to order updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate, fetchOrders]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "yellow",
      accepted: "blue",
      preparing: "blue",
      out_for_delivery: "purple",
      delivered: "green",
      cancelled: "red",
    };
    return colors[status] || "default";
  };

  const filterOrders = (status?: string) => {
    if (!status || status === "all") return orders;
    if (status === "active") {
      return orders.filter(order => 
        ["pending", "accepted", "preparing", "out_for_delivery"].includes(order.status)
      );
    }
    if (status === "completed") {
      return orders.filter(order => order.status === "delivered");
    }
    if (status === "cancelled") {
      return orders.filter(order => order.status === "cancelled");
    }
    return orders;
  };

  const filteredOrders = filterOrders(filter);

  if (loading) {
    return (
      <CustomerLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <PullToRefresh onRefresh={fetchOrders}>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <h1 className="text-3xl font-bold mb-6">My Orders</h1>

          <Tabs defaultValue="all" onValueChange={(value) => {
            haptics.selection(); // Selection feedback
            setFilter(value);
          }}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value={filter}>
              {filteredOrders.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={filter === 'all' ? 'No Orders Yet' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Orders`}
                  description={filter === 'all' ? 'Start shopping to see your orders here.' : `You don't have any ${filter} orders.`}
                  action={{
                    label: 'Start Shopping',
                    onClick: () => {
                      haptics.medium();
                      navigate('/');
                    }
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <Card key={order.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </CardTitle>
                        <Badge variant={getStatusColor(order.status) as any}>
                          {(order.status || 'pending').replace("_", " ")}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Date</p>
                            <p className="font-semibold">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total</p>
                            <p className="font-semibold">${Number(order.total_amount).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Delivery</p>
                            <p className="font-semibold">{order.delivery_borough}</p>
                          </div>
                          <div className="flex items-end justify-end gap-2">
                            {order.order_items && order.order_items.length > 0 && (
                              <QuickReorderButton
                                orderId={order.id}
                                orderItems={order.order_items}
                              />
                            )}
                            <Button
                              variant="outline"
                              onClick={() => {
                                haptics.light();
                                navigate(`/track/${order.tracking_code || order.id}`);
                              }}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </PullToRefresh>
    </CustomerLayout>
  );
}
