import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Battery, BatteryCharging, BatteryLow, Wifi, WifiOff, Signal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DeviceStatusBar() {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connection, setConnection] = useState<'4g' | '3g' | 'slow' | 'offline'>('4g');

  useEffect(() => {
    // Battery status
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBattery({
            level: battery.level * 100,
            charging: battery.charging
          });
        };
        
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      });
    }

    // Network status
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Connection speed estimate
    const updateConnection = () => {
      const conn = (navigator as any).connection;
      if (conn) {
        const speed = conn.effectiveType;
        setConnection(speed);
      }
    };
    
    if ('connection' in navigator) {
      updateConnection();
      (navigator as any).connection.addEventListener('change', updateConnection);
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const getBatteryIcon = () => {
    if (!battery) return Battery;
    if (battery.charging) return BatteryCharging;
    if (battery.level < 20) return BatteryLow;
    return Battery;
  };

  const getBatteryColor = () => {
    if (!battery) return 'text-muted-foreground';
    if (battery.charging) return 'text-green-500';
    if (battery.level < 20) return 'text-red-500';
    if (battery.level < 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  const BatteryIcon = getBatteryIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2"
    >
      {/* Battery Status */}
      {battery && (
        <Badge variant="outline" className="gap-1.5 px-2">
          <BatteryIcon className={`w-3.5 h-3.5 ${getBatteryColor()}`} />
          <span className="text-xs font-medium">{Math.round(battery.level)}%</span>
        </Badge>
      )}

      {/* Network Status */}
      <Badge 
        variant={isOnline ? "outline" : "destructive"} 
        className="gap-1.5 px-2"
      >
        {isOnline ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs font-medium uppercase">{connection}</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Offline</span>
          </>
        )}
      </Badge>

      {/* Low Battery Warning */}
      {battery && battery.level < 20 && !battery.charging && (
        <Badge variant="destructive" className="gap-1.5 px-2 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Low Battery</span>
        </Badge>
      )}
    </motion.div>
  );
}

const AlertCircle = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);