import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockDashboardData } from '../mockDashboardData';

export function EnhancedActivityFeed() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-emerald-600';
      case 'warning': return 'text-orange-600';
      case 'info': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Activity Feed
        </h3>
        <Badge variant="secondary" className="animate-pulse">
          Live
        </Badge>
      </div>

      <div className="space-y-3">
        {mockDashboardData.activities.map((activity, index) => {
          const Icon = activity.icon;
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.4
              }}
              whileHover={{ 
                x: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all cursor-pointer"
            >
              {/* Icon with animation */}
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ 
                  delay: index * 0.1,
                  duration: 0.6,
                  ease: [0.21, 0.47, 0.32, 0.98]
                }}
                className={`p-2 rounded-full bg-muted ${getStatusColor(activity.status)}`}
              >
                <Icon className="h-4 w-4" />
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{activity.message}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                  {(activity.value || activity.views || activity.qty) && (
                    <Badge variant="outline" className="text-xs">
                      {activity.value || activity.views || activity.qty}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <button className="w-full mt-4 text-sm text-primary hover:underline">
        View All Activity
      </button>
    </Card>
  );
}
