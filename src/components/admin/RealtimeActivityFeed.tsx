import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ShoppingCart, AlertTriangle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatActionType } from "@/utils/stringHelpers";
import { isValidActivity } from "@/utils/typeGuards";

interface ActivityItem {
  type: string;
  message: string;
  timestamp: Date;
  data?: any;
}

interface RealtimeActivityFeedProps {
  activities: ActivityItem[];
}

export function RealtimeActivityFeed({ activities }: RealtimeActivityFeedProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'new_order':
        return <ShoppingCart className="h-4 w-4" />;
      case 'fraud_alert':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Real-time Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {activities.length > 0 ? (
              activities.map((activity, idx) => {
                // Validate activity before processing
                if (!isValidActivity(activity)) {
                  console.warn('Invalid activity object:', activity);
                  return null;
                }
                
                return (
                <motion.div
                  key={`${activity.timestamp}-${idx}`}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500 }}
                      className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
                    >
                      {getIcon(activity.type)}
                    </motion.div>
                    <div>
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {formatActionType(activity.type)}
                  </Badge>
                </motion.div>
              );
              }).filter(Boolean)
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Waiting for activity...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
