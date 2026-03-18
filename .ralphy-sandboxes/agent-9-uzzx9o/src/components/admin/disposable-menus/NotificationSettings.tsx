import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, MessageSquare, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';
interface NotificationTemplate {
  event: string;
  enabled: boolean;
  subject?: string;
  message: string;
}

export const NotificationSettings = () => {
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([
    {
      event: 'order_placed',
      enabled: true,
      subject: 'Order Confirmation',
      message: 'Thank you for your order! Your order #{{order_id}} has been received and is being processed.'
    },
    {
      event: 'order_processing',
      enabled: true,
      subject: 'Order Processing',
      message: 'Your order #{{order_id}} is now being prepared.'
    },
    {
      event: 'order_completed',
      enabled: true,
      subject: 'Order Ready',
      message: 'Your order #{{order_id}} is ready! Total: ${{total_amount}}'
    },
    {
      event: 'order_cancelled',
      enabled: true,
      subject: 'Order Cancelled',
      message: 'Your order #{{order_id}} has been cancelled.'
    }
  ]);

  const [notificationChannels, setNotificationChannels] = useState({
    email: true,
    sms: false,
    push: false
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.templates) {
          setTemplates(parsed.templates);
        }
        if (parsed.channels) {
          setNotificationChannels(parsed.channels);
        }
      } catch (error) {
        logger.warn('Failed to parse JSON', error);
      }
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, JSON.stringify({
        templates,
        channels: notificationChannels
      }));

      toast.success("Notification settings have been updated successfully.");
    } catch (error: unknown) {
      const _errorMessage = error instanceof Error ? error.message : 'Save failed';
      toast.error("Save Failed");
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (index: number, field: keyof NotificationTemplate, value: string | boolean) => {
    const updated = [...templates];
    updated[index] = { ...updated[index], [field]: value };
    setTemplates(updated);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how to notify customers about their orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Send order updates via email</p>
              </div>
            </div>
            <Switch
              checked={notificationChannels.email}
              onCheckedChange={(checked) => 
                setNotificationChannels({ ...notificationChannels, email: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Send order updates via SMS</p>
              </div>
            </div>
            <Switch
              checked={notificationChannels.sms}
              onCheckedChange={(checked) => 
                setNotificationChannels({ ...notificationChannels, sms: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Send browser push notifications</p>
              </div>
            </div>
            <Switch
              checked={notificationChannels.push}
              onCheckedChange={(checked) => 
                setNotificationChannels({ ...notificationChannels, push: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Templates</CardTitle>
          <CardDescription>
            Customize messages for different order events. Use variables like {'{{order_id}}'}, {'{{total_amount}}'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {templates.map((template, index) => (
            <div key={template.event} className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base capitalize">
                  {template.event.replace('_', ' ')}
                </Label>
                <Switch
                  checked={template.enabled}
                  onCheckedChange={(checked) => updateTemplate(index, 'enabled', checked)}
                />
              </div>

              {template.enabled && (
                <>
                  {template.subject && (
                    <div className="space-y-2">
                      <Label className="text-sm">Subject</Label>
                      <Input
                        value={template.subject}
                        onChange={(e) => updateTemplate(index, 'subject', e.target.value)}
                        placeholder="Email subject"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm">Message</Label>
                    <Textarea
                      value={template.message}
                      onChange={(e) => updateTemplate(index, 'message', e.target.value)}
                      placeholder="Notification message"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
