import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, Phone, Truck, Package } from "lucide-react";
import { LiveDeliveryMap } from "@/components/admin/LiveDeliveryMap";
import { SEOHead } from "@/components/SEOHead";

import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

export default function DeliveryTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();

  // Fetch delivery details
  const { data: delivery, isLoading } = useQuery({
    queryKey: ["delivery", id],
    queryFn: async () => {
      if (!tenant) return null;

      const { data, error } = await supabase
        .from("wholesale_deliveries")
        .select(`
          *,
          runners:wholesale_runners(full_name, phone, vehicle_type, rating),
          orders:wholesale_orders(order_number, total_amount, delivery_address, delivery_notes)
        `)
        .eq("id", id)
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenant,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      assigned: "bg-accent/10 text-accent-foreground border-accent/20",
      picked_up: "bg-orange-500/10 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-700",
      in_transit: "bg-primary/10 text-primary border-primary/20",
      delivered: "bg-primary/10 text-primary border-primary/20"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading delivery details...</p>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <p className="text-muted-foreground">Delivery not found</p>
          <Button onClick={() => navigate("/admin/fleet-management")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Fleet Management
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <SEOHead title="Live Delivery Tracking | Admin" description="Track delivery in real-time" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/admin/fleet-management")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Live Delivery Tracking</h1>
            <p className="text-sm text-muted-foreground">
              Order #{delivery.orders?.order_number}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(delivery.status)}>
          {delivery.status === "in_transit" && "🔴 IN TRANSIT"}
          {delivery.status === "picked_up" && "📦 PICKED UP"}
          {delivery.status === "assigned" && "📋 ASSIGNED"}
          {delivery.status === "delivered" && "✅ DELIVERED"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-2">
          <LiveDeliveryMap deliveryId={id} showAll={false} />
        </div>

        {/* Delivery Details */}
        <div className="space-y-4">
          {/* Runner Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Runner Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold">{delivery.runners?.full_name || "Not assigned"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vehicle</p>
                <p className="font-medium">{delivery.runners?.vehicle_type || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rating</p>
                <p className="font-medium">⭐ {delivery.runners?.rating || "5.0"}</p>
              </div>
              {delivery.runners?.phone && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = `tel:${delivery.runners.phone}`}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Call Runner
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Delivery Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Destination</p>
                <div className="flex items-start gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="font-medium">{delivery.orders?.delivery_address || "Address pending"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Value</p>
                <p className="font-semibold text-lg">
                  ${Number(delivery.orders?.total_amount || 0).toLocaleString()}
                </p>
              </div>
              {delivery.orders?.delivery_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1 p-2 bg-muted/50 rounded">{delivery.orders.delivery_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
