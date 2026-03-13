import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantContext } from '@/hooks/useTenantContext';

interface NotificationPreference {
  id: string;
  user_id: string;
  email_enabled: boolean;
  email_all_updates: boolean;
  email_confirmation_only: boolean;
  push_enabled: boolean;
  push_all_updates: boolean;
  push_critical_only: boolean;
  sms_enabled: boolean;
  sms_all_updates: boolean;
  sms_critical_only: boolean;
  created_at: string;
  updated_at: string;
}

export function NotificationPreferences() {
  const { userId, isReady } = useTenantContext();
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: queryKeys.notificationPreferences.byUser(userId!),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID required');
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch notification preferences:', error);
        throw error;
      }

      return data as NotificationPreference | null;
    },
    enabled: !!userId && isReady,
  });

  // Update preferences
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreference>) => {
      if (!userId) {
        throw new Error('User ID required');
      }

      // Check if preferences exist
      if (preferences) {
        // Update existing
        const { error } = await supabase
          .from('notification_preferences')
          .update(updates)
          .eq('user_id', userId);

        if (error) {
          logger.error('Failed to update notification preferences:', error);
          throw error;
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: userId,
            ...updates,
          });

        if (error) {
          logger.error('Failed to create notification preferences:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notificationPreferences.byUser(userId!),
      });
      toast.success('Notification preferences updated');
    },
    onError: (error) => {
      logger.error('Failed to update notification preferences:', error);
      toast.error('Failed to update notification preferences');
    },
  });

  const handleToggle = (field: keyof NotificationPreference, value: boolean) => {
    updateMutation.mutate({ [field]: value });
  };

  if (!isReady || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const prefs = preferences || {
    email_enabled: true,
    email_all_updates: false,
    email_confirmation_only: true,
    push_enabled: true,
    push_all_updates: false,
    push_critical_only: true,
    sms_enabled: false,
    sms_all_updates: false,
    sms_critical_only: false,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Manage how you receive notifications for orders, deliveries, and updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email_enabled" className="text-base">
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="email_enabled"
              checked={prefs.email_enabled}
              onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
            />
          </div>

          {prefs.email_enabled && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email_all_updates" className="text-sm font-normal">
                    All Updates
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get emails for all activity
                  </p>
                </div>
                <Switch
                  id="email_all_updates"
                  checked={prefs.email_all_updates}
                  onCheckedChange={(checked) =>
                    handleToggle('email_all_updates', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email_confirmation_only" className="text-sm font-normal">
                    Confirmation Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only order confirmations and critical alerts
                  </p>
                </div>
                <Switch
                  id="email_confirmation_only"
                  checked={prefs.email_confirmation_only}
                  onCheckedChange={(checked) =>
                    handleToggle('email_confirmation_only', checked)
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Push Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push_enabled" className="text-base">
                Push Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive in-app notifications
              </p>
            </div>
            <Switch
              id="push_enabled"
              checked={prefs.push_enabled}
              onCheckedChange={(checked) => handleToggle('push_enabled', checked)}
            />
          </div>

          {prefs.push_enabled && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push_all_updates" className="text-sm font-normal">
                    All Updates
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get notifications for all activity
                  </p>
                </div>
                <Switch
                  id="push_all_updates"
                  checked={prefs.push_all_updates}
                  onCheckedChange={(checked) =>
                    handleToggle('push_all_updates', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push_critical_only" className="text-sm font-normal">
                    Critical Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only critical alerts and urgent updates
                  </p>
                </div>
                <Switch
                  id="push_critical_only"
                  checked={prefs.push_critical_only}
                  onCheckedChange={(checked) =>
                    handleToggle('push_critical_only', checked)
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* SMS Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms_enabled" className="text-base">
                SMS Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via text message
              </p>
            </div>
            <Switch
              id="sms_enabled"
              checked={prefs.sms_enabled}
              onCheckedChange={(checked) => handleToggle('sms_enabled', checked)}
            />
          </div>

          {prefs.sms_enabled && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sms_all_updates" className="text-sm font-normal">
                    All Updates
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get SMS for all activity
                  </p>
                </div>
                <Switch
                  id="sms_all_updates"
                  checked={prefs.sms_all_updates}
                  onCheckedChange={(checked) =>
                    handleToggle('sms_all_updates', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sms_critical_only" className="text-sm font-normal">
                    Critical Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only critical alerts and urgent updates
                  </p>
                </div>
                <Switch
                  id="sms_critical_only"
                  checked={prefs.sms_critical_only}
                  onCheckedChange={(checked) =>
                    handleToggle('sms_critical_only', checked)
                  }
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
