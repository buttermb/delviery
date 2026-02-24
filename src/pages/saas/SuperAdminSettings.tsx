/**
 * Super Admin Settings
 * Platform-wide configuration and preferences
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  AlertTriangle,
  Save,
  ArrowLeft,
  Shield,
  Bell,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/utils/errorHandling/handlers';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export default function SuperAdminSettings() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [platformSettings, setPlatformSettings] = useState({
    platformName: 'FloraIQ',
    supportEmail: 'support@platform.com',
    adminEmail: 'admin@platform.com',
    maxTenants: 10000,
    trialDays: 14,
    enableSignups: true,
    requireEmailVerification: true,
    enable2FA: false,
    maintenanceMode: false,
    maintenanceMessage: 'Platform is undergoing maintenance',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // In production, save to a platform_settings table
      // For now, save to localStorage
      localStorage.setItem(STORAGE_KEYS.PLATFORM_SETTINGS, JSON.stringify(platformSettings));

      toast.success('Platform settings have been updated');
    } catch (error) {
      handleError(error, { component: 'SuperAdminSettings', toastTitle: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/saas/admin')} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">⚙️ Platform Settings</h1>
          <p className="text-muted-foreground">Configure platform-wide settings and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="limits">Limits & Quotas</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Platform Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="platformName">Platform Name</Label>
                <Input
                  id="platformName"
                  value={platformSettings.platformName}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, platformName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={platformSettings.supportEmail}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, supportEmail: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="adminEmail">Admin Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={platformSettings.adminEmail}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, adminEmail: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signup & Onboarding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Public Signups</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow new tenants to sign up via the registration page
                  </p>
                </div>
                <Switch
                  checked={platformSettings.enableSignups}
                  onCheckedChange={(checked) =>
                    setPlatformSettings({ ...platformSettings, enableSignups: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Email Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Require email verification before account activation
                  </p>
                </div>
                <Switch
                  checked={platformSettings.requireEmailVerification}
                  onCheckedChange={(checked) =>
                    setPlatformSettings({
                      ...platformSettings,
                      requireEmailVerification: checked,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="trialDays">Trial Period (Days)</Label>
                <Input
                  id="trialDays"
                  type="number"
                  value={platformSettings.trialDays}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      trialDays: parseInt(e.target.value) || 14,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Show maintenance page to all non-admin users
                  </p>
                </div>
                <Switch
                  checked={platformSettings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setPlatformSettings({ ...platformSettings, maintenanceMode: checked })
                  }
                />
              </div>
              {platformSettings.maintenanceMode && (
                <div>
                  <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                  <Input
                    id="maintenanceMessage"
                    value={platformSettings.maintenanceMessage}
                    onChange={(e) =>
                      setPlatformSettings({
                        ...platformSettings,
                        maintenanceMessage: e.target.value,
                      })
                    }
                    placeholder="We'll be back soon!"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require 2FA for Admins</Label>
                  <p className="text-sm text-muted-foreground">
                    Force two-factor authentication for all admin users
                  </p>
                </div>
                <Switch
                  checked={platformSettings.enable2FA}
                  onCheckedChange={(checked) =>
                    setPlatformSettings({ ...platformSettings, enable2FA: checked })
                  }
                />
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-500 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-100">
                      Security Recommendations
                    </p>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-200 mt-2 space-y-1">
                      <li>• Enable 2FA for all admin accounts</li>
                      <li>• Regularly rotate API keys</li>
                      <li>• Review audit logs weekly</li>
                      <li>• Keep dependencies updated</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notification Channels</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Send email alerts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">Send SMS alerts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">In-App Notifications</p>
                      <p className="text-sm text-muted-foreground">Show in-app alerts</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Limits & Quotas */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Platform Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="maxTenants">Maximum Tenants</Label>
                <Input
                  id="maxTenants"
                  type="number"
                  value={platformSettings.maxTenants}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      maxTenants: parseInt(e.target.value) || 10000,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of tenants allowed on the platform
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

