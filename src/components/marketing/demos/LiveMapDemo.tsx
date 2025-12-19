import { motion } from 'framer-motion';
import { MapPin, Truck } from 'lucide-react';

const deliveries = [
  { id: 1, lat: 20, lng: 30, status: 'In Transit', driver: 'Mike' },
  { id: 2, lat: 60, lng: 70, status: 'Delivered', driver: 'Sarah' },
  { id: 3, lat: 40, lng: 50, status: 'Picking Up', driver: 'John' },
];

export function LiveMapDemo() {
  return (
    <div className="w-full h-full bg-card/50 rounded-lg p-6 relative overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 200 200">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">Live Fleet Tracking</h4>
        </div>

        {/* Map Container */}
        <div className="relative h-48 bg-muted/30 rounded-lg mb-4 overflow-hidden border border-border">
          {deliveries.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              className="absolute"
              style={{ left: `${delivery.lng}%`, top: `${delivery.lat}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.3 }}
            >
              <motion.div
                animate={{ 
                  scale: delivery.status === 'In Transit' ? [1, 1.2, 1] : 1 
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Truck 
                  className={`h-6 w-6 ${
                    delivery.status === 'Delivered' ? 'text-green-500' :
                    delivery.status === 'In Transit' ? 'text-primary' : 'text-yellow-500'
                  }`}
                />
              </motion.div>

              {/* Delivery Info Popup */}
              <motion.div
                className="absolute top-8 left-0 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-2 text-xs whitespace-nowrap shadow-lg"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.3 + 0.2 }}
              >
                <div className="font-medium text-foreground">{delivery.driver}</div>
                <div className="text-muted-foreground">{delivery.status}</div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            className="bg-background/50 rounded-lg p-3 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="text-2xl font-bold text-primary">3</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </motion.div>
          <motion.div
            className="bg-background/50 rounded-lg p-3 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="text-2xl font-bold text-green-500">12</div>
            <div className="text-xs text-muted-foreground">Delivered</div>
          </motion.div>
          <motion.div
            className="bg-background/50 rounded-lg p-3 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="text-2xl font-bold text-accent">98%</div>
            <div className="text-xs text-muted-foreground">On-Time</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
