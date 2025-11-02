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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

const menuItems = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Disposable Menus",
    url: "/admin/disposable-menus",
    icon: Menu,
  },
  {
    title: "Menu Orders",
    url: "/admin/disposable-menu-orders",
    icon: ShoppingCart,
  },
  {
    title: "Menu Analytics",
    url: "/admin/menu-analytics",
    icon: TrendingUp,
  },
  {
    title: "Products",
    url: "/admin/inventory/products",
    icon: Package,
  },
  {
    title: "Customers",
    url: "/admin/big-plug-clients",
    icon: Users,
  },
  {
    title: "Generate Barcodes",
    url: "/admin/generate-barcodes",
    icon: Barcode,
  },
  {
    title: "Wholesale Orders",
    url: "/admin/wholesale-orders",
    icon: FileText,
  },
  {
    title: "Inventory",
    url: "/admin/inventory-dashboard",
    icon: Warehouse,
  },
  {
    title: "Reports",
    url: "/admin/reports",
    icon: BarChart3,
  },
  {
    title: "Billing",
    url: "/admin/billing",
    icon: CreditCard,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
];

export function TenantAdminSidebar() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const { tenant, logout } = useTenantAdminAuth();

  const isActive = (url: string) => {
    const fullPath = `/${tenantSlug}${url}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Sidebar>
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
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={`/${tenantSlug}${item.url}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
  );
}
