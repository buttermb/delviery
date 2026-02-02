import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import Clock from "lucide-react/dist/esm/icons/clock";
import { Separator } from '@/components/ui/separator';

interface TimeRestrictionConfig {
  enabled: boolean;
  allowed_hours: {
    start: string;
    end: string;
  };
  allowed_days: Record<string, boolean>;
  timezone: string;
  [key: string]: unknown;
}

interface TimeRestrictionSettingsProps {
  settings: TimeRestrictionConfig;
  onChange: (settings: TimeRestrictionConfig) => void;
}

export const TimeRestrictionSettings = ({ settings, onChange }: TimeRestrictionSettingsProps) => {
  const [config, setConfig] = useState(settings || {
    enabled: false,
    allowed_hours: {
      start: '09:00',
      end: '17:00'
    },
    allowed_days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    },
    timezone: 'America/New_York'
  });

  const updateConfig = (updates: Partial<TimeRestrictionConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  const updateDay = (day: string, enabled: boolean) => {
    const newDays = { ...config.allowed_days, [day]: enabled };
    updateConfig({ allowed_days: newDays });
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Time Restrictions</h3>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => updateConfig({ enabled: checked })}
        />
      </div>

      {config.enabled && (
        <>
          <Separator />
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-3 block">Access Hours</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={config.allowed_hours.start}
                    onChange={(e) => updateConfig({
                      allowed_hours: { ...config.allowed_hours, start: e.target.value }
                    })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={config.allowed_hours.end}
                    onChange={(e) => updateConfig({
                      allowed_hours: { ...config.allowed_hours, end: e.target.value }
                    })}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Access allowed between these hours ({config.timezone})
              </p>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-semibold mb-3 block">Allowed Days</Label>
              <div className="space-y-2">
                {Object.entries(config.allowed_days).map(([day, enabled]) => (
                  <div key={day} className="flex items-center justify-between">
                    <Label className="text-sm capitalize">{day}</Label>
                    <Switch
                      checked={enabled as boolean}
                      onCheckedChange={(checked) => updateDay(day, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-xs">Timezone</Label>
              <Input
                value={config.timezone}
                onChange={(e) => updateConfig({ timezone: e.target.value })}
                placeholder="America/New_York"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                IANA timezone identifier
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
