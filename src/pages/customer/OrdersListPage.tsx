import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { useNavigate } from "react-router-dom";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { prefetchOnHover } from "@/lib/utils/prefetch";

type _OrderStatus = "pending" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pending: {
      label: "Pending",
      icon: <Clock className="h-4 w-4" />,
      className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    accepted: {
      label: "Accepted",
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: "bg-blue-100 text-blue-700 border-blue-200",
    },
    preparing: {
      label: "Preparing",
      icon: <RefreshCw className="h-4 w-4" />,
      className: "bg-purple-100 text-purple-700 border-purple-200",
    },
    out_for_delivery: {
      label: "Out for Delivery",
      icon: <Truck className="h-4 w-4" />,
      className: "bg-indigo-100 text-indigo-700 border-indigo-200",
    },
    delivered: {
      label: "Delivered",
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: "bg-green-100 text-green-700 border-green-200",
    },
    cancelled: {
      label: "Cancelled",
      icon: <XCircle className="h-4 w-4" />,
      className: "bg-red-100 text-red-700 border-red-200",
    },
  };

  return (
    configs[status] || {
      label: status.toUpperCase(),
      icon: <Package className="h-4 w-4" />,
      className: "bg-gray-100 text-gray-700 border-gray-200",
    }
  );
};

const ORDERS_PER_PAGE = 10;

export default function OrdersListPage() {
  const navigate = useNavigate();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch all orders
  const { data: orders, isLoading } = useQuery({
    queryKey: queryKeys.customerAllOrders.byTenantCustomer(tenantId, customerId),
    queryFn: async (): Promise<Array<Record<string, unknown>>> => {
      if (!tenantId || !customerId) return [];

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && !!customerId,
  });

  // Pagination
  const totalOrders = orders?.length ?? 0;
  const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    if (!orders) return [];
    const start = (currentPage - 1) * ORDERS_PER_PAGE;
    return orders.slice(start, start + ORDERS_PER_PAGE);
  }, [orders, currentPage]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[hsl(var(--customer-primary))] mx-auto mb-4" />
          <p className="text-[hsl(var(--customer-text-light))]">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />
      
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-[hsl(var(--customer-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
              className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--customer-text))]">🛒 My Orders</h1>
              <p className="text-sm text-[hsl(var(--customer-text-light))]">
                View and track all your orders
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Mobile Header */}
        <div className="lg:hidden mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
            className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))] mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-[hsl(var(--customer-text))]">🛒 My Orders</h1>
          <p className="text-sm text-[hsl(var(--customer-text-light))] mt-1">
            {orders?.length ?? 0} order{orders?.length !== 1 ? "s" : ""} total
          </p>
        </div>

        {!orders || orders.length === 0 ? (
          <EnhancedEmptyState
            type="no_orders"
            title="No Orders Yet"
            description="You haven't placed any orders yet. Start shopping to see your orders here!"
            primaryAction={{
              label: "Browse Menus",
              onClick: () => navigate(`/${tenant?.slug}/shop/dashboard`),
            }}
            designSystem="customer"
          />
        ) : (
          <div className="space-y-4">
            {paginatedOrders.map((order) => {
              const statusConfig = getStatusConfig((order.status as string) || "pending");

              return (
                <Card
                  key={order.id as string}
                  className="bg-white border-[hsl(var(--customer-border))] shadow-sm hover:shadow-md transition-shadow card-lift"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Order Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-12 w-12 rounded-lg bg-slate-50(var(--customer-primary))] (var(--customer-secondary))] flex items-center justify-center">
                            <Package className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-[hsl(var(--customer-text))]">
                              Order #{(order.order_number as string) || (order.id as string).slice(0, 8)}
                            </h3>
                            <p className="text-sm text-[hsl(var(--customer-text-light))]">
                              {formatSmartDate(order.created_at as string | Date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <Badge
                            variant="outline"
                            className={`${statusConfig.className} flex items-center gap-1`}
                          >
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                          <span className="text-lg font-bold text-[hsl(var(--customer-text))]">
                            {formatCurrency(Number(order.total_amount) || 0)}
                          </span>
                        </div>

                        {order.delivery_address && (
                          <p className="text-sm text-[hsl(var(--customer-text-light))]">
                            📍 {String(order.delivery_address)}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onMouseEnter={() => {
                            if (tenant?.slug) {
                              prefetchOnHover(`/${tenant.slug}/shop/orders/${order.id}`);
                            }
                          }}
                          onClick={() => navigate(`/${tenant?.slug}/shop/orders/${order.id}`)}
                          className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
                        >
                          View Details
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-[hsl(var(--customer-text-light))]">
                  Showing {(currentPage - 1) * ORDERS_PER_PAGE + 1}-{Math.min(currentPage * ORDERS_PER_PAGE, totalOrders)} of {totalOrders}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="border-[hsl(var(--customer-border))]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-[hsl(var(--customer-text))] px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="border-[hsl(var(--customer-border))]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />
    </div>
  );
}

