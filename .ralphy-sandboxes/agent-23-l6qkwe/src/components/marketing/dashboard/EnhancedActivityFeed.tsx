import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
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
    <div className="p-3 bg-muted/30 rounded-lg border border-border/30 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Activity Feed
        </h3>
        <Badge variant="secondary" className="animate-pulse text-[10px] px-1.5 py-0">
          Live
        </Badge>
      </div>

      <div className="space-y-1.5">
        {mockDashboardData.activities.slice(0, 3).map((activity, index) => {
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
                x: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              className="flex items-start gap-1.5 p-1.5 rounded border border-border/50 bg-background/50 hover:bg-accent/30 transition-all cursor-pointer"
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
                className={`p-1.5 rounded-full bg-muted ${getStatusColor(activity.status)}`}
              >
                <Icon className="h-3 w-3" />
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{activity.message}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                  {(activity.value || activity.views || activity.qty) && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {activity.value || activity.views || activity.qty}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
