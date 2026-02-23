/**
 * System Configuration Page
 * Platform-wide settings and configuration
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Settings, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function SystemConfigPage() {
  const [config, setConfig] = useState({
    platformName: 'Delivery Platform',
    supportEmail: 'support@example.com',
    maintenanceMode: false,
    allowSignups: true,
    defaultTrialDays: 14,
    maxTenants: -1, // -1 for unlimited
    maintenanceMessage: 'System is under maintenance. Please check back later.',
  });

  const handleSave = () => {
    toast.success('System configuration has been updated');
  };

  return (
    <>
      <SEOHead title="System Configuration - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="System Configuration"
          description="Manage platform-wide settings and configuration"
          icon={Settings}
          actions={
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Platform Name</Label>
                <Input
                  value={config.platformName}
                  onChange={(e) =>
                    setConfig({ ...config, platformName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input
                  type="email"
                  value={config.supportEmail}
                  onChange={(e) =>
                    setConfig({ ...config, supportEmail: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Default Trial Days</Label>
                <Input
                  type="number"
                  value={config.defaultTrialDays}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      defaultTrialDays: parseInt(e.target.value) || 14,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Disable access to the platform
                  </p>
                </div>
                <Switch
                  checked={config.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, maintenanceMode: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow New Signups</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable/disable new tenant registrations
                  </p>
                </div>
                <Switch
                  checked={config.allowSignups}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, allowSignups: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Message */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Maintenance Message</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={config.maintenanceMessage}
                onChange={(e) =>
                  setConfig({ ...config, maintenanceMessage: e.target.value })
                }
                className="min-h-[100px]"
                placeholder="Message to show during maintenance..."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

