import { playNotificationSound } from './notificationSound';
import { 
  notifyNewOrderPersistent, 
  notifyDeliveryReminderPersistent, 
  notifyEarningsUpdatePersistent 
} from './serviceWorkerNotifications';

// Play order sound - uses built-in notification sound system
export const playOrderSound = () => {
  playNotificationSound(true);
};

// Play success sound - uses built-in notification sound system  
export const playSuccessSound = () => {
  playNotificationSound(true);
};

// Vibrate on mobile
export const vibrateDevice = (pattern: number | number[] = 200) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Show browser notification
export const showBrowserNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/nym-logo.svg',
      badge: '/nym-logo.svg',
      ...options
    });
  }
};

// Notify new order with persistent notification
export const notifyNewOrder = async (orderNumber: string, amount: number, borough: string) => {
  playOrderSound();
  vibrateDevice([200, 100, 200, 100, 200]);
  await notifyNewOrderPersistent(orderNumber, amount, borough);
};

// Notify delivery reminder with persistent notification
export const notifyDeliveryReminder = async (orderNumber: string) => {
  vibrateDevice();
  await notifyDeliveryReminderPersistent(orderNumber);
};

// Notify earnings update with persistent notification
export const notifyEarningsUpdate = async (amount: number) => {
  playSuccessSound();
  vibrateDevice([100, 50, 100]);
  await notifyEarningsUpdatePersistent(amount);
};
