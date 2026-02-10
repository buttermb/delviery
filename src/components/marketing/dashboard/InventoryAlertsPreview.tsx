import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mockDashboardData } from '../mockDashboardData';

export function InventoryAlertsPreview() {
  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return {
          badgeClass: 'bg-red-500/20 text-red-700 border-red-500/30',
          barClass: 'bg-red-500',
          textClass: 'text-red-600'
        };
      case 'warning':
        return {
          badgeClass: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
          barClass: 'bg-orange-500',
          textClass: 'text-orange-600'
        };
      default:
        return {
          badgeClass: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
          barClass: 'bg-yellow-500',
          textClass: 'text-yellow-600'
        };
    }
  };

  return (
    <div className="p-3 bg-muted/30 rounded-lg border border-border/30 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-primary" />
          Inventory Alerts
        </h3>
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{mockDashboardData.inventoryAlerts.slice(0, 2).length}</Badge>
      </div>

      <div className="space-y-1.5">
        {mockDashboardData.inventoryAlerts.slice(0, 2).map((alert, index) => {
          const urgencyConfig = getUrgencyConfig(alert.urgency);
          
          return (
            <motion.div
              key={alert.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.4
              }}
              whileHover={{ 
                scale: 1.01,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              className="p-1.5 rounded border border-border/50 bg-background/50 hover:bg-accent/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex-1">
                  <div className="font-medium text-xs">{alert.name}</div>
                  <div className="text-[10px] text-muted-foreground">{alert.location}</div>
                </div>
                <Badge variant="outline" className={`${urgencyConfig.badgeClass} text-[10px] px-1.5 py-0`}>
                  {alert.urgency}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className={urgencyConfig.textClass}>
                    {alert.current} / {alert.threshold} lbs
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round((alert.current / alert.threshold) * 100)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(alert.current / alert.threshold) * 100}%` }}
                    transition={{ 
                      delay: index * 0.1 + 0.2,
                      duration: 0.6,
                      ease: [0.21, 0.47, 0.32, 0.98]
                    }}
                    className={`h-full ${urgencyConfig.barClass}`}
                  />
                </div>

                {alert.urgency === 'critical' && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.5 }}
                    className="w-full mt-1 px-2 py-0.5 bg-destructive text-destructive-foreground text-[10px] font-medium rounded hover:bg-destructive/90 transition-colors"
                  >
                    Restock Now
                  </motion.button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
