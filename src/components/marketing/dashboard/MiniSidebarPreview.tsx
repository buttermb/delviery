import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Warehouse, 
  Truck, 
  Users, 
  BarChart3, 
  Settings 
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Package, label: 'Catalog', active: false },
  { icon: ShoppingCart, label: 'Orders', active: false },
  { icon: Warehouse, label: 'Inventory', active: false },
  { icon: Truck, label: 'Transfers', active: false },
  { icon: Users, label: 'Customers', active: false },
  { icon: BarChart3, label: 'Analytics', active: false },
  { icon: Settings, label: 'Settings', active: false },
];

export function MiniSidebarPreview() {
  return (
    <div id="sidebar" className="w-12 bg-slate-900 border-r border-slate-800 py-2 flex flex-col gap-0.5">
      <TooltipProvider>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          
          return (
            <Tooltip key={item.label} delayDuration={0}>
              <TooltipTrigger asChild>
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className={`w-full p-2 flex items-center justify-center transition-colors relative ${
                    item.active 
                      ? 'bg-primary/20 text-primary' 
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {item.active && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon className="h-4 w-4" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
