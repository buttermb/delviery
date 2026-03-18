/**
 * BrowserNotificationToggle
 * A settings toggle for enabling/disabling browser push notifications.
 * Can be embedded in any admin settings page.
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import {
  isBrowserNotificationSupported,
  isBrowserNotificationEnabled,
  setBrowserNotificationEnabled,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '@/utils/browserNotifications';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function BrowserNotificationToggle() {
  const supported = isBrowserNotificationSupported();
  const [enabled, setEnabled] = useState(isBrowserNotificationEnabled);
  const [permission, setPermission] = useState(getBrowserNotificationPermission);

  // Sync permission state
  useEffect(() => {
    if (supported) {
      setPermission(getBrowserNotificationPermission());
    }
  }, [supported]);

  const handleToggle = async (checked: boolean) => {
    if (checked && permission === 'default') {
      const granted = await requestBrowserNotificationPermission();
      setPermission(getBrowserNotificationPermission());
      if (!granted) {
        toast.error('Browser notification permission was denied');
        return;
      }
    }

    if (checked && permission === 'denied') {
      toast.error('Notifications are blocked', {
        description: 'Please enable notifications in your browser settings, then try again.',
      });
      return;
    }

    setBrowserNotificationEnabled(checked);
    setEnabled(checked);
    logger.info('Browser notifications toggled', {
      enabled: checked,
      component: 'BrowserNotificationToggle',
    });

    if (checked) {
      toast.success('Browser notifications enabled');
    } else {
      toast.info('Browser notifications disabled');
    }
  };

  if (!supported) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <div>
          <Label className="text-sm font-medium">Browser Notifications</Label>
          <p className="text-xs text-muted-foreground">Not supported in this browser.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md border">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <div>
          <Label htmlFor="browser-notifications" className="text-sm font-medium">
            Browser Notifications
          </Label>
          <p className="text-xs text-muted-foreground">
            Receive desktop alerts for new orders, low stock, and payments.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {permission === 'denied' && (
          <Badge variant="destructive" className="text-xs">Blocked</Badge>
        )}
        <Switch
          id="browser-notifications"
          checked={enabled && permission !== 'denied'}
          onCheckedChange={handleToggle}
          disabled={permission === 'denied'}
        />
      </div>
    </div>
  );
}
