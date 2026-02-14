/**
 * SoundAlertToggle
 * A settings toggle for enabling/disabling sound alerts for key events.
 * Persists preference in localStorage.
 * Default: disabled to avoid surprising users.
 */

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'floraiq_sound_alerts_enabled';

/**
 * Check if sound alerts are enabled
 */
export function isSoundAlertEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set sound alerts enabled/disabled
 */
export function setSoundAlertEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

export function SoundAlertToggle() {
  const [enabled, setEnabled] = useState(isSoundAlertEnabled);

  const handleToggle = (checked: boolean) => {
    setSoundAlertEnabled(checked);
    setEnabled(checked);
    logger.info('Sound alerts toggled', {
      enabled: checked,
      component: 'SoundAlertToggle',
    });

    if (checked) {
      toast.success('Sound alerts enabled');
    } else {
      toast.info('Sound alerts disabled');
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md border">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Volume2 className="h-5 w-5 text-muted-foreground" />
        ) : (
          <VolumeX className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <Label htmlFor="sound-alerts" className="text-sm font-medium">
            Sound Alerts
          </Label>
          <p className="text-xs text-muted-foreground">
            Play audio tones for new orders and low stock warnings.
          </p>
        </div>
      </div>
      <Switch
        id="sound-alerts"
        checked={enabled}
        onCheckedChange={handleToggle}
      />
    </div>
  );
}
