import { NavLink, useParams, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  Package,
  Users,
  BarChart3,
  FileText,
  Barcode,
  ShoppingCart,
  CreditCard,
  Warehouse,
  TrendingUp,
  Lock,
  Star,
  Navigation,
  Diamond,
  Truck,
  MapPin,
  DollarSign,
  PieChart,
  Zap,
  Globe,
  HelpCircle,
  Bell,
  FolderKanban,
  Building,
  Shield,
  ClipboardList,
  Box,
  AlertCircle,
  ArrowRightLeft,
  Receipt,
  UserCog,
  Activity,
  FileSpreadsheet,
  Download,
  MapPinned,
  Building2,
  Key,
  ScrollText,
  Headphones,
  Store,
  Brain,
  LineChart,
  Image,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { UpgradeModal } from "./UpgradeModal";
import { useState } from "react";
import { type FeatureId } from "@/lib/featureConfig";

interface MenuItem {
  featureId: FeatureId;
  title: string;
  url: string;
  icon: any;
  tier: 'starter' | 'professional' | 'enterprise';
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Dashboard",
    items: [
      { featureId: "dashboard", title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard, tier: "starter" },
    ],
  },
  {
    label: "Products & Inventory",
    items: [
      { featureId: "products", title: "Products", url: "/admin/inventory/products", icon: Package, tier: "starter" },
      { featureId: "inventory-dashboard", title: "Inventory Overview", url: "/admin/inventory-dashboard", icon: Warehouse, tier: "starter" },
      { featureId: "generate-barcodes", title: "Generate Barcodes", url: "/admin/generate-barcodes", icon: Barcode, tier: "starter" },
      { featureId: "advanced-inventory", title: "Advanced Inventory", url: "/admin/advanced-inventory", icon: Box, tier: "professional" },
      { featureId: "stock-alerts", title: "Stock Alerts", url: "/admin/stock-alerts", icon: AlertCircle, tier: "professional" },
      { featureId: "inventory-transfers", title: "Inventory Transfers", url: "/admin/inventory-transfers", icon: ArrowRightLeft, tier: "professional" },
      { featureId: "fronted-inventory", title: "Fronted Inventory", url: "/admin/fronted-inventory", icon: ClipboardList, tier: "professional" },
      { featureId: "products", title: "Receiving & Packaging", url: "/admin/operations/receiving", icon: Warehouse, tier: "professional" },
      { featureId: "products", title: "Images & Media", url: "/admin/catalog/images", icon: Image, tier: "professional" },
      { featureId: "products", title: "Batches & Lots", url: "/admin/catalog/batches", icon: Tag, tier: "professional" },
      { featureId: "products", title: "Categories & Tags", url: "/admin/catalog/categories", icon: Tag, tier: "professional" },
    ],
  },
  {
    label: "Menus & Orders",
    items: [
      { featureId: "disposable-menus", title: "Disposable Menus", url: "/admin/disposable-menus", icon: Menu, tier: "starter" },
      { featureId: "basic-orders", title: "Menu Orders", url: "/admin/disposable-menu-orders", icon: ShoppingCart, tier: "starter" },
      { featureId: "wholesale-orders", title: "Wholesale Orders", url: "/admin/wholesale-orders", icon: FileText, tier: "starter" },
      { featureId: "live-orders", title: "Live Orders Dashboard", url: "/admin/live-orders", icon: Activity, tier: "professional" },
      { featureId: "order-analytics", title: "Order Analytics", url: "/admin/order-analytics", icon: PieChart, tier: "professional" },
    ],
  },
  {
    label: "Customers",
    items: [
      { featureId: "customers", title: "Customers", url: "/admin/big-plug-clients", icon: Users, tier: "starter" },
      { featureId: "customer-analytics", title: "Customer Analytics", url: "/admin/customer-analytics", icon: BarChart3, tier: "professional" },
      { featureId: "customer-insights", title: "Customer Insights", url: "/admin/customer-insights", icon: TrendingUp, tier: "professional" },
    ],
  },
  {
    label: "Analytics & Reports",
    items: [
      { featureId: "reports", title: "Basic Reports", url: "/admin/reports", icon: FileSpreadsheet, tier: "starter" },
      { featureId: "menu-analytics", title: "Menu Analytics", url: "/admin/menu-analytics", icon: BarChart3, tier: "professional" },
      { featureId: "disposable-menu-analytics", title: "Disposable Menu Analytics", url: "/admin/disposable-menu-analytics", icon: PieChart, tier: "professional" },
      { featureId: "sales-dashboard", title: "Sales Dashboard", url: "/admin/sales-dashboard", icon: DollarSign, tier: "professional" },
      { featureId: "analytics", title: "Analytics", url: "/admin/analytics/comprehensive", icon: BarChart3, tier: "professional" },
      { featureId: "advanced-analytics", title: "Advanced Analytics", url: "/admin/advanced-analytics", icon: TrendingUp, tier: "enterprise" },
      { featureId: "realtime-dashboard", title: "Realtime Dashboard", url: "/admin/realtime-dashboard", icon: Activity, tier: "enterprise" },
      { featureId: "custom-reports", title: "Custom Reports", url: "/admin/custom-reports", icon: FileText, tier: "enterprise" },
    ],
  },
  {
    label: "Financial",
    items: [
      { featureId: "billing", title: "Billing", url: "/admin/billing", icon: CreditCard, tier: "starter" },
      { featureId: "invoice-management", title: "Financial Center", url: "/admin/financial-center", icon: DollarSign, tier: "professional" },
      { featureId: "commission-tracking", title: "Commission Tracking", url: "/admin/commission-tracking", icon: DollarSign, tier: "professional" },
      { featureId: "revenue-reports", title: "Revenue Reports", url: "/admin/revenue-reports", icon: TrendingUp, tier: "professional" },
      { featureId: "invoice-management", title: "Advanced Invoice", url: "/admin/advanced-invoice", icon: Receipt, tier: "professional" },
    ],
  },
  {
    label: "Delivery & Fleet",
    items: [
      { featureId: "delivery-management", title: "Delivery Management", url: "/admin/delivery-management", icon: Truck, tier: "enterprise" },
      { featureId: "fleet-management", title: "Fleet Management", url: "/admin/fleet-management", icon: Building2, tier: "enterprise" },
      { featureId: "live-map", title: "Live Map Tracking", url: "/admin/live-map", icon: MapPin, tier: "enterprise" },
      { featureId: "fleet-management", title: "GPS Tracking & Replay", url: "/admin/gps-tracking", icon: Navigation, tier: "enterprise" },
      { featureId: "route-optimization", title: "Route Optimizer", url: "/admin/route-optimizer", icon: MapPinned, tier: "enterprise" },
      { featureId: "delivery-analytics", title: "Delivery Analytics", url: "/admin/delivery-analytics", icon: BarChart3, tier: "enterprise" },
    ],
  },
  {
    label: "Point of Sale",
    items: [
      { featureId: "pos-system", title: "POS System", url: "/admin/pos-system", icon: Store, tier: "enterprise" },
      { featureId: "cash-register", title: "Cash Register", url: "/admin/cash-register", icon: DollarSign, tier: "enterprise" },
      { featureId: "pos-analytics", title: "POS Analytics", url: "/admin/pos-analytics", icon: PieChart, tier: "enterprise" },
    ],
  },
  {
    label: "Team & Locations",
    items: [
      { featureId: "team-members", title: "Staff Management", url: "/admin/staff-management", icon: Users, tier: "professional" },
      { featureId: "role-management", title: "Role Management", url: "/admin/role-management", icon: UserCog, tier: "professional" },
      { featureId: "activity-logs", title: "Activity Logs", url: "/admin/activity-logs", icon: ScrollText, tier: "professional" },
      { featureId: "locations", title: "Locations", url: "/admin/locations", icon: Building, tier: "enterprise" },
      { featureId: "locations", title: "Warehouses", url: "/admin/locations/warehouses", icon: Warehouse, tier: "enterprise" },
      { featureId: "locations", title: "Runners & Vehicles", url: "/admin/locations/runners", icon: Truck, tier: "enterprise" },
      { featureId: "location-analytics", title: "Location Analytics", url: "/admin/location-analytics", icon: MapPin, tier: "enterprise" },
      { featureId: "user-management", title: "User Management", url: "/admin/user-management", icon: UserCog, tier: "enterprise" },
      { featureId: "permissions", title: "Permissions", url: "/admin/permissions", icon: Key, tier: "enterprise" },
    ],
  },
  {
    label: "Integrations & Automation",
    items: [
      { featureId: "bulk-operations", title: "Bulk Operations", url: "/admin/bulk-operations", icon: FolderKanban, tier: "professional" },
      { featureId: "notifications", title: "Notifications", url: "/admin/notifications", icon: Bell, tier: "professional" },
      { featureId: "ai", title: "Local AI", url: "/admin/local-ai", icon: Brain, tier: "enterprise" },
      { featureId: "api-access", title: "API Access", url: "/admin/api-access", icon: Zap, tier: "enterprise" },
      { featureId: "webhooks", title: "Webhooks", url: "/admin/webhooks", icon: Activity, tier: "enterprise" },
      { featureId: "custom-integrations", title: "Custom Integrations", url: "/admin/custom-integrations", icon: Zap, tier: "enterprise" },
      { featureId: "automation", title: "Workflow Automation", url: "/admin/workflow-automation", icon: Zap, tier: "enterprise" },
      { featureId: "data-export", title: "Data Export", url: "/admin/data-export", icon: Download, tier: "enterprise" },
    ],
  },
  {
    label: "Security & Compliance",
    items: [
      { featureId: "audit-trail", title: "Audit Trail", url: "/admin/audit-trail", icon: ScrollText, tier: "enterprise" },
      { featureId: "compliance", title: "Compliance", url: "/admin/compliance", icon: Shield, tier: "enterprise" },
    ],
  },
  {
    label: "Branding & Customization",
    items: [
      { featureId: "white-label", title: "White Label", url: "/admin/white-label", icon: Globe, tier: "enterprise" },
      { featureId: "custom-domain", title: "Custom Domain", url: "/admin/custom-domain", icon: Globe, tier: "enterprise" },
    ],
  },
  {
    label: "Settings & Support",
    items: [
      { featureId: "settings", title: "Settings", url: "/admin/settings", icon: Settings, tier: "starter" },
      { featureId: "help", title: "Help & Support", url: "/admin/help", icon: HelpCircle, tier: "starter" },
      { featureId: "priority-support", title: "24/7 Priority Support", url: "/admin/priority-support", icon: Headphones, tier: "enterprise" },
    ],
  },
];

export function TenantAdminSidebar() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const { tenant, logout } = useTenantAdminAuth();
  const { canAccess, currentTier } = useFeatureAccess();
  const [upgradeFeatureId, setUpgradeFeatureId] = useState<FeatureId | null>(null);

  // Debug logging - remove in production
  // log.debug('TenantAdminSidebar:', {
  //   currentTier,
  //   subscriptionPlan: tenant?.subscription_plan,
  //   tenantSlug,
  // });

  // Guard against missing tenant slug
  if (!tenantSlug) {
    console.error('TenantAdminSidebar rendered without tenantSlug');
    return null;
  }

  const isActive = (url: string) => {
    const fullPath = `/${tenantSlug}${url}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleLockedItemClick = (featureId: FeatureId) => {
    setUpgradeFeatureId(featureId);
  };

  const getTierBadge = (tier: 'starter' | 'professional' | 'enterprise') => {
    if (tier === 'enterprise') {
      return (
        <Badge variant="outline" className="ml-auto flex items-center gap-1 text-xs border-purple-500 text-purple-700 dark:text-purple-300">
          <Diamond className="h-3 w-3" />
          Enterprise
        </Badge>
      );
    }
    if (tier === 'professional') {
      return (
        <Badge variant="outline" className="ml-auto flex items-center gap-1 text-xs border-blue-500 text-blue-700 dark:text-blue-300">
          <Star className="h-3 w-3" />
          Pro
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
      <Sidebar data-tutorial="navigation-sidebar">
        <SidebarHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">
              {tenant?.slug?.charAt(0).toUpperCase() || "T"}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{tenant?.slug || "Tenant Admin"}</span>
              <span className="text-xs text-muted-foreground">Admin Panel</span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          {menuGroups.map((group) => {
            const hasActiveItem = group.items.some(item => isActive(item.url));
            
            return (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const hasAccess = canAccess(item.featureId);
                      const itemIsActive = isActive(item.url);
                      
                      return (
                        <SidebarMenuItem key={`${group.label}-${item.url}`}>
                          {hasAccess ? (
                            <SidebarMenuButton asChild isActive={itemIsActive}>
                              <NavLink to={`/${tenantSlug}${item.url}`}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          ) : (
                            <SidebarMenuButton
                              onClick={() => handleLockedItemClick(item.featureId)}
                              className="cursor-pointer opacity-60 hover:opacity-100"
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                              {getTierBadge(item.tier)}
                            </SidebarMenuButton>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>

        <SidebarFooter className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </SidebarFooter>
      </Sidebar>

      {upgradeFeatureId && (
        <UpgradeModal
          open={!!upgradeFeatureId}
          onOpenChange={(open) => !open && setUpgradeFeatureId(null)}
          featureId={upgradeFeatureId}
        />
      )}
    </>
  );
}
