import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Package,
  ArrowRight,
  Settings,
  Building2,
  MessageSquare,
  Users,
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/formatters";
import { Link, useNavigate } from "react-router-dom";
import { MenuList } from "@/components/customer/MenuList";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { ModeSwitcher, ModeBanner } from "@/components/customer/ModeSwitcher";
import { CustomerProfileCard } from "@/components/customer/CustomerProfileCard";
import { CustomerPreferencesPanel } from "@/components/customer/CustomerPreferencesPanel";
import { STORAGE_KEYS, safeStorage } from "@/constants/storageKeys";

type CustomerMode = 'retail' | 'wholesale';

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { customer, tenant, logout } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;
  const [mode, setMode] = useState<CustomerMode>('retail');

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Fetch recent orders
  const { data: recentOrders } = useQuery({
    queryKey: queryKeys.customerDashboardOrders.byTenantCustomer(tenantId, customerId),
    queryFn: async () => {
      if (!tenantId || !customerId) return [];

      // orders table may not be in generated types — cast table name
      const { data } = await (supabase
        .from("orders" as "tenants") // cast to satisfy generated types
        .select("id, order_number, total_amount, status, created_at")
        .eq("tenant_id", tenantId)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5)) as { data: Array<{ id: string; order_number: string | null; total_amount: number; status: string; created_at: string }> | null };

      return data ?? [];
    },
    enabled: !!tenantId && !!customerId,
  });

  // Fetch marketplace profile to check if customer is a business buyer and verified
  const { data: marketplaceProfile } = useQuery({
    queryKey: queryKeys.customerMarketplaceProfileCheck.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("marketplace_profiles")
        .select("id, license_verified, marketplace_status, can_sell")
        .eq("tenant_id", tenantId)
        .eq("can_sell", false) // Only buyer profiles
        .maybeSingle();

      if (error) {
        // Ignore errors - not all customers are business buyers
        return null;
      }

      return data;
    },
    enabled: !!tenantId,
  });

  // Check if customer is a verified business buyer
  const isBusinessBuyer = !!marketplaceProfile;
  const isVerified = marketplaceProfile?.license_verified === true && marketplaceProfile?.marketplace_status === 'active';

  const handleLogout = async () => {
    await logout();
    navigate(`/${tenant?.slug}/shop/login`);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      delivered: { label: "Delivered", className: "bg-green-100 text-green-700 border-green-200" },
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      processing: { label: "Processing", className: "bg-blue-100 text-blue-700 border-blue-200" },
      cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
    };

    const config = statusConfig[status] || { label: status.toUpperCase(), className: "" };

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />
      
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-[hsl(var(--customer-border))] bg-white sticky top-0 z-50 shadow-sm safe-area-top">
        <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--customer-text))]">{tenant?.business_name || "Customer Portal"}</h1>
            <p className="text-sm text-[hsl(var(--customer-text-light))]">
              Welcome back, {customer?.first_name || customer?.email}! 👋
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ModeSwitcher 
              currentMode={mode} 
              onModeChange={setMode}
              isBusinessBuyer={isBusinessBuyer}
              isVerified={isVerified}
            />
            <Button variant="ghost" asChild className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]">
              <Link to={`/${tenant?.slug}/shop/settings`}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-screen-2xl mx-auto pb-20 lg:pb-6">
        {/* Mode Banner (Mobile) */}
        <div className="lg:hidden">
          <ModeBanner
            currentMode={mode}
            onModeChange={setMode}
            isBusinessBuyer={isBusinessBuyer}
            isVerified={isVerified}
          />
        </div>

        {/* Customer Profile and Preferences Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Unified Customer Profile Card */}
          <CustomerProfileCard showSettings={true} />

          {/* Customer Preferences Panel (Wishlist, History, Preferences) */}
          <CustomerPreferencesPanel defaultTab="wishlist" />
        </div>

        {/* Wholesale Marketplace Quick Access */}
        <Card className="bg-slate-50 border-primary/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[hsl(var(--customer-primary))]" />
                Wholesale Marketplace
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="text-[hsl(var(--customer-primary))]"
              >
                <Link to={`/${tenant?.slug}/shop/wholesale`}>
                  Browse <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[hsl(var(--customer-text-light))] mb-3">
              Shop wholesale products from verified suppliers
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="border-[hsl(var(--customer-primary))]/30 text-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-primary))]/10"
              >
                <Link to={`/${tenant?.slug}/shop/wholesale`}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Browse Marketplace
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))]"
              >
                <Link to={`/${tenant?.slug}/shop/wholesale/orders`}>
                  <Package className="h-4 w-4 mr-2" />
                  Wholesale Orders
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Community Forum Banner */}
        <Card className="bg-slate-50(var(--customer-accent))]/10 (var(--customer-accent))]/5 border-[hsl(var(--customer-accent))]/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                <Users className="h-5 w-5 text-[hsl(var(--customer-accent))]" />
                Community Forum
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="text-[hsl(var(--customer-accent))]"
              >
                <Link to="/community">
                  Join <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[hsl(var(--customer-text-light))] mb-3">
              Connect with the community, share experiences, and discover tips
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="border-[hsl(var(--customer-accent))]/30 text-[hsl(var(--customer-accent))] hover:bg-[hsl(var(--customer-accent))]/10"
              >
                <Link to="/community">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Browse Discussions
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))]"
              >
                <Link to="/community/new">
                  <Users className="h-4 w-4 mr-2" />
                  Create Post
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Retail Shopping Quick Access */}
        <Card className="bg-slate-50 border-secondary/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[hsl(var(--customer-secondary))]" />
                Retail Shopping
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="text-[hsl(var(--customer-secondary))]"
              >
                <Link to={`/${tenant?.slug}/shop/retail/businesses`}>
                  Browse <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[hsl(var(--customer-text-light))] mb-3">
              Shop from local dispensaries and businesses
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="border-[hsl(var(--customer-secondary))]/30 text-[hsl(var(--customer-secondary))] hover:bg-[hsl(var(--customer-secondary))]/10"
              >
                <Link to={`/${tenant?.slug}/shop/retail/businesses`}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Find Businesses
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))]"
              >
                <Link to={`/${tenant?.slug}/shop/orders`}>
                  <Package className="h-4 w-4 mr-2" />
                  Retail Orders
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Menus */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--customer-text))]">📱 Available Menus</CardTitle>
              <Button variant="ghost" size="sm" className="text-[hsl(var(--customer-primary))]">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MenuList />
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--customer-text))]">🛒 Recent Orders</CardTitle>
              {recentOrders && recentOrders.length > 0 && (
                <Button variant="ghost" size="sm" asChild className="text-[hsl(var(--customer-primary))]">
                  <Link to={`/${tenant?.slug}/shop/orders`}>
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border border-[hsl(var(--customer-border))] rounded-lg hover:bg-[hsl(var(--customer-surface))] hover:shadow-md cursor-pointer transition-colors card-lift"
                    onClick={() => navigate(`/${tenant?.slug}/shop/orders/${order.id}`)}
                  >
                    <div>
                      <p className="font-medium text-[hsl(var(--customer-text))]">#{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-[hsl(var(--customer-text-light))]">
                        {formatSmartDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-[hsl(var(--customer-text))]">{formatCurrency(order.total_amount ?? 0)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[hsl(var(--customer-surface))] mb-4">
                  <ShoppingBag className="h-10 w-10 text-[hsl(var(--customer-text-light))]" />
                </div>
                <p className="text-lg font-medium text-[hsl(var(--customer-text))] mb-2">No orders yet</p>
                <p className="text-sm text-[hsl(var(--customer-text-light))] mb-4">
                  Browse menus to place your first order
                </p>
                <Button className="bg-slate-50(var(--customer-primary))] (var(--customer-secondary))] hover:opacity-90 text-white">
                  Browse Menus <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />
    </div>
  );
}
