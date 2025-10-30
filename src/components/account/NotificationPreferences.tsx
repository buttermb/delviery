/**
 * Notification Preferences Component
 * Manage notification settings
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, MessageSquare, Package, Gift, Tag, TrendingUp, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationPref {
  id: string;
  category: string;
  icon: any;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export default function NotificationPreferences() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPref[]>([
    {
      id: 'order',
      category: 'Order Updates',
      icon: Package,
      email: true,
      sms: true,
      push: true
    },
    {
      id: 'promotion',
      category: 'Promotions & Deals',
      icon: Tag,
      email: true,
      sms: false,
      push: true
    },
    {
      id: 'reward',
      category: 'Rewards & Referrals',
      icon: Gift,
      email: true,
      sms: false,
      push: true
    },
    {
      id: 'security',
      category: 'Security Alerts',
      icon: User,
      email: true,
      sms: true,
      push: true
    },
    {
      id: 'newsletter',
      category: 'Newsletter',
      icon: Mail,
      email: true,
      sms: false,
      push: false
    }
  ]);

  const handleToggle = (id: string, type: 'email' | 'sms' | 'push') => {
    setPreferences(preferences.map(pref => {
      if (pref.id === id) {
        return {
          ...pref,
          [type]: !pref[type]
        };
      }
      return pref;
    }));

    toast({ 
      title: 'Preferences updated',
      description: 'Your notification settings have been saved'
    });
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
      </CardContent>
    </Card>
  );
}

