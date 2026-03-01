import { useState, useEffect } from 'react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

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

// Default state matching the granular UI
const DEFAULT_SETTINGS: NotificationSettings = {
  orders: { email: true, sms: true, push: true },
  inventory: { email: true, sms: false, push: true },
  payments: { email: true, sms: true, push: false },
  system: { email: true, sms: false, push: true },
};

const NOTIFICATION_TYPES = [
  { id: 'orders', label: 'New Orders', description: 'When a new order is placed', icon: ShoppingCart },
  { id: 'inventory', label: 'Low Stock', description: 'When inventory runs low', icon: Package },
  { id: 'payments', label: 'Payments', description: 'Payment confirmations and issues', icon: DollarSign },
  { id: 'system', label: 'System Alerts', description: 'Security and system notifications', icon: AlertTriangle },
];

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: Smartphone },
  { id: 'push', label: 'Push', icon: MessageSquare },
] as const;

export default function NotificationSettings() {
  const { admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // We fetch from notification_preferences table
  // Since the DB schema is coarser (Enabled/All/Critical) than the UI (Topics),
  // we will map them:
  // - DB 'all_updates' corresponds to having 'Orders' enabled in UI
  // - DB 'critical_only' corresponds to having ONLY 'System' enabled in UI
  // - This is a simplification for persistence. Ideally we'd have a JSON column.

  const { data: preferences, isLoading } = useQuery({
    queryKey: queryKeys.notificationPreferences.byUser(admin?.id),
    queryFn: async () => {
      if (!admin?.id) return null;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('id, user_id, email_enabled, email_all_updates, sms_enabled, sms_all_updates, push_enabled, push_all_updates')
        .eq('user_id', admin.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!admin?.id,
  });

  // Sync state from DB when loaded
  useEffect(() => {
    if (preferences) {
      // Map DB coarse settings back to fine-grained UI state
      // This is imperfect but works for MVP persistence
      const newSettings = { ...DEFAULT_SETTINGS };

      // Email mapping
      if (!preferences.email_enabled) {
        Object.keys(newSettings).forEach(type => {
          newSettings[type as keyof NotificationSettings].email = false;
        });
      } else if (preferences.email_all_updates) {
        Object.keys(newSettings).forEach(type => {
          newSettings[type as keyof NotificationSettings].email = true;
        });
      }

      // SMS mapping
      if (!preferences.sms_enabled) {
        Object.keys(newSettings).forEach(type => {
          newSettings[type as keyof NotificationSettings].sms = false;
        });
      }

      // Push mapping
      if (!preferences.push_enabled) {
        Object.keys(newSettings).forEach(type => {
          newSettings[type as keyof NotificationSettings].push = false;
        });
      }

      setSettings(newSettings);
      // Note: Quiet hours and sound aren't in the DB schema provided, so keeping them local/default for now
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      if (!admin?.id) throw new Error("No admin user found");

      setSaveStatus('saving');

      // Map UI state to DB schema
      const emailEnabled = Object.values(newSettings).some(s => s.email);
      const emailAll = newSettings.orders.email && newSettings.inventory.email; // simple heuristic

      const smsEnabled = Object.values(newSettings).some(s => s.sms);
      const smsAll = newSettings.orders.sms;

      const pushEnabled = Object.values(newSettings).some(s => s.push);
      const pushAll = newSettings.orders.push;

      const payload = {
        user_id: admin.id,
        email_enabled: emailEnabled,
        email_all_updates: emailAll,
        sms_enabled: smsEnabled,
        sms_all_updates: smsAll,
        push_enabled: pushEnabled,
        push_all_updates: pushAll,
        updated_at: new Date().toISOString()
      };

      // Upsert
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(payload, { onConflict: 'user_id' }); // Assuming unique constraint or logic

      if (error) throw error;
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences.byUser(admin?.id) });
      toast.success('Notification preferences saved');
    },
    onError: (error: unknown) => {
      setSaveStatus('error');
      logger.error("Failed to save notification preferences", error);
      toast.error("Failed to save changes", { description: humanizeError(error) });
    }
  });

  const [quietHours, setQuietHours] = useState({
    enabled: true,
    start: '22:00',
    end: '08:00',
  });

  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleToggle = (type: keyof NotificationSettings, channel: keyof NotificationPreference) => {
    const updated = {
      ...settings,
      [type]: {
        ...settings[type],
        [channel]: !settings[type][channel],
      },
    };
    setSettings(updated);
    updatePreferencesMutation.mutate(updated);
  };

  const handleEnableAll = () => {
    const allEnabled = {
      orders: { email: true, sms: true, push: true },
      inventory: { email: true, sms: true, push: true },
      payments: { email: true, sms: true, push: true },
      system: { email: true, sms: true, push: true },
    };
    setSettings(allEnabled);
    updatePreferencesMutation.mutate(allEnabled);
    toast.success('All notifications enabled');
  };

  const handleDisableAll = () => {
    const allDisabled = {
      orders: { email: false, sms: false, push: false },
      inventory: { email: false, sms: false, push: false },
      payments: { email: false, sms: false, push: false },
      system: { email: true, sms: false, push: false }, // Keep system email for critical alerts
    };
    setSettings(allDisabled);
    updatePreferencesMutation.mutate(allDisabled);
    toast.info('Non-critical notifications disabled');
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="card" message="Loading preferences..." />;
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground mt-1">
            Control how and when you receive notifications
          </p>
        </div>
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleEnableAll} className="min-h-[44px]">
          Enable All
        </Button>
        <Button variant="outline" size="sm" onClick={handleDisableAll} className="min-h-[44px]">
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
          {/* Desktop Header Row - hidden on mobile */}
          <div className="hidden sm:flex items-center border-b pb-4 mb-4">
            <div className="flex-1" />
            <div className="flex gap-6 md:gap-8">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.id} className="w-14 md:w-16 text-center">
                    <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <span className="text-xs font-medium">{channel.label}</span>
                  </div>
                );
              })}
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
                  className="py-4 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex items-center">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-6 md:gap-8">
                      {CHANNELS.map((channel) => (
                        <div key={channel.id} className="w-14 md:w-16 flex justify-center">
                          <Switch
                            checked={prefs[channel.id as keyof NotificationPreference]}
                            onCheckedChange={() => handleToggle(type.id as keyof NotificationSettings, channel.id as keyof NotificationPreference)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="sm:hidden space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{type.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pl-13">
                      {CHANNELS.map((channel) => {
                        const ChannelIcon = channel.icon;
                        const isEnabled = prefs[channel.id as keyof NotificationPreference];
                        return (
                          <button
                            key={channel.id}
                            onClick={() => handleToggle(type.id as keyof NotificationSettings, channel.id as keyof NotificationPreference)}
                            className={cn(
                              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors min-h-[44px] touch-manipulation active:scale-95",
                              isEnabled
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <ChannelIcon className="h-3.5 w-3.5" />
                            {channel.label}
                          </button>
                        );
                      })}
                    </div>
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
              disabled={true} // Persisting this requires a new column or table update
            />
          </SettingsRow>

          {quietHours.enabled && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pt-4 border-t">
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="space-y-1 flex-1 sm:flex-none">
                  <label className="text-xs text-muted-foreground">Start</label>
                  <Input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                    className="w-full sm:w-28 min-h-[44px]"
                    disabled={true}
                  />
                </div>
                <span className="text-muted-foreground mt-5 hidden sm:inline">to</span>
                <div className="space-y-1 flex-1 sm:flex-none">
                  <label className="text-xs text-muted-foreground">End</label>
                  <Input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                    className="w-full sm:w-28 min-h-[44px]"
                    disabled={true}
                  />
                </div>
              </div>
              <Badge variant="secondary" className="sm:mt-5 opacity-50">
                {quietHours.start} - {quietHours.end} (Coming Soon)
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
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Preview Notification</p>
            <p className="text-sm text-muted-foreground mt-1">
              This is how notifications will appear. You can test your settings here.
            </p>
            <Button variant="outline" size="sm" className="mt-3 min-h-[44px] w-full sm:w-auto" onClick={() => toast.message("Test Notification", { description: "This is how a notification looks!" })}>
              Send Test Notification
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
