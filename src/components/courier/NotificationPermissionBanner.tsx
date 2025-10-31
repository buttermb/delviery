import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationPermissionBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { isSupported, isSubscribed, requestPermission } = usePushNotifications();

  useEffect(() => {
    // Check if we should show the banner
    const checkPermission = () => {
      if (isSupported && !isSubscribed) {
        const hasSeenBanner = localStorage.getItem('notification_banner_dismissed');
        if (!hasSeenBanner) {
          setTimeout(() => setShow(true), 2000);
        }
      }
    };

    checkPermission();
  }, [isSupported, isSubscribed]);

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShow(false);
      localStorage.setItem('notification_banner_dismissed', 'true');
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('notification_banner_dismissed', 'true');
  };

  if (!show || dismissed || !isSupported || isSubscribed) return null;

  return (
    <div 
      className="fixed top-[80px] left-4 right-4 bg-yellow-500/20 border border-yellow-500/30 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm z-40 animate-in slide-in-from-top-2"
      style={{ 
        // Safe area for iOS devices with dynamic island/notch
        top: 'max(80px, env(safe-area-inset-top, 80px))'
      }}
    >
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center space-x-3 flex-1">
          <Bell className="text-yellow-500 flex-shrink-0 animate-pulse" size={20} />
          <div>
            <div className="font-bold text-sm">Enable Push Notifications</div>
            <div className="text-xs text-muted-foreground">Get instant alerts for new delivery orders</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleEnable}
            className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold text-sm"
            size="sm"
          >
            Enable
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-secondary rounded"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
