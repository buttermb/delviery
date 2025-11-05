import { ShoppingCart, Package, Warehouse, Users, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export const dashboardViews = {
  dashboard: {
    title: 'Dashboard Overview',
    description: 'Real-time metrics and analytics',
  },
  catalog: {
    title: 'Product Catalog',
    description: 'Manage your product inventory',
    preview: (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="w-10 h-10 bg-primary/20 rounded flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Product {i}</div>
              <div className="text-[10px] text-muted-foreground">SKU: PRD-{1000 + i}</div>
            </div>
            <Badge variant="secondary" className="text-[10px]">In Stock</Badge>
          </motion.div>
        ))}
      </div>
    ),
  },
  orders: {
    title: 'Order Management',
    description: 'Track and fulfill customer orders',
    preview: (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="w-10 h-10 bg-emerald-500/20 rounded flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Order #{2000 + i}</div>
              <div className="text-[10px] text-muted-foreground">Customer {i}</div>
            </div>
            <Badge variant="default" className="text-[10px] bg-emerald-600">Completed</Badge>
          </motion.div>
        ))}
      </div>
    ),
  },
  inventory: {
    title: 'Inventory Control',
    description: 'Monitor stock levels and locations',
    preview: (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold">Location {i}</div>
              </div>
              <Badge variant="outline" className="text-[10px]">{150 - i * 20} units</Badge>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${85 - i * 15}%` }}
                transition={{ delay: i * 0.1 + 0.2, duration: 0.6 }}
                className="h-full bg-primary"
              />
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  customers: {
    title: 'Customer Directory',
    description: 'Manage customer relationships',
    preview: (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Customer {i}</div>
              <div className="text-[10px] text-muted-foreground">{i * 5} orders</div>
            </div>
            <Badge variant="secondary" className="text-[10px]">Active</Badge>
          </motion.div>
        ))}
      </div>
    ),
  },
  analytics: {
    title: 'Analytics & Reports',
    description: 'Deep insights into your business',
    preview: (
      <div className="space-y-2">
        {['Revenue', 'Orders', 'Growth'].map((metric, i) => (
          <motion.div
            key={metric}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold">{metric}</div>
              </div>
              <div className="text-sm font-bold text-emerald-600">+{12 + i * 3}%</div>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
};

export type DashboardViewKey = keyof typeof dashboardViews;
