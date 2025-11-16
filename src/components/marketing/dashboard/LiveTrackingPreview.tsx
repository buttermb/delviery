import { motion } from 'framer-motion';
import { MapPin, Radio, Clock, Package, TrendingUp, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const liveDeliveries = [
  {
    id: 'D8F2',
    courier: 'Mike Johnson',
    customer: 'Green Valley Co.',
    status: 'in_transit',
    location: '37.7749° N, 122.4194° W',
    eta: '12 min',
    progress: 75,
    lastUpdate: '2s ago'
  },
  {
    id: 'D9A3',
    courier: 'Sarah Lee',
    customer: 'Summit Dispensary',
    status: 'picked_up',
    location: '37.7849° N, 122.4094° W',
    eta: '28 min',
    progress: 40,
    lastUpdate: '5s ago'
  },
  {
    id: 'D0B4',
    courier: 'James Chen',
    customer: 'Pacific Coast',
    status: 'delivered',
    location: '37.7649° N, 122.4294° W',
    eta: 'Completed',
    progress: 100,
    lastUpdate: '3m ago'
  }
];

const activityFeed = [
  { message: 'Courier Mike updated location', time: '2s ago', type: 'location' },
  { message: 'Order #D0B4 marked as delivered', time: '3m ago', type: 'delivery' },
  { message: 'New order assigned to Sarah', time: '8m ago', type: 'assign' }
];

export function LiveTrackingPreview() {
  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {/* WebSocket Status */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-2 bg-emerald-500/10 rounded border border-emerald-500/30 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-2 h-2 bg-emerald-500 rounded-full"
          />
          <span className="text-xs font-semibold text-emerald-600">LIVE CONNECTED</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Radio className="h-3 w-3" />
          <span>WebSocket Active</span>
        </div>
      </motion.div>

      {/* Map Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative h-32 bg-gradient-to-br from-blue-500/10 via-primary/5 to-emerald-500/10 rounded border border-border/30 overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <pattern id="map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#map-grid)" />
          </svg>
        </div>
        
        {/* Animated Markers */}
        {[
          { top: '30%', left: '35%', color: 'bg-emerald-500' },
          { top: '60%', left: '55%', color: 'bg-blue-500' },
          { top: '45%', left: '70%', color: 'bg-purple-500' }
        ].map((marker, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="absolute"
            style={{ top: marker.top, left: marker.left }}
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
              className={`w-3 h-3 ${marker.color} rounded-full shadow-lg`}
            />
            <div className={`absolute inset-0 ${marker.color} rounded-full opacity-30 animate-ping`} />
          </motion.div>
        ))}
        
        <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-semibold">
          3 Active Deliveries
        </div>
      </motion.div>

      {/* Active Deliveries */}
      <div className="space-y-2">
        {liveDeliveries.map((delivery, i) => (
          <motion.div
            key={delivery.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="p-2 bg-muted/30 rounded border border-border/30"
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center flex-shrink-0">
                <Navigation className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="text-xs font-semibold">{delivery.courier}</div>
                    <div className="text-[10px] text-muted-foreground">→ {delivery.customer}</div>
                  </div>
                  <Badge 
                    variant={
                      delivery.status === 'in_transit' ? 'default' :
                      delivery.status === 'picked_up' ? 'secondary' :
                      'outline'
                    }
                    className="text-[10px] flex-shrink-0"
                  >
                    {delivery.status === 'in_transit' ? 'In Transit' :
                     delivery.status === 'picked_up' ? 'Picked Up' :
                     'Delivered'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1.5">
                  <div className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    <span className="font-mono">{delivery.location}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold">ETA: {delivery.eta}</span>
                    </div>
                    <motion.span 
                      className="text-muted-foreground"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      {delivery.lastUpdate}
                    </motion.span>
                  </div>
                  <Progress value={delivery.progress} className="h-1.5" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Real-time Activity Feed */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-2 bg-muted/20 rounded border border-border/20"
      >
        <div className="text-xs font-semibold mb-2 flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-primary" />
          Live Activity
        </div>
        <div className="space-y-1.5">
          {activityFeed.map((activity, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="flex items-center justify-between text-[10px]"
            >
              <span className="text-muted-foreground">{activity.message}</span>
              <span className="text-muted-foreground/60">{activity.time}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
