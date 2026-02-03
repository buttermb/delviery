/**
 * Notification Preferences Component
 * Manage notification settings (persisted to Supabase)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import Bell from "lucide-react/dist/esm/icons/bell";
import Mail from "lucide-react/dist/esm/icons/mail";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Package from "lucide-react/dist/esm/icons/package";
import Gift from "lucide-react/dist/esm/icons/gift";
import Tag from "lucide-react/dist/esm/icons/tag";
import User from "lucide-react/dist/esm/icons/user";
import type { LucideIcon } from "lucide-react";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationPref {
  id: string;
  category: string;
  icon: LucideIcon;
  email: boolean;
  sms: boolean;
  push: boolean;
}

// Database schema for notification_preferences
interface DbNotificationPrefs {
  id: string;
  user_id: string;
  email_enabled: boolean | null;
  email_all_updates: boolean | null;
  sms_enabled: boolean | null;
  sms_all_updates: boolean | null;
  push_enabled: boolean | null;
  push_all_updates: boolean | null;
}

// Default preferences when no database record exists
const DEFAULT_PREFERENCES: NotificationPref[] = [
  { id: 'order', category: 'Order Updates', icon: Package, email: true, sms: true, push: true },
  { id: 'promotion', category: 'Promotions & Deals', icon: Tag, email: true, sms: false, push: true },
  { id: 'reward', category: 'Rewards & Referrals', icon: Gift, email: true, sms: false, push: true },
  { id: 'security', category: 'Security Alerts', icon: User, email: true, sms: true, push: true },
  { id: 'newsletter', category: 'Newsletter', icon: Mail, email: true, sms: false, push: false },
];

// Map database preferences to component format
function mapDbToPreferences(db: DbNotificationPrefs | null): NotificationPref[] {
  if (!db) return DEFAULT_PREFERENCES;
  return [
    { id: 'order', category: 'Order Updates', icon: Package, email: db.email_all_updates ?? true, sms: db.sms_all_updates ?? true, push: db.push_all_updates ?? true },
    { id: 'promotion', category: 'Promotions & Deals', icon: Tag, email: db.email_enabled ?? true, sms: false, push: db.push_enabled ?? true },
    { id: 'reward', category: 'Rewards & Referrals', icon: Gift, email: db.email_enabled ?? true, sms: false, push: db.push_enabled ?? true },
    { id: 'security', category: 'Security Alerts', icon: User, email: true, sms: db.sms_enabled ?? true, push: true },
    { id: 'newsletter', category: 'Newsletter', icon: Mail, email: db.email_enabled ?? true, sms: false, push: false },
  ];
}

export default function NotificationPreferences() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notification preferences from database
  const { data: preferences = DEFAULT_PREFERENCES, isLoading } = useQuery({
    queryKey: ['user-notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_PREFERENCES;
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return mapDbToPreferences(data);
    },
    enabled: !!user?.id,
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, type, value }: { id: string; type: 'email' | 'sms' | 'push'; value: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Map preference id and type to database column
      const columnMap: Record<string, string> = {
        'order-email': 'email_all_updates',
        'order-sms': 'sms_all_updates',
        'order-push': 'push_all_updates',
        'promotion-email': 'email_enabled',
        'promotion-push': 'push_enabled',
        'reward-email': 'email_enabled',
        'reward-push': 'push_enabled',
        'security-sms': 'sms_enabled',
        'newsletter-email': 'email_enabled',
      };

      const column = columnMap[`${id}-${type}`];
      if (!column) return; // No database mapping for this toggle

      const updateData = { [column]: value };

      // Upsert the preference record
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...updateData,
        }, {
          onConflict: 'user_id',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notification-preferences'] });
      toast({
        title: 'Preferences updated',
        description: 'Your notification settings have been saved'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save preferences',
        variant: 'destructive'
      });
    }
  });

  const handleToggle = (id: string, type: 'email' | 'sms' | 'push') => {
    const pref = preferences.find(p => p.id === id);
    if (!pref) return;
    const newValue = !pref[type];
    updateMutation.mutate({ id, type, value: newValue });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how you want to be notified
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <div className="space-y-4">
          {preferences.map((pref) => {
            const Icon = pref.icon;
            return (
              <div key={pref.id}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Label htmlFor={pref.id} className="font-semibold cursor-pointer">
                      {pref.category}
                    </Label>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 pl-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Email</span>
                    </div>
                    <Switch
                      checked={pref.email}
                      onCheckedChange={() => handleToggle(pref.id, 'email')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">SMS</span>
                    </div>
                    <Switch
                      checked={pref.sms}
                      onCheckedChange={() => handleToggle(pref.id, 'sms')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Push</span>
                    </div>
                    <Switch
                      checked={pref.push}
                      onCheckedChange={() => handleToggle(pref.id, 'push')}
                    />
                  </div>
                </div>
                
                {pref.id !== preferences[preferences.length - 1].id && (
                  <Separator className="mt-4" />
                )}
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}

