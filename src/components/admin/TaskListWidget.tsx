import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  type: "approval" | "expiring" | "overdue";
  path: string;
  count?: number;
}

interface TaskListWidgetProps {
  className?: string;
}

export function TaskListWidget({ className }: TaskListWidgetProps) {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!tenant?.id) return;

      setIsLoading(true);

      try {
        const taskList: Task[] = [];

        // Check for pending orders (approvals needed)
        const { count: pendingOrders } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "pending");

        if (pendingOrders && pendingOrders > 0) {
          taskList.push({
            id: "pending-orders",
            title: "Pending Orders",
            description: `${pendingOrders} order${pendingOrders > 1 ? "s" : ""} awaiting approval`,
            priority: "high",
            type: "approval",
            path: `/${tenant.slug}/admin/orders?status=pending`,
            count: pendingOrders,
          });
        }

        // Check for expiring menus (within 7 days)
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const { count: expiringMenus } = await supabase
          .from("disposable_menus")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .lte("expires_at", sevenDaysFromNow.toISOString())
          .gte("expires_at", new Date().toISOString());

        if (expiringMenus && expiringMenus > 0) {
          taskList.push({
            id: "expiring-menus",
            title: "Expiring Menus",
            description: `${expiringMenus} menu${expiringMenus > 1 ? "s" : ""} expire soon`,
            priority: "medium",
            type: "expiring",
            path: `/${tenant.slug}/admin/disposable-menus`,
            count: expiringMenus,
          });
        }

        // Check for low stock products
        const { count: lowStock } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .lte("stock_quantity", 5)
          .gt("stock_quantity", 0);

        if (lowStock && lowStock > 0) {
          taskList.push({
            id: "low-stock",
            title: "Low Stock Alert",
            description: `${lowStock} product${lowStock > 1 ? "s" : ""} running low`,
            priority: "medium",
            type: "expiring",
            path: `/${tenant.slug}/admin/inventory-hub?tab=products`,
            count: lowStock,
          });
        }

        // Check for overdue invoices (if invoices table exists)
        const { count: overdueInvoices } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "overdue");

        if (overdueInvoices && overdueInvoices > 0) {
          taskList.push({
            id: "overdue-invoices",
            title: "Overdue Invoices",
            description: `${overdueInvoices} invoice${overdueInvoices > 1 ? "s" : ""} overdue`,
            priority: "high",
            type: "overdue",
            path: `/${tenant.slug}/admin/invoices?status=overdue`,
            count: overdueInvoices,
          });
        }

        setTasks(taskList);
      } catch (error) {
        logger.error("Failed to fetch tasks", error, {
          component: "TaskListWidget",
        });
        // Don't show error to user, just log it
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [tenant?.id, tenant?.slug]);

  const getPriorityConfig = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return {
          icon: AlertCircle,
          className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200",
        };
      case "medium":
        return {
          icon: Clock,
          className:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200",
        };
      case "low":
        return {
          icon: CheckCircle2,
          className:
            "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200",
        };
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Tasks & Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Tasks & Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">
              No pending tasks at the moment.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Tasks & Alerts</CardTitle>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {tasks.map((task) => {
              const config = getPriorityConfig(task.priority);
              const Icon = config.icon;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                    config.className
                  )}
                  onClick={() => navigate(task.path)}
                >
                  <div className="flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {task.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.count && (
                      <Badge variant="secondary" className="text-xs">
                        {task.count}
                      </Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
