import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Clock } from 'lucide-react';

interface ViewLimitConfig {
  enabled: boolean;
  max_views?: number;
  reset_period?: string;
  [key: string]: unknown;
}

interface ViewLimitSettingsProps {
  settings: ViewLimitConfig;
  onChange: (settings: ViewLimitConfig) => void;
}

export const ViewLimitSettings = ({ settings, onChange }: ViewLimitSettingsProps) => {
  const updateSetting = (key: string, value: string | number | boolean) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">View Limits</h3>
        </div>
        <Switch
          checked={settings?.enabled || false}
          onCheckedChange={(checked) => updateSetting('enabled', checked)}
        />
      </div>

      {settings?.enabled && (
        <div className="space-y-4">
          <div>
            <Label>Maximum Views Per Customer</Label>
            <Input
              type="number"
              min="1"
              value={String(settings?.max_views_per_period || 5)}
              onChange={(e) => updateSetting('max_views_per_period', parseInt(e.target.value))}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How many times each customer can view the menu
            </p>
          </div>

          <div>
            <Label>Tracking Period</Label>
            <Select
              value={String(settings?.tracking_period || 'week')}
              onValueChange={(value) => updateSetting('tracking_period', value)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Per Day</SelectItem>
                <SelectItem value="week">Per Week</SelectItem>
                <SelectItem value="month">Per Month</SelectItem>
                <SelectItem value="lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Period for counting views
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="reset-on-period">Reset on new period</Label>
            </div>
            <Switch
              id="reset-on-period"
              checked={Boolean(settings?.reset_on_period !== false)}
              onCheckedChange={(checked) => updateSetting('reset_on_period', checked)}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
