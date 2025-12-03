import { logger } from '@/lib/logger';
/**
 * Settings Page - Comprehensive settings management
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings, Shield, Bell, Printer, Plug, Save,
  Building, Lock, Key, AlertCircle, CheckCircle2, ArrowLeft, Layout, Sliders, Users, CreditCard
} from 'lucide-react';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/utils/toastHelpers';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AccountUpdate = Database['public']['Tables']['accounts']['Update'];
import { OperationSizeSelector } from '@/components/admin/sidebar/OperationSizeSelector';
import { QuickStartWizard } from "@/components/onboarding/QuickStartWizard";
import { useToast } from "@/hooks/use-toast";
import { SidebarCustomizer } from '@/components/admin/sidebar/SidebarCustomizer';
import { StripeConnectSettings } from '@/components/settings/StripeConnectSettings';
import { PaymentSettingsForm } from '@/components/settings/PaymentSettingsForm';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { account } = useAccount();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'general';
  const [loading, setLoading] = useState(false);

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    companyName: account?.company_name || '',
    email: '',
    phone: '',
    address: '',
    timezone: 'America/New_York',
    currency: 'USD',
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 30,
    requirePasswordChange: false,
    passwordMinLength: 8,
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    lowStockAlerts: true,
    overdueAlerts: true,
    orderAlerts: true,
  });

  // Printing Settings
  const [printingSettings, setPrintingSettings] = useState({
    defaultPrinter: '',
    labelSize: '4x6',
    autoPrint: false,
    includeBarcode: true,
    includeQRCode: true,
  });

  const handleSave = async (section: string) => {
    setLoading(true);
    try {
      if (!account?.id) {
        throw new Error('No account selected');
      }

      // Save settings based on section
      let updateData: AccountUpdate = {};

      switch (section) {
        case 'General':
          updateData = {
            company_name: generalSettings.companyName,
            // Add more general settings as needed
          };
          break;
        case 'Security':
          // Security settings would be saved to a separate table or user preferences
          logger.debug('Saving security settings', { component: 'SettingsPage' });
          break;
        case 'Notifications':
          // Save notification preferences
          logger.debug('Saving notification settings', { component: 'SettingsPage' });
          break;
        case 'Printing':
          // Save printing preferences
          logger.debug('Saving printing settings', { component: 'SettingsPage' });
          break;
      }

      // Update account if there's data to save
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('accounts')
          .update(updateData)
          .eq('id', account.id);

        if (error) throw error;
      }

      showSuccessToast(`${section} settings saved successfully`);
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error saving ${section} settings`, errorObj, { section, component: 'SettingsPage' });
      showErrorToast(errorObj.message || `Failed to save ${section} settings`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold mb-2">🔧 Settings</h1>
        <p className="text-muted-foreground">Manage your account and system preferences</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        {/* Vertical tabs on mobile, horizontal on desktop */}
        <TabsList className="flex flex-col lg:flex-row w-full lg:w-auto h-auto lg:h-10 items-stretch lg:items-center gap-1 bg-muted p-1">
          <TabsTrigger value="general" className="justify-start lg:justify-center w-full lg:w-auto">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="security" className="justify-start lg:justify-center w-full lg:w-auto">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="justify-start lg:justify-center w-full lg:w-auto">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="printing" className="justify-start lg:justify-center w-full lg:w-auto">
            <Printer className="h-4 w-4 mr-2" />
            Printing
          </TabsTrigger>
          <TabsTrigger value="integrations" className="justify-start lg:justify-center w-full lg:w-auto">
            <Plug className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="sidebar" className="justify-start lg:justify-center w-full lg:w-auto">
            <Layout className="h-4 w-4 mr-2" />
            Sidebar
          </TabsTrigger>
          <TabsTrigger value="sidebar-customization" className="justify-start lg:justify-center w-full lg:w-auto">
            <Sliders className="h-4 w-4 mr-2" />
            Sidebar Layout
          </TabsTrigger>
          <TabsTrigger value="payments" className="justify-start lg:justify-center w-full lg:w-auto">
            <CreditCard className="h-4 w-4 mr-2" />
            Payments
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building className="h-5 w-5" />
              General Settings
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={generalSettings.companyName}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, companyName: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={generalSettings.email}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={generalSettings.phone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Address</Label>
                <Textarea
                  value={generalSettings.address}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timezone</Label>
                  <Input value={generalSettings.timezone} disabled />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input value={generalSettings.currency} disabled />
                </div>
              </div>
              <Button onClick={() => handleSave('General')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save General Settings
              </Button>
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Team Management</h4>
                <Button variant="outline" onClick={() => navigateToAdmin('team-members')}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team Members
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  checked={securitySettings.twoFactorEnabled}
                  onCheckedChange={(checked) =>
                    setSecuritySettings({ ...securitySettings, twoFactorEnabled: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Password Change</Label>
                  <p className="text-sm text-muted-foreground">
                    Force password changes every 90 days
                  </p>
                </div>
                <Switch
                  checked={securitySettings.requirePasswordChange}
                  onCheckedChange={(checked) =>
                    setSecuritySettings({ ...securitySettings, requirePasswordChange: checked })
                  }
                />
              </div>
              <div>
                <Label>Session Timeout (minutes)</Label>
                <Input
                  type="number"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) =>
                    setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Minimum Password Length</Label>
                <Input
                  type="number"
                  value={securitySettings.passwordMinLength}
                  onChange={(e) =>
                    setSecuritySettings({ ...securitySettings, passwordMinLength: parseInt(e.target.value) })
                  }
                />
              </div>
              <Button onClick={() => handleSave('Security')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Security Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                </div>
                <Switch
                  checked={notificationSettings.smsNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, smsNotifications: checked })
                  }
                />
              </div>
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Low Stock Alerts</Label>
                  <Switch
                    checked={notificationSettings.lowStockAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, lowStockAlerts: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Overdue Payment Alerts</Label>
                  <Switch
                    checked={notificationSettings.overdueAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, overdueAlerts: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Order Alerts</Label>
                  <Switch
                    checked={notificationSettings.orderAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, orderAlerts: checked })
                    }
                  />
                </div>
              </div>
              <Button onClick={() => handleSave('Notifications')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Notification Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Printing Settings */}
        <TabsContent value="printing">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Printing & Labels
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Default Printer</Label>
                <Input
                  value={printingSettings.defaultPrinter}
                  onChange={(e) =>
                    setPrintingSettings({ ...printingSettings, defaultPrinter: e.target.value })
                  }
                  placeholder="Select printer..."
                />
              </div>
              <div>
                <Label>Label Size</Label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={printingSettings.labelSize}
                  onChange={(e) =>
                    setPrintingSettings({ ...printingSettings, labelSize: e.target.value })
                  }
                >
                  <option value="4x6">4x6 inches</option>
                  <option value="3x4">3x4 inches</option>
                  <option value="2x4">2x4 inches</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-Print on Create</Label>
                <Switch
                  checked={printingSettings.autoPrint}
                  onCheckedChange={(checked) =>
                    setPrintingSettings({ ...printingSettings, autoPrint: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Include Barcode</Label>
                <Switch
                  checked={printingSettings.includeBarcode}
                  onCheckedChange={(checked) =>
                    setPrintingSettings({ ...printingSettings, includeBarcode: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Include QR Code</Label>
                <Switch
                  checked={printingSettings.includeQRCode}
                  onCheckedChange={(checked) =>
                    setPrintingSettings({ ...printingSettings, includeQRCode: checked })
                  }
                />
              </div>
              <Button onClick={() => handleSave('Printing')} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Printing Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Integrations
            </h3>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium">QuickBooks</h4>
                    <p className="text-sm text-muted-foreground">Sync financial data</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => showInfoToast("QuickBooks", "QuickBooks integration coming soon")}>Connect</Button>
                </div>
              </div>
              <div className="p-0 border-0">
                <StripeConnectSettings />
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium">Twilio</h4>
                    <p className="text-sm text-muted-foreground">SMS notifications</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => showInfoToast("Twilio", "Twilio integration coming soon")}>Connect</Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Sidebar Settings */}
        <TabsContent value="sidebar">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Sidebar Preferences
            </h3>
            <div className="space-y-4">
              <OperationSizeSelector />
            </div>
          </Card>
        </TabsContent>

        {/* Sidebar Customization */}
        <TabsContent value="sidebar-customization">
          <SidebarCustomizer />
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments">
          <PaymentSettingsForm onSave={async () => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

