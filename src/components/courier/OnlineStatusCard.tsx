import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useCourier } from '@/contexts/CourierContext';
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Clock from "lucide-react/dist/esm/icons/clock";
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function OnlineStatusCard() {
  const { courier, isOnline, toggleOnlineStatus, loading } = useCourier();
  const [onlineDuration, setOnlineDuration] = useState(0);

  useEffect(() => {
    if (!isOnline) {
      setOnlineDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setOnlineDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnline]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{
                scale: isOnline ? [1, 1.2, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: isOnline ? Infinity : 0,
              }}
              className={`p-3 rounded-full ${
                isOnline ? 'bg-green-500/10' : 'bg-muted'
              }`}
            >
              {isOnline ? (
                <Wifi className="h-6 w-6 text-green-600" />
              ) : (
                <WifiOff className="h-6 w-6 text-muted-foreground" />
              )}
            </motion.div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Delivery Status</h3>
                {isOnline && (
                  <Badge variant="default" className="animate-pulse">
                    Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {isOnline ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(onlineDuration)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>Tracking active</span>
                    </div>
                  </>
                ) : (
                  <span>You're offline - go online to receive orders</span>
                )}
              </div>
            </div>
          </div>

          <Switch
            checked={isOnline}
            onCheckedChange={toggleOnlineStatus}
            disabled={loading || !courier}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        {!isOnline && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            💡 Go online to start accepting delivery orders
          </div>
        )}
      </CardContent>
    </Card>
  );
}
