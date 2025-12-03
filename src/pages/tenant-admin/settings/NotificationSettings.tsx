import { useState } from 'react';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
} from '@/components/settings/SettingsSection';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  ShoppingCart,
  Package,
  DollarSign,
  AlertTriangle,
  Moon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface NotificationPreference {
  email: boolean;
  sms: boolean;
  push: boolean;
}

interface NotificationSettings {
  orders: NotificationPreference;
  inventory: NotificationPreference;
  payments: NotificationPreference;
  system: NotificationPreference;
}

const NOTIFICATION_TYPES = [
  { id: 'orders', label: 'New Orders', description: 'When a new order is placed', icon: ShoppingCart },
  { id: 'inventory', label: 'Low Stock', description: 'When inventory runs low', icon: Package },
  { id: 'payments', label: 'Payments', description: 'Payment confirmations and issues', icon: DollarSign },
  { id: 'system', label: 'System Alerts', description: 'Security and system notifications', icon: AlertTriangle },
];

const CHANNELS = ['email', 'sms', 'push'] as const;

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    orders: { email: true, sms: true, push: true },
    inventory: { email: true, sms: false, push: true },
    payments: { email: true, sms: true, push: false },
    system: { email: true, sms: false, push: true },
  });

  const [quietHours, setQuietHours] = useState({
    enabled: true,
    start: '22:00',
    end: '08:00',
  });

  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleToggle = (type: keyof NotificationSettings, channel: keyof NotificationPreference) => {
    setSettings((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channel]: !prev[type][channel],
      },
    }));
    toast({ title: 'Preference updated' });
  };

  const handleEnableAll = () => {
    const allEnabled = {
      orders: { email: true, sms: true, push: true },
      inventory: { email: true, sms: true, push: true },
      payments: { email: true, sms: true, push: true },
      system: { email: true, sms: true, push: true },
    };
    setSettings(allEnabled);
    toast({ title: 'All notifications enabled' });
  };

  const handleDisableAll = () => {
    const allDisabled = {
      orders: { email: false, sms: false, push: false },
      inventory: { email: false, sms: false, push: false },
      payments: { email: false, sms: false, push: false },
      system: { email: true, sms: false, push: false }, // Keep system email for critical alerts
    };
    setSettings(allDisabled);
    toast({ title: 'Non-critical notifications disabled' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
        <p className="text-muted-foreground mt-1">
          Control how and when you receive notifications
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleEnableAll}>
          Enable All
        </Button>
        <Button variant="outline" size="sm" onClick={handleDisableAll}>
          Disable All
        </Button>
      </div>

      {/* Notification Matrix */}
      <SettingsSection
        title="Notification Preferences"
        description="Choose how to receive different types of notifications"
        icon={Bell}
      >
        <SettingsCard>
          {/* Header Row */}
          <div className="flex items-center border-b pb-4 mb-4">
            <div className="flex-1" />
            <div className="flex gap-8">
              <div className="w-16 text-center">
                <Mail className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium">Email</span>
              </div>
              <div className="w-16 text-center">
                <Smartphone className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium">SMS</span>
              </div>
              <div className="w-16 text-center">
                <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs font-medium">Push</span>
              </div>
            </div>
          </div>

          {/* Notification Types */}
          <div className="space-y-1">
            {NOTIFICATION_TYPES.map((type) => {
              const Icon = type.icon;
              const prefs = settings[type.id as keyof NotificationSettings];

              return (
                <div
                  key={type.id}
                  className="flex items-center py-4 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-8">
                    {CHANNELS.map((channel) => (
                      <div key={channel} className="w-16 flex justify-center">
                        <Switch
                          checked={prefs[channel]}
                          onCheckedChange={() => handleToggle(type.id as keyof NotificationSettings, channel)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Quiet Hours */}
      <SettingsSection
        title="Quiet Hours"
        description="Pause non-critical notifications during specific hours"
        icon={Moon}
      >
        <SettingsCard>
          <SettingsRow
            label="Enable Quiet Hours"
            description="Only critical alerts will be sent during this time"
          >
            <Switch
              checked={quietHours.enabled}
              onCheckedChange={(checked) => setQuietHours({ ...quietHours, enabled: checked })}
            />
          </SettingsRow>

          {quietHours.enabled && (
            <div className="flex items-center gap-4 pt-4 border-t">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Start</label>
                <Input
                  type="time"
                  value={quietHours.start}
                  onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                  className="w-28"
                />
              </div>
              <span className="text-muted-foreground mt-5">to</span>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">End</label>
                <Input
                  type="time"
                  value={quietHours.end}
                  onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                  className="w-28"
                />
              </div>
              <Badge variant="secondary" className="mt-5">
                {quietHours.start} - {quietHours.end}
              </Badge>
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Sound Settings */}
      <SettingsSection
        title="Sound"
        description="Control notification sounds"
        icon={soundEnabled ? Volume2 : VolumeX}
      >
        <SettingsCard>
          <SettingsRow
            label="Notification Sounds"
            description="Play a sound when notifications arrive"
          >
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* Preview */}
      <SettingsCard className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Preview Notification</p>
            <p className="text-sm text-muted-foreground mt-1">
              This is how notifications will appear. You can test your settings here.
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              Send Test Notification
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

