import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bell, Mail, MessageSquare, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface NotificationSettingsProps {
  settings: any;
  onChange: (settings: any) => void;
}

export const NotificationSettings = ({ settings, onChange }: NotificationSettingsProps) => {
  const [config, setConfig] = useState(settings || {
    email_enabled: true,
    email_addresses: [],
    sms_enabled: false,
    sms_numbers: [],
    webhook_enabled: false,
    webhook_url: '',
    events: {
      access_attempt: true,
      screenshot_detected: true,
      geofence_violation: true,
      suspicious_activity: true,
      order_placed: true,
      view_limit_reached: true
    }
  });

  const updateConfig = (updates: any) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Email Notifications</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled">Enable Email Alerts</Label>
            <Switch
              id="email-enabled"
              checked={config.email_enabled}
              onCheckedChange={(checked) => updateConfig({ email_enabled: checked })}
            />
          </div>
          
          {config.email_enabled && (
            <div>
              <Label>Email Addresses</Label>
              <Input
                placeholder="admin@example.com, security@example.com"
                value={config.email_addresses.join(', ')}
                onChange={(e) => {
                  const emails = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateConfig({ email_addresses: emails });
                }}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple emails with commas
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">SMS Notifications</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sms-enabled">Enable SMS Alerts</Label>
            <Switch
              id="sms-enabled"
              checked={config.sms_enabled}
              onCheckedChange={(checked) => updateConfig({ sms_enabled: checked })}
            />
          </div>
          
          {config.sms_enabled && (
            <div>
              <Label>Phone Numbers</Label>
              <Input
                placeholder="+1234567890, +0987654321"
                value={config.sms_numbers.join(', ')}
                onChange={(e) => {
                  const numbers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateConfig({ sms_numbers: numbers });
                }}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include country code, separate with commas
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Webhook Integration</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="webhook-enabled">Enable Webhook</Label>
            <Switch
              id="webhook-enabled"
              checked={config.webhook_enabled}
              onCheckedChange={(checked) => updateConfig({ webhook_enabled: checked })}
            />
          </div>
          
          {config.webhook_enabled && (
            <div>
              <Label>Webhook URL</Label>
              <Input
                placeholder="https://your-server.com/webhook"
                value={config.webhook_url}
                onChange={(e) => updateConfig({ webhook_url: e.target.value })}
                className="mt-2"
              />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Event Selection</h3>
        </div>
        
        <div className="space-y-3">
          {Object.entries(config.events).map(([event, enabled]) => (
            <div key={event} className="flex items-center justify-between">
              <Label htmlFor={event} className="text-sm capitalize">
                {event.replace(/_/g, ' ')}
              </Label>
              <Switch
                id={event}
                checked={enabled as boolean}
                onCheckedChange={(checked) => {
                  updateConfig({
                    events: { ...config.events, [event]: checked }
                  });
                }}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
