import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Warehouse, 
  Truck, 
  Users, 
  BarChart3, 
  Settings,
  Radio,
  Shield
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DashboardViewKey } from './DashboardViews';
import type { LucideIcon } from 'lucide-react';

const navItems: Array<{ icon: LucideIcon; label: string; view: DashboardViewKey | null; special?: boolean; pulse?: boolean }> = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: Radio, label: 'Live Tracking', view: 'tracking', special: true, pulse: true },
  { icon: Shield, label: 'Secure Menus', view: 'menus', special: true },
  { icon: Package, label: 'Catalog', view: 'catalog' },
  { icon: ShoppingCart, label: 'Orders', view: 'orders' },
  { icon: Warehouse, label: 'Inventory', view: 'inventory' },
  { icon: Truck, label: 'Transfers', view: null },
  { icon: Users, label: 'Customers', view: 'customers' },
  { icon: BarChart3, label: 'Analytics', view: 'analytics' },
  { icon: Settings, label: 'Settings', view: null },
];

interface MiniSidebarPreviewProps {
  activeView: DashboardViewKey;
  onViewChange: (view: DashboardViewKey) => void;
}

export function MiniSidebarPreview({ activeView, onViewChange }: MiniSidebarPreviewProps) {
  return (
    <div id="sidebar" data-dark-panel className="w-10 sm:w-12 bg-slate-900 border-r border-slate-800 py-2 flex flex-col gap-0.5">
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
                  onClick={() => item.view && onViewChange(item.view)}
                  disabled={!item.view}
                  className={`w-full p-1.5 sm:p-2 flex items-center justify-center transition-colors relative ${
                    item.view === activeView
                      ? 'bg-primary/20 text-primary' 
                      : item.view
                      ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 cursor-pointer'
                      : 'text-slate-600 cursor-not-allowed'
                  } ${item.special ? 'ring-1 ring-inset ring-primary/30' : ''}`}
                >
                  {item.view === activeView && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {item.pulse && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"
                      />
                    )}
                    {item.special && !item.pulse && (
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </div>
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
