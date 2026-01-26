import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Textarea } from '@/components/ui/textarea';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Settings, Shield, Bell, Printer, Plug, Save,
  Building, Layout, Sliders, Users, CreditCard, ArrowLeft, Download
} from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { OperationSizeSelector } from '@/components/admin/sidebar/OperationSizeSelector';
import { SidebarCustomizer } from '@/components/admin/sidebar/SidebarCustomizer';
import { StripeConnectSettings } from '@/components/settings/StripeConnectSettings';
import { PaymentSettingsForm } from '@/components/settings/PaymentSettingsForm';
import { useToast } from "@/hooks/use-toast";
import {
  GeneralSettingsSkeleton,
  SecuritySettingsSkeleton,
  NotificationSettingsSkeleton,
  PrintingSettingsSkeleton,
  IntegrationsSettingsSkeleton,
  SidebarSettingsSkeleton,
  SidebarCustomizationSkeleton,
  PaymentSettingsSkeleton,
} from '@/components/settings/SettingsSkeletons';

// --- Schemas ---

const generalSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const securitySchema = z.object({
  twoFactorEnabled: z.boolean(),
  requirePasswordChange: z.boolean(),
  sessionTimeout: z.number().min(5).max(1440),
  passwordMinLength: z.number().min(8).max(32),
});

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  lowStockAlerts: z.boolean(),
  overdueAlerts: z.boolean(),
  orderAlerts: z.boolean(),
});

type GeneralFormValues = z.infer<typeof generalSchema>;
type SecurityFormValues = z.infer<typeof securitySchema>;
type NotificationFormValues = z.infer<typeof notificationSchema>;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { account, accountSettings, refreshAccount, loading: accountLoading } = useAccount();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [formsInitialized, setFormsInitialized] = useState(false);

  // --- General Form ---
  const generalForm = useForm<GeneralFormValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      companyName: '',
      email: '',
      phone: '',
      address: '',
    }
  });

  // --- Security Form ---
  const securityForm = useForm<SecurityFormValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      twoFactorEnabled: false,
      requirePasswordChange: false,
      sessionTimeout: 30,
      passwordMinLength: 8,
    }
  });

  // --- Notification Form ---
  const notificationForm = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      smsNotifications: false,
      lowStockAlerts: true,
      overdueAlerts: true,
      orderAlerts: true,
    }
  });

  // Initialize forms with data
  useEffect(() => {
    if (account) {
      generalForm.reset({
        companyName: account.company_name,
        email: account.billing_email || '',
        phone: ((account as any).metadata as any)?.phone || '',
        address: ((account as any).metadata as any)?.address || '',
      });

      const secSettings = ((account as any).metadata as any)?.security || {};
      securityForm.reset({
        twoFactorEnabled: secSettings.twoFactorEnabled || false,
        requirePasswordChange: secSettings.requirePasswordChange || false,
        sessionTimeout: secSettings.sessionTimeout || 30,
        passwordMinLength: secSettings.passwordMinLength || 8,
      });

      // Mark forms as initialized once account data is loaded
      setFormsInitialized(true);
    }

    if (accountSettings) {
      const notifSettings = (accountSettings.notification_settings as any) || {};
      notificationForm.reset({
        emailNotifications: notifSettings.emailNotifications ?? true,
        smsNotifications: notifSettings.smsNotifications ?? false,
        lowStockAlerts: notifSettings.lowStockAlerts ?? true,
        overdueAlerts: notifSettings.overdueAlerts ?? true,
        orderAlerts: notifSettings.orderAlerts ?? true,
      });
    }
  }, [account, accountSettings, generalForm, securityForm, notificationForm]);

  // Determine if we should show loading skeletons
  const showSkeletons = accountLoading || !formsInitialized;


  // --- Submit Handlers ---

  const onSaveGeneral = async (data: GeneralFormValues) => {
    if (!account) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({
          company_name: data.companyName,
          billing_email: data.email || null,
          metadata: {
            ...(((account as any).metadata as object) || {}),
            phone: data.phone,
            address: data.address,
          }
        })
        .eq('id', account.id);

      if (error) throw error;

      await refreshAccount();
      toast({ title: "Settings Saved", description: "General settings updated successfully." });
    } catch (err) {
      logger.error("Error saving general settings", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
    } finally {
      setLoading(false);
    }
  };

  const onSaveSecurity = async (data: SecurityFormValues) => {
    if (!account) return;
    setLoading(true);
    try {
      // Saving security settings to account metadata as user profile preferences are separate
      const { error } = await supabase
        .from('accounts')
        .update({
          metadata: {
            ...(((account as any).metadata as object) || {}),
            security: data,
          }
        })
        .eq('id', account.id);

      if (error) throw error;
      await refreshAccount();
      toast({ title: "Settings Saved", description: "Security settings updated successfully." });
    } catch (err) {
      logger.error("Error saving security settings", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
    } finally {
      setLoading(false);
    }
  };

  const onSaveNotifications = async (data: NotificationFormValues) => {
    if (!account) return;
    setLoading(true);
    try {
      if (accountSettings) {
        // Update existing
        const { error } = await supabase
          .from('account_settings')
          .update({
            notification_settings: data as any
          })
          .eq('id', accountSettings.id);
        if (error) throw error;
      } else {
        // Create new settings record
        const { error } = await supabase
          .from('account_settings')
          .insert({
            account_id: account.id,
            notification_settings: data as any
          });
        if (error) throw error;
      }

      await refreshAccount();
      toast({ title: "Settings Saved", description: "Notification preferences updated." });
    } catch (err) {
      logger.error("Error saving notification settings", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
    } finally {
      setLoading(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportSettings = () => {
    if (!account) {
      toast({ variant: "destructive", title: "Error", description: "No account data to export." });
      return;
    }

    setIsExporting(true);
    try {
      const generalValues = generalForm.getValues();
      const securityValues = securityForm.getValues();
      const notificationValues = notificationForm.getValues();

      const exportData = {
        exportedAt: new Date().toISOString(),
        account: {
          id: account.id,
          companyName: generalValues.companyName,
          email: generalValues.email,
          phone: generalValues.phone,
          address: generalValues.address,
          slug: account.slug,
          status: account.status,
          planId: account.plan_id,
        },
        settings: {
          general: {
            timezone: "America/New_York",
            currency: "USD",
          },
          security: securityValues,
          notifications: notificationValues,
        },
        accountSettings: accountSettings ? {
          businessLicense: accountSettings.business_license,
          taxRate: accountSettings.tax_rate,
          state: accountSettings.state,
          operatingStates: accountSettings.operating_states,
          branding: accountSettings.branding,
          complianceSettings: accountSettings.compliance_settings,
          integrationSettings: accountSettings.integration_settings,
        } : null,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${account.slug || 'settings'}-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export Complete", description: "Settings exported to JSON file." });
    } catch (err) {
      logger.error("Error exporting settings", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to export settings." });
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="container mx-auto p-2 sm:p-6 space-y-6">
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">🔧 Settings</h1>
            <p className="text-muted-foreground">Manage your account and system preferences</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSettings}
            disabled={isExporting || !account}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export to JSON'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
          {showSkeletons ? (
            <GeneralSettingsSkeleton />
          ) : (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" />
                General Settings
              </h3>
              <form onSubmit={generalForm.handleSubmit(onSaveGeneral)} className="space-y-4">
                <div>
                  <Label>Company Name</Label>
                  <Input {...generalForm.register("companyName")} />
                  {generalForm.formState.errors.companyName && (
                    <p className="text-sm text-destructive mt-1">{generalForm.formState.errors.companyName.message}</p>
                  )}
                </div>
                <div>
                  <Label>Details</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input type="email" {...generalForm.register("email")} />
                      {generalForm.formState.errors.email && (
                        <p className="text-sm text-destructive">{generalForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input type="tel" {...generalForm.register("phone")} />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea {...generalForm.register("address")} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Timezone</Label>
                    <Input value="America/New_York" disabled />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input value="USD" disabled />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save General Settings
                </Button>
              </form>
              <div className="pt-4 border-t mt-6">
                <h4 className="text-sm font-medium mb-2">Team Management</h4>
                <Button variant="outline" onClick={() => navigateToAdmin('team-members')}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team Members
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          {showSkeletons ? (
            <SecuritySettingsSkeleton />
          ) : (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </h3>
              <form onSubmit={securityForm.handleSubmit(onSaveSecurity)} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Switch
                    checked={securityForm.watch("twoFactorEnabled")}
                    onCheckedChange={(checked) => securityForm.setValue("twoFactorEnabled", checked)}
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
                    checked={securityForm.watch("requirePasswordChange")}
                    onCheckedChange={(checked) => securityForm.setValue("requirePasswordChange", checked)}
                  />
                </div>
                <div>
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    {...securityForm.register("sessionTimeout", { valueAsNumber: true })}
                  />
                  {securityForm.formState.errors.sessionTimeout && (
                    <p className="text-sm text-destructive">{securityForm.formState.errors.sessionTimeout.message}</p>
                  )}
                </div>
                <div>
                  <Label>Minimum Password Length</Label>
                  <Input
                    type="number"
                    {...securityForm.register("passwordMinLength", { valueAsNumber: true })}
                  />
                  {securityForm.formState.errors.passwordMinLength && (
                    <p className="text-sm text-destructive">{securityForm.formState.errors.passwordMinLength.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Security Settings
                </Button>
              </form>
            </Card>
          )}
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          {showSkeletons ? (
            <NotificationSettingsSkeleton />
          ) : (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </h3>
              <form onSubmit={notificationForm.handleSubmit(onSaveNotifications)} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notificationForm.watch("emailNotifications")}
                    onCheckedChange={(c) => notificationForm.setValue("emailNotifications", c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                  </div>
                  <Switch
                    checked={notificationForm.watch("smsNotifications")}
                    onCheckedChange={(c) => notificationForm.setValue("smsNotifications", c)}
                  />
                </div>
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Low Stock Alerts</Label>
                    <Switch
                      checked={notificationForm.watch("lowStockAlerts")}
                      onCheckedChange={(c) => notificationForm.setValue("lowStockAlerts", c)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Overdue Payment Alerts</Label>
                    <Switch
                      checked={notificationForm.watch("overdueAlerts")}
                      onCheckedChange={(c) => notificationForm.setValue("overdueAlerts", c)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Order Alerts</Label>
                    <Switch
                      checked={notificationForm.watch("orderAlerts")}
                      onCheckedChange={(c) => notificationForm.setValue("orderAlerts", c)}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </form>
            </Card>
          )}
        </TabsContent>

        {/* Printing Settings */}
        <TabsContent value="printing">
          {showSkeletons ? (
            <PrintingSettingsSkeleton />
          ) : (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Printing & Labels
              </h3>
              <div className="p-4 border rounded-lg bg-muted/20 text-center text-muted-foreground">
                <p>Printing preferences are currently managed via the Print Dialog.</p>
                <p className="text-sm mt-2">More advanced label configuration coming soon.</p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          {showSkeletons ? (
            <IntegrationsSettingsSkeleton />
          ) : (
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
                    <Button variant="outline" size="sm" disabled>Connect (Coming Soon)</Button>
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
                    <Button variant="outline" size="sm" disabled>Connect (Coming Soon)</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Sidebar Settings */}
        <TabsContent value="sidebar">
          {showSkeletons ? (
            <SidebarSettingsSkeleton />
          ) : (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Sidebar Preferences
              </h3>
              <div className="space-y-4">
                <OperationSizeSelector />
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Sidebar Customization */}
        <TabsContent value="sidebar-customization">
          {showSkeletons ? (
            <SidebarCustomizationSkeleton />
          ) : (
            <SidebarCustomizer />
          )}
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments">
          {showSkeletons ? (
            <PaymentSettingsSkeleton />
          ) : (
            <PaymentSettingsForm onSave={async () => { }} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
