import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedStockChart } from './AnimatedStockChart';
import { WorkflowDiagram } from './WorkflowDiagram';
import { LiveMapDemo } from './LiveMapDemo';
import { QRMenuDemo } from './QRMenuDemo';
import { StorefrontDemo } from './StorefrontDemo';
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Users from "lucide-react/dist/esm/icons/users";

interface FeatureDemoPreviewProps {
  featureId: string;
}

export function FeatureDemoPreview({ featureId }: FeatureDemoPreviewProps) {
  const renderDemo = () => {
    switch (featureId) {
      case 'inventory':
        return <AnimatedStockChart />;
      case 'automation':
        return <WorkflowDiagram />;
      case 'fleet':
        return <LiveMapDemo />;
      case 'menus':
        return <QRMenuDemo />;
      case 'storefront':
        return <StorefrontDemo />;
      case 'portal':
        return (
          <div className="w-full h-full bg-[hsl(var(--marketing-bg-subtle))] rounded-lg p-6 border border-[hsl(var(--marketing-border))]">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-[hsl(var(--marketing-text))]">Customer Portal</h4>
            </div>
            <div className="space-y-4">
              <div className="bg-[hsl(var(--marketing-bg))]/50 rounded-lg p-4 border border-[hsl(var(--marketing-border))]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent" />
                  <div>
                    <div className="font-medium text-[hsl(var(--marketing-text))]">Welcome, John's Shop</div>
                    <div className="text-xs text-[hsl(var(--marketing-text-light))]">Account #1234</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-[hsl(var(--marketing-primary))]/10 rounded-lg">
                    <div className="text-xs text-[hsl(var(--marketing-text-light))]">Active Orders</div>
                    <div className="text-xl font-bold text-[hsl(var(--marketing-primary))]">3</div>
                  </div>
                  <div className="p-3 bg-[hsl(var(--marketing-accent))]/10 rounded-lg">
                    <div className="text-xs text-[hsl(var(--marketing-text-light))]">Total Spent</div>
                    <div className="text-xl font-bold text-accent">$2.4K</div>
                  </div>
                </div>
              </div>
              <motion.div
                className="p-4 bg-green-500/10 rounded-lg border border-green-500/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-sm text-[hsl(var(--marketing-text))] font-medium">24/7 Self-Service</div>
                <div className="text-xs text-[hsl(var(--marketing-text-light))] mt-1">Customers can order anytime</div>
              </motion.div>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="w-full h-full bg-[hsl(var(--marketing-bg-subtle))] rounded-lg p-6 border border-[hsl(var(--marketing-border))]">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-[hsl(var(--marketing-text))]">Real-Time Analytics</h4>
            </div>
            <div className="space-y-4">
              <div className="flex items-end gap-2 h-32 bg-[hsl(var(--marketing-bg))]/50 rounded-lg p-4 border border-[hsl(var(--marketing-border))]">
                {[65, 80, 70, 90, 75, 95, 85].map((height, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-primary to-accent rounded-t"
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[hsl(var(--marketing-bg))]/50 rounded-lg p-3 text-center border border-[hsl(var(--marketing-border))]">
                  <div className="text-2xl font-bold text-[hsl(var(--marketing-primary))]">$24K</div>
                  <div className="text-xs text-[hsl(var(--marketing-text-light))]">Revenue</div>
                </div>
                <div className="bg-[hsl(var(--marketing-bg))]/50 rounded-lg p-3 text-center border border-[hsl(var(--marketing-border))]">
                  <div className="text-2xl font-bold text-[hsl(var(--marketing-accent))]">156</div>
                  <div className="text-xs text-[hsl(var(--marketing-text-light))]">Orders</div>
                </div>
                <div className="bg-[hsl(var(--marketing-bg))]/50 rounded-lg p-3 text-center border border-[hsl(var(--marketing-border))]">
                  <div className="text-2xl font-bold text-green-500">+23%</div>
                  <div className="text-xs text-[hsl(var(--marketing-text-light))]">Growth</div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <AnimatedStockChart />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={featureId}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring' as const, stiffness: 200, damping: 25 }}
        className="h-full"
      >
        {renderDemo()}
      </motion.div>
    </AnimatePresence>
  );
}
