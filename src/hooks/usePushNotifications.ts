import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported on this device",
        variant: "destructive"
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast({
          title: "Permission Denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive"
        });
        return false;
      }

      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }

      setIsSubscribed(true);
      localStorage.setItem('notifications_enabled', 'true');

      // Test notification via service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: 'Notifications Enabled',
          body: "You'll receive delivery notifications on your home and lock screen",
          tag: 'notification-enabled'
        });
      }

      toast({
        title: "Notifications Enabled",
        description: "You'll receive delivery notifications",
      });

      return true;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast({
        title: "Error",
        description: "Failed to enable notifications",
        variant: "destructive"
      });
      return false;
    }
  };

  const unsubscribe = async () => {
    try {
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      setSubscription(null);
      setIsSubscribed(false);
      localStorage.removeItem('notifications_enabled');

      toast({
        title: "Notifications Disabled",
        description: "You won't receive push notifications",
      });
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast({
        title: "Error",
        description: "Failed to disable notifications",
        variant: "destructive"
      });
    }
  };

  return {
    isSupported,
    isSubscribed,
    subscription,
    requestPermission,
    unsubscribe,
    checkSubscription
  };
}

