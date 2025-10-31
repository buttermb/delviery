import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, TestTube } from 'lucide-react';
import { toast } from 'sonner';

export function NotificationTest() {
  const testNotification = async () => {
    if (!('Notification' in window)) {
      toast.error('Notifications not supported on this device');
      return;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Test notification
      new Notification('Test Notification', {
        body: 'Notifications are working! You\'ll receive order alerts.',
        icon: '/nym-logo.svg',
        badge: '/nym-logo.svg',
        tag: 'test-notification'
      });
      
      toast.success('Test notification sent!');
    } else {
      toast.error('Notification permission denied');
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Test Notifications
        </CardTitle>
        <CardDescription>
          Test if push notifications are working on your device
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={testNotification} className="w-full">
          <TestTube className="w-4 h-4 mr-2" />
          Send Test Notification
        </Button>
      </CardContent>
    </Card>
  );
}
