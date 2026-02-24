import { motion } from 'framer-motion';
import { Radio, Shield, ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardViewKey } from './DashboardViews';

interface SuperstarFeaturesCardProps {
  onViewChange: (view: DashboardViewKey) => void;
}

export function SuperstarFeaturesCard({ onViewChange }: SuperstarFeaturesCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-2 p-2 bg-gradient-to-r from-primary/10 via-primary/5 to-emerald-500/10 rounded border border-primary/30"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <TrendingUp className="h-4 w-4 text-primary" />
        </motion.div>
        <h3 className="text-xs font-bold text-primary">⭐ SUPERSTAR FEATURES</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Live Tracking Card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-2 bg-background/80 backdrop-blur-sm rounded border border-border/30 cursor-pointer"
          onClick={() => onViewChange('tracking')}
        >
          <div className="flex items-start gap-2 mb-1.5">
            <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center flex-shrink-0">
              <Radio className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <h4 className="text-xs font-semibold">Live Tracking</h4>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-1.5 h-1.5 bg-red-500 rounded-full"
                />
              </div>
              <p className="text-[9px] text-muted-foreground mb-1">
                Real-time delivery monitoring with live maps
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[10px]">
              <div className="font-bold text-emerald-600">12 Active</div>
              <div className="text-muted-foreground">Deliveries</div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 bg-[hsl(var(--marketing-primary))/0.05] hover:bg-[hsl(var(--marketing-primary))/0.1] text-[hsl(var(--marketing-primary))] font-semibold rounded transition-colors">
              View Live
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>

        {/* Disposable Menus Card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-2 bg-background/80 backdrop-blur-sm rounded border border-border/30 cursor-pointer"
          onClick={() => onViewChange('menus')}
        >
          <div className="flex items-start gap-2 mb-1.5">
            <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center flex-shrink-0">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                <Shield className="h-4 w-4 text-primary" />
              </motion.div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <h4 className="text-xs font-semibold">OPSEC Menus</h4>
                <div className="text-[8px] px-1 py-0.5 bg-primary/20 text-primary rounded font-bold">
                  NEW
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1">
                AES-256 encrypted, disposable catalogs
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[10px]">
              <div className="font-bold text-primary">479 Views</div>
              <div className="text-muted-foreground">Today</div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 bg-[hsl(var(--marketing-primary))/0.05] hover:bg-[hsl(var(--marketing-primary))/0.1] text-[hsl(var(--marketing-primary))] font-semibold rounded transition-colors">
              Analytics
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
