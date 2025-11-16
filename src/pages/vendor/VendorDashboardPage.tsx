// @ts-nocheck - Purchase orders table types not yet regenerated
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Package,
  FileText,
  DollarSign,
  TrendingUp,
  Loader2,
  Eye,
} from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

export default function VendorDashboardPage() {
  // This would use a vendor auth context in a real implementation
  const vendorId = "current-vendor-id"; // Placeholder

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: queryKeys.vendor.purchaseOrders(vendorId),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("purchase_orders")
          .select("*")
          .eq("supplier_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error && error.code !== "42P01") {
          logger.error('Failed to fetch purchase orders', error, { component: 'VendorDashboardPage' });
          return [];
        }

        return data || [];
      } catch {
        return [];
      }
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            🏭 Vendor Portal
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            View purchase orders, upload invoices, and track payments
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active POs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders?.filter((po: any) => po.status === "pending" || po.status === "approved").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Purchase Orders</CardTitle>
          <CardDescription>
            View and manage purchase orders from your customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : purchaseOrders && purchaseOrders.length > 0 ? (
            <div className="space-y-2">
              {purchaseOrders.map((po: any) => (
                <div
                  key={po.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="text-sm font-medium">PO #{po.po_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(po.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No purchase orders found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

