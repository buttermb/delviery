import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  TrendingUp,
  FileText,
  LogOut,
  CheckCircle,
  AlertTriangle,
  Package,
  FileUp,
  Settings,
  Bell,
  Search,
  Bug,
  MessageCircle,
  Building,
  Store,
  Receipt,
  BarChart3,
  ChevronDown
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AdminQuickStatsHeader } from "@/components/admin/AdminQuickStatsHeader";

const menuGroups = [
  {
    title: "Dashboard",
    items: [
      { title: "Overview", url: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Global Search", url: "/admin/search", icon: Search },
    ]
  },
  {
    title: "Inventory",
    items: [
      { title: "Products", url: "/admin/inventory/products", icon: Package },
      { title: "Fronted Inventory", url: "/admin/inventory/fronted", icon: Package },
      { title: "Dispatch", url: "/admin/inventory/dispatch", icon: Package },
      { title: "Analytics", url: "/admin/inventory/analytics", icon: BarChart3 },
    ]
  },
  {
    title: "Business Operations",
    items: [
      { title: "Order Management", url: "/admin/order-management", icon: Package },
      { title: "Locations", url: "/admin/locations", icon: Building },
      { title: "Vendors", url: "/admin/vendors", icon: Store },
      { title: "Team", url: "/admin/team", icon: Users },
      { title: "Invoices", url: "/admin/invoices", icon: Receipt },
      { title: "Reports", url: "/admin/reports", icon: BarChart3 }
    ]
  },
  {
    title: "Users & Security",
    items: [
      { title: "Live Chat Support", url: "/admin/live-chat", icon: MessageCircle },
      { title: "Users", url: "/admin/users", icon: Users },
      { title: "Age Verification", url: "/admin/age-verification", icon: CheckCircle },
      { title: "Compliance", url: "/admin/compliance", icon: Shield },
      { title: "Risk Factors", url: "/admin/risk-factors", icon: AlertTriangle },
    ]
  },
  {
    title: "System",
    items: [
      { title: "Analytics", url: "/admin/analytics", icon: TrendingUp },
      { title: "Audit Logs", url: "/admin/audit-logs", icon: FileText },
      { title: "Quick Export", url: "/admin/quick-export", icon: FileUp },
      { title: "Company Settings", url: "/admin/company-settings", icon: Settings },
      { title: "System Settings", url: "/admin/settings", icon: Settings },
      { title: "Test Notifications", url: "/admin/notifications", icon: Bell },
      { title: "Button Tester", url: "/admin/button-tester", icon: Bug },
      { title: "Bug Scanner", url: "/admin/bug-scanner", icon: Bug },
    ]
  }
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const { session } = useAdminAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/admin/login");
  };
  const location = useLocation();
  const isCollapsed = state === "collapsed";

  const isGroupActive = (items: typeof menuGroups[0]['items']) => {
    return items.some(item => location.pathname === item.url);
  };

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarHeader className="border-b p-4">
        {!isCollapsed && (
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Admin Portal</h2>
              <p className="text-sm text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <AdminQuickStatsHeader />
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((group) => (
          <Collapsible
            key={group.title}
            defaultOpen={isGroupActive(group.items)}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-muted/50 rounded-md px-2">
                  {!isCollapsed && <span>{group.title}</span>}
                  {!isCollapsed && (
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink 
                            to={item.url} 
                            end
                            className={({ isActive }) =>
                              isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            {!isCollapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <div className="mt-auto p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </Sidebar>
  );
}
