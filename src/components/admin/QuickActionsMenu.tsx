import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, DollarSign, Truck, BarChart3, Settings } from "lucide-react";

export function QuickActionsMenu() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const getFullPath = (href: string) => {
    if (!tenantSlug) return href;
    if (href.startsWith('/admin')) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const actions = [
    {
      icon: Package,
      label: "New Order",
      description: "Create wholesale order",
      path: "/admin/new-wholesale-order",
      color: "bg-emerald-500"
    },
    {
      icon: Users,
      label: "Clients",
      description: "Manage B2B clients",
      path: "/admin/wholesale-clients",
      color: "bg-blue-500"
    },
    {
      icon: DollarSign,
      label: "Financials",
      description: "Cash flow & P&L",
      path: "/admin/financial-center",
      color: "bg-purple-500"
    },
    {
      icon: Truck,
      label: "Fleet",
      description: "Runners & deliveries",
      path: "/admin/fleet-management",
      color: "bg-orange-500"
    },
    {
      icon: BarChart3,
      label: "Inventory",
      description: "Stock management",
      path: "/admin/wholesale-inventory-manage",
      color: "bg-cyan-500"
    },
    {
      icon: Settings,
      label: "Setup",
      description: "Initialize data",
      path: "/admin/wholesale-setup",
      color: "bg-muted"
    }
  ];

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.path}
              variant="outline"
              className="h-auto flex-col items-start p-4 hover:border-primary"
              onClick={() => navigate(getFullPath(action.path))}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`${action.color} p-2 rounded-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold">{action.label}</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                {action.description}
              </span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
