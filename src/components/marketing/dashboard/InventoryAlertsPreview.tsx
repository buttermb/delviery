import { motion } from 'framer-motion';
import { AlertTriangle, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mockDashboardData } from '../mockDashboardData';

export function InventoryAlertsPreview() {
  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return {
          badge: 'destructive',
          barColor: 'bg-red-500',
          textColor: 'text-red-600'
        };
      case 'warning':
        return {
          badge: 'default',
          barColor: 'bg-orange-500',
          textColor: 'text-orange-600'
        };
      default:
        return {
          badge: 'secondary',
          barColor: 'bg-yellow-500',
          textColor: 'text-yellow-600'
        };
    }
  };

  return (
    <Card className="p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Inventory Alerts
        </h3>
        <Badge variant="destructive">{mockDashboardData.inventoryAlerts.length}</Badge>
      </div>

      <div className="space-y-4">
        {mockDashboardData.inventoryAlerts.map((alert, index) => {
          const config = getUrgencyConfig(alert.urgency);
          const percentage = (alert.current / alert.threshold) * 100;

          return (
            <motion.div
              key={alert.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.4
              }}
              className="p-3 rounded-lg border bg-card space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{alert.name}</div>
                  <div className="text-xs text-muted-foreground">{alert.location}</div>
                </div>
                <Badge variant={config.badge as any} className="text-xs">
                  {alert.urgency}
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={config.textColor}>{alert.current} lbs</span>
                  <span className="text-muted-foreground">{alert.threshold} lbs</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: index * 0.1 + 0.2, duration: 0.6 }}
                    className={`h-full ${config.barColor}`}
                  />
                </div>
              </div>

              {alert.urgency === 'critical' && (
                <Button size="sm" variant="destructive" className="w-full text-xs">
                  Restock Now
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      <Button variant="outline" className="w-full mt-4" size="sm">
        <Package className="h-4 w-4 mr-2" />
        View All Inventory
      </Button>
    </Card>
  );
}
