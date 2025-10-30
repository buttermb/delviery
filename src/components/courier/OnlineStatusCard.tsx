import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MapPin, Wifi, WifiOff, Clock, Battery } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface OnlineStatusCardProps {
  courierId: string;
  isOnline: boolean;
  onStatusChange: (status: boolean) => void;
}

export default function OnlineStatusCard({ courierId, isOnline, onStatusChange }: OnlineStatusCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [onlineTime, setOnlineTime] = useState(0);

  useEffect(() => {
    // Check location permission
    if ('geolocation' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationEnabled(result.state === 'granted');
      });
    }

    // Track online time
    let interval: NodeJS.Timeout;
    if (isOnline) {
      interval = setInterval(() => {
        setOnlineTime((prev) => prev + 1);
      }, 1000);
    } else {
      setOnlineTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline]);

  // Track courier presence in real-time
  useEffect(() => {
    if (!courierId) return;

    const channel = supabase.channel(`courier-presence-${courierId}`);

    if (isOnline) {
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          console.log('Presence synced:', state);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Track courier as online
            await channel.track({
              courier_id: courierId,
              online_at: new Date().toISOString(),
              status: 'active',
              accepting_orders: true
            });
            setLastUpdate(new Date());
          }
        });

      // Update presence every 30 seconds
      const presenceInterval = setInterval(async () => {
        await channel.track({
          courier_id: courierId,
          online_at: new Date().toISOString(),
          status: 'active',
          accepting_orders: true,
          last_heartbeat: new Date().toISOString()
        });
        setLastUpdate(new Date());
      }, 30000);

      return () => {
        clearInterval(presenceInterval);
        channel.untrack();
        supabase.removeChannel(channel);
      };
    } else {
      channel.untrack();
      supabase.removeChannel(channel);
    }
  }, [courierId, isOnline]);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);

    try {
      // Check location permission if going online
      if (checked && 'geolocation' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state !== 'granted') {
          toast({
            title: "Location Required",
            description: "Please enable location to go online",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
      }

      // Update courier status
      const { error } = await supabase
        .from('couriers')
        .update({
          is_online: checked,
          last_location_update: checked ? new Date().toISOString() : null
        })
        .eq('id', courierId);

      if (error) throw error;

      onStatusChange(checked);

      toast({
        title: checked ? "You're Online" : "You're Offline",
        description: checked 
          ? "You'll receive delivery requests" 
          : "You won't receive new orders",
      });

    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  return (
    <Card className={`${isOnline ? 'bg-green-950/30 border-green-500/30' : 'bg-card'}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={isOnline ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {isOnline ? (
                <Wifi className="w-6 h-6 text-green-600" />
              ) : (
                <WifiOff className="w-6 h-6 text-muted-foreground" />
              )}
            </motion.div>
            <div>
              <h3 className="font-bold text-lg text-foreground">
                {isOnline ? 'Online & Active' : 'Offline'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isOnline ? 'Accepting deliveries' : 'Not accepting orders'}
              </p>
            </div>
          </div>

          <Switch
            checked={isOnline}
            onCheckedChange={handleToggle}
            disabled={isLoading}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        <AnimatePresence>
          {isOnline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-3 border-t"
            >
              {/* Location Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className={`w-4 h-4 ${locationEnabled ? 'text-green-500' : 'text-orange-400'}`} />
                  <span className="text-sm text-foreground">Location Tracking</span>
                </div>
                <Badge variant={locationEnabled ? 'default' : 'secondary'}>
                  {locationEnabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>

              {/* Online Duration */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Online for</span>
                </div>
                <Badge variant="outline" className="font-mono">
                  {formatTime(onlineTime)}
                </Badge>
              </div>

              {/* Last Update */}
              {lastUpdate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">Last sync</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago
                  </span>
                </div>
              )}

              {/* Live Status Indicator */}
              <div className="flex items-center gap-2 pt-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <span className="text-xs font-medium text-green-500">
                  Live & Ready for Orders
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
