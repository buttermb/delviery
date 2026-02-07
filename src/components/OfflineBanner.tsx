import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Show toast when coming back online
      toast.success('Back Online', {
        description: 'Connection restored',
        icon: <Wifi className="w-4 h-4" />
      });
      setWasOffline(false);
    }
  }, [isOnline, wasOffline]);

  if (isOnline) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground p-3 text-center text-sm font-medium z-50 flex items-center justify-center gap-2 animate-in slide-in-from-top-2 shadow-lg"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))'
      }}
    >
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>No internet connection. Changes will sync when you're back online.</span>
    </div>
  );
};

export default OfflineBanner;
