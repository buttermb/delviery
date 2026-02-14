import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Clock from "lucide-react/dist/esm/icons/clock";
import Repeat from "lucide-react/dist/esm/icons/repeat";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export interface MenuScheduleConfig {
  enabled: boolean;
  activationTime: string | null;
  deactivationTime: string | null;
  timezone: string;
  recurrencePattern: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceConfig: Record<string, unknown>;
}

interface MenuSchedulerProps {
  schedule: MenuScheduleConfig;
  onChange: (schedule: MenuScheduleConfig) => void;
  disabled?: boolean;
}

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'UTC', label: 'UTC' },
];

const formatDateTimeLocal = (isoString: string | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    return date.toISOString().slice(0, 16);
  } catch {
    return '';
  }
};

const formatDisplayDate = (isoString: string | null, timezone: string): string => {
  if (!isoString) return 'Not set';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid date';
  }
};

export const MenuScheduler = ({ schedule, onChange, disabled = false }: MenuSchedulerProps) => {
  const [config, setConfig] = useState<MenuScheduleConfig>(schedule || {
    enabled: false,
    activationTime: null,
    deactivationTime: null,
    timezone: 'America/New_York',
    recurrencePattern: 'none',
    recurrenceConfig: {},
  });

  useEffect(() => {
    if (schedule) {
      setConfig(schedule);
    }
  }, [schedule]);

  const updateConfig = (updates: Partial<MenuScheduleConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  const handleActivationTimeChange = (value: string) => {
    if (!value) {
      updateConfig({ activationTime: null });
      return;
    }
    // Convert local datetime to ISO string
    const date = new Date(value);
    updateConfig({ activationTime: date.toISOString() });
  };

  const handleDeactivationTimeChange = (value: string) => {
    if (!value) {
      updateConfig({ deactivationTime: null });
      return;
    }
    const date = new Date(value);
    updateConfig({ deactivationTime: date.toISOString() });
  };

  const isValidSchedule = (): boolean => {
    if (!config.enabled) return true;
    if (!config.activationTime) return false;

    const now = new Date();
    const activation = new Date(config.activationTime);

    // Activation must be in the future
    if (activation <= now) return false;

    // If deactivation is set, it must be after activation
    if (config.deactivationTime) {
      const deactivation = new Date(config.deactivationTime);
      if (deactivation <= activation) return false;
    }

    return true;
  };

  const getScheduleStatus = (): { type: 'scheduled' | 'active' | 'expired' | 'invalid'; label: string } => {
    if (!config.enabled || !config.activationTime) {
      return { type: 'invalid', label: 'Not scheduled' };
    }

    const now = new Date();
    const activation = new Date(config.activationTime);
    const deactivation = config.deactivationTime ? new Date(config.deactivationTime) : null;

    if (deactivation && deactivation <= now) {
      return { type: 'expired', label: 'Expired' };
    }

    if (activation <= now && (!deactivation || deactivation > now)) {
      return { type: 'active', label: 'Active' };
    }

    if (activation > now) {
      return { type: 'scheduled', label: 'Scheduled' };
    }

    return { type: 'invalid', label: 'Invalid' };
  };

  const scheduleStatus = getScheduleStatus();

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Menu Scheduling</h3>
        </div>
        <div className="flex items-center gap-3">
          {config.enabled && (
            <Badge
              variant={
                scheduleStatus.type === 'active' ? 'default' :
                scheduleStatus.type === 'scheduled' ? 'secondary' :
                scheduleStatus.type === 'expired' ? 'destructive' :
                'outline'
              }
            >
              {scheduleStatus.label}
            </Badge>
          )}
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
            disabled={disabled}
          />
        </div>
      </div>

      {config.enabled && (
        <>
          <Separator />

          <p className="text-sm text-muted-foreground">
            Schedule when this menu automatically becomes available and when it should expire.
          </p>

          {/* Validation Warning */}
          {config.enabled && !isValidSchedule() && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {!config.activationTime
                  ? 'Activation time is required when scheduling is enabled.'
                  : new Date(config.activationTime) <= new Date()
                  ? 'Activation time must be in the future.'
                  : config.deactivationTime && new Date(config.deactivationTime) <= new Date(config.activationTime)
                  ? 'Deactivation time must be after activation time.'
                  : 'Invalid schedule configuration.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Timezone Selection */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Timezone</Label>
              <Select
                value={config.timezone}
                onValueChange={(value) => updateConfig({ timezone: value })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Activation Time */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <Label className="text-sm font-semibold">Activation Time</Label>
              </div>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(config.activationTime)}
                onChange={(e) => handleActivationTimeChange(e.target.value)}
                disabled={disabled}
                className="w-full"
              />
              {config.activationTime && (
                <p className="text-xs text-muted-foreground">
                  Menu will activate: {formatDisplayDate(config.activationTime, config.timezone)}
                </p>
              )}
            </div>

            {/* Deactivation Time */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-600" />
                <Label className="text-sm font-semibold">Deactivation Time (Optional)</Label>
              </div>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(config.deactivationTime)}
                onChange={(e) => handleDeactivationTimeChange(e.target.value)}
                disabled={disabled}
                className="w-full"
              />
              {config.deactivationTime ? (
                <p className="text-xs text-muted-foreground">
                  Menu will deactivate: {formatDisplayDate(config.deactivationTime, config.timezone)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Leave empty for no automatic deactivation
                </p>
              )}
            </div>

            <Separator />

            {/* Recurrence Pattern */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-semibold">Recurrence</Label>
              </div>
              <Select
                value={config.recurrencePattern}
                onValueChange={(value) =>
                  updateConfig({
                    recurrencePattern: value as MenuScheduleConfig['recurrencePattern'],
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recurrence pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No recurrence (one-time)</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {config.recurrencePattern === 'none'
                  ? 'Menu will only be active during the scheduled window once.'
                  : config.recurrencePattern === 'daily'
                  ? 'Menu will automatically reschedule for the same time every day.'
                  : config.recurrencePattern === 'weekly'
                  ? 'Menu will automatically reschedule for the same time every week.'
                  : 'Menu will automatically reschedule for the same time every month.'}
              </p>
            </div>

            {/* Schedule Preview */}
            {config.enabled && config.activationTime && (
              <>
                <Separator />
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Schedule Preview</h4>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Activates:</span>{' '}
                      <span className="font-medium">
                        {formatDisplayDate(config.activationTime, config.timezone)}
                      </span>
                    </p>
                    {config.deactivationTime && (
                      <p>
                        <span className="text-muted-foreground">Deactivates:</span>{' '}
                        <span className="font-medium">
                          {formatDisplayDate(config.deactivationTime, config.timezone)}
                        </span>
                      </p>
                    )}
                    {config.recurrencePattern !== 'none' && (
                      <p>
                        <span className="text-muted-foreground">Repeats:</span>{' '}
                        <span className="font-medium capitalize">{config.recurrencePattern}</span>
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Quick Schedule Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(9, 0, 0, 0);
                  updateConfig({ activationTime: tomorrow.toISOString() });
                }}
                disabled={disabled}
              >
                Tomorrow 9 AM
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  nextWeek.setHours(9, 0, 0, 0);
                  updateConfig({ activationTime: nextWeek.toISOString() });
                }}
                disabled={disabled}
              >
                Next Week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (config.activationTime) {
                    const activation = new Date(config.activationTime);
                    const deactivation = new Date(activation);
                    deactivation.setHours(deactivation.getHours() + 24);
                    updateConfig({ deactivationTime: deactivation.toISOString() });
                  }
                }}
                disabled={disabled || !config.activationTime}
              >
                +24h Duration
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (config.activationTime) {
                    const activation = new Date(config.activationTime);
                    const deactivation = new Date(activation);
                    deactivation.setDate(deactivation.getDate() + 7);
                    updateConfig({ deactivationTime: deactivation.toISOString() });
                  }
                }}
                disabled={disabled || !config.activationTime}
              >
                +1 Week Duration
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
