import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Truck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { mockDashboardData } from '../mockDashboardData';

export function LocationMapPreview() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Simple map simulation with animation
    const timer = setTimeout(() => setMapLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Location Overview
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Warehouses</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Runners</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <motion.div
        ref={mapRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative h-[300px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg overflow-hidden border"
      >
        {/* Grid overlay for map effect */}
        <div className="absolute inset-0 opacity-10">
          <div className="grid grid-cols-8 grid-rows-6 h-full">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="border border-slate-300 dark:border-slate-700" />
            ))}
          </div>
        </div>

        {/* Location Pins */}
        {mapLoaded && mockDashboardData.locations.map((location, index) => {
          const isWarehouse = location.type === 'warehouse';
          const top = 20 + (index * 15) + Math.random() * 20;
          const left = 15 + (index * 15) + Math.random() * 20;

          return (
            <motion.div
              key={location.name}
              initial={{ scale: 0, y: -50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ 
                delay: index * 0.15,
                duration: 0.5,
                type: 'spring',
                bounce: 0.4
              }}
              className="absolute group cursor-pointer"
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              {/* Pin */}
              <motion.div
                whileHover={{ scale: 1.2 }}
                animate={!isWarehouse ? { y: [0, -4, 0] } : {}}
                transition={!isWarehouse ? { repeat: Infinity, duration: 2 } : {}}
                className={`h-8 w-8 rounded-full flex items-center justify-center shadow-lg ${
                  isWarehouse 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-blue-500 text-white'
                }`}
              >
                {isWarehouse ? (
                  <MapPin className="h-4 w-4" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
              </motion.div>

              {/* Tooltip */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                  {location.name}
                </div>
              </div>

              {/* Pulse effect for runners */}
              {!isWarehouse && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-blue-500"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Location Stats */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Active Warehouses</div>
          <div className="text-2xl font-bold">
            {mockDashboardData.locations.filter(l => l.type === 'warehouse').length}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-1">Runners Online</div>
          <div className="text-2xl font-bold">
            {mockDashboardData.locations.filter(l => l.type === 'runner').length}
          </div>
        </div>
      </div>
    </Card>
  );
}
