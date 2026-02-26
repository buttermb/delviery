import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, 
  Ban, 
  Bell, 
  Zap, 
  Lock,
  AlertTriangle,
  Save,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/constants/storageKeys';
interface SecuritySettings {
  auto_block_enabled: boolean;
  auto_block_threshold: number;
  auto_burn_on_breach: boolean;
  notify_on_critical: boolean;
  notify_on_high: boolean;
  rate_limit_enabled: boolean;
  rate_limit_requests: number;
  rate_limit_window: number;
  geofence_violation_action: 'log' | 'block' | 'burn';
  screenshot_attempt_action: 'log' | 'block' | 'burn';
  failed_access_threshold: number;
}

export const AutomatedSecuritySettings = () => {
  const [settings, setSettings] = useState<SecuritySettings>({
    auto_block_enabled: true,
    auto_block_threshold: 5,
    auto_burn_on_breach: false,
    notify_on_critical: true,
    notify_on_high: true,
    rate_limit_enabled: true,
    rate_limit_requests: 100,
    rate_limit_window: 60,
    geofence_violation_action: 'block',
    screenshot_attempt_action: 'log',
    failed_access_threshold: 3
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save settings to localStorage for now
      // In production, this would be saved to a database table
      localStorage.setItem(STORAGE_KEYS.DISPOSABLE_MENUS_SECURITY_SETTINGS, JSON.stringify(settings));

      toast.success("Security automation settings have been updated");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Automated Security Responses
          </CardTitle>
          <CardDescription>
            Configure automatic actions when security threats are detected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-blocking */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <Ban className="h-4 w-4" />
                  Auto-Block Suspicious IPs
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically block IPs after multiple failed attempts
                </p>
              </div>
              <Switch
                checked={settings.auto_block_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, auto_block_enabled: checked })
                }
              />
            </div>

            {settings.auto_block_enabled && (
              <div className="ml-6 space-y-2">
                <Label>Failed Attempts Threshold: {settings.failed_access_threshold}</Label>
                <Slider
                  value={[settings.failed_access_threshold]}
                  onValueChange={([value]) =>
                    setSettings({ ...settings, failed_access_threshold: value })
                  }
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Block IP after {settings.failed_access_threshold} failed access attempts
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Auto-burn on breach */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Auto-Burn on Critical Breach
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically burn menu when critical security breach detected
              </p>
            </div>
            <Switch
              checked={settings.auto_burn_on_breach}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, auto_burn_on_breach: checked })
              }
            />
          </div>

          <Separator />

          {/* Notifications */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Real-time Notifications
            </Label>

            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-normal">Critical Events</Label>
                <Switch
                  checked={settings.notify_on_critical}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notify_on_critical: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="font-normal">High Priority Events</Label>
                <Switch
                  checked={settings.notify_on_high}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notify_on_high: checked })
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Rate Limiting */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Rate Limiting
                </Label>
                <p className="text-sm text-muted-foreground">
                  Limit requests per IP address
                </p>
              </div>
              <Switch
                checked={settings.rate_limit_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, rate_limit_enabled: checked })
                }
              />
            </div>

            {settings.rate_limit_enabled && (
              <div className="ml-6 space-y-4">
                <div className="space-y-2">
                  <Label>Max Requests: {settings.rate_limit_requests}</Label>
                  <Slider
                    value={[settings.rate_limit_requests]}
                    onValueChange={([value]) =>
                      setSettings({ ...settings, rate_limit_requests: value })
                    }
                    min={10}
                    max={500}
                    step={10}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Time Window (seconds): {settings.rate_limit_window}</Label>
                  <Slider
                    value={[settings.rate_limit_window]}
                    onValueChange={([value]) =>
                      setSettings({ ...settings, rate_limit_window: value })
                    }
                    min={30}
                    max={300}
                    step={30}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Action Triggers */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security Event Actions
            </Label>

            <div className="ml-6 space-y-4">
              <div className="space-y-2">
                <Label>Geofence Violation</Label>
                <Select
                  value={settings.geofence_violation_action}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      geofence_violation_action: value as 'log' | 'block' | 'burn'
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="log">Log Only</SelectItem>
                    <SelectItem value="block">Block Access</SelectItem>
                    <SelectItem value="burn">Burn Menu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Screenshot Attempt</Label>
                <Select
                  value={settings.screenshot_attempt_action}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      screenshot_attempt_action: value as 'log' | 'block' | 'burn'
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="log">Log Only</SelectItem>
                    <SelectItem value="block">Block Access</SelectItem>
                    <SelectItem value="burn">Burn Menu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? 'Saving...' : 'Save Security Settings'}
        </Button>
      </div>
    </div>
  );
};
