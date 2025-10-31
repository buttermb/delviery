import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Truck, TrendingUp, Bell, Settings, FileText, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export function QuickActionGrid() {
  const navigate = useNavigate();

  const actions = [
    { icon: Package, label: "Products", path: "/admin/products", color: "text-blue-600" },
    { icon: Users, label: "Users", path: "/admin/users", color: "text-green-600" },
    { icon: Truck, label: "Live Deliveries", path: "/admin/live-orders", color: "text-purple-600" },
    { icon: TrendingUp, label: "Analytics", path: "/admin/analytics", color: "text-orange-600" },
    { icon: Bell, label: "Notifications", path: "/admin/notifications", color: "text-red-600" },
    { icon: FileText, label: "Orders", path: "/admin/orders", color: "text-indigo-600" },
    { icon: Shield, label: "Compliance", path: "/admin/compliance", color: "text-yellow-600" },
    { icon: Settings, label: "Settings", path: "/admin/settings", color: "text-gray-600" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {actions.map((action, idx) => (
            <motion.div
              key={action.path}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                onClick={() => navigate(action.path)}
                className="h-24 w-full flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5"
              >
                <action.icon className={`h-6 w-6 ${action.color}`} />
                <span className="text-xs font-medium">{action.label}</span>
              </Button>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
