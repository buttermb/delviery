import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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
      const sub = await (registration as any).pushManager?.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (error) {
      logger.error('Error checking subscription:', error);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error('Please enable notifications in your browser settings');
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

      toast.success("You'll receive delivery notifications");

      return true;
    } catch (error) {
      logger.error('Error requesting permission:', error);
      toast.error('Failed to enable notifications');
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

      toast("You won't receive push notifications");
    } catch (error) {
      logger.error('Error unsubscribing:', error);
      toast.error('Failed to disable notifications');
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

