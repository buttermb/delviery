import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { UnsavedChangesDialog } from '@/components/unsaved-changes';
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
  Settings, Shield, Bell, Printer, Plug, Save, Loader2,
  Building, Layout, Sliders, Users, CreditCard, ArrowLeft, Upload, ToggleRight, Send
} from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { OperationSizeSelector } from '@/components/admin/sidebar/OperationSizeSelector';
import { SidebarCustomizer } from '@/components/admin/sidebar/SidebarCustomizer';
import { StripeConnectSettings } from '@/components/settings/StripeConnectSettings';
import { FieldHelp, fieldHelpTexts } from '@/components/ui/field-help';
import { ShortcutHint, useModifierKey } from '@/components/ui/shortcut-hint';
import { useFormKeyboardShortcuts } from '@/hooks/useFormKeyboardShortcuts';
import { PaymentSettingsForm } from '@/components/settings/PaymentSettingsForm';
import { FeatureTogglesPanel } from '@/components/admin/settings/FeatureTogglesPanel';
import { SettingsImportDialog, type ImportedSettings } from '@/components/settings/SettingsImportDialog';
import { toast } from "sonner";
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
  phone: z.string().regex(/^[\d\s\-+()]+$/, "Invalid phone number").min(7, "Phone number must be at least 7 characters").max(20, "Phone number must be 20 characters or less").optional().or(z.literal('')),
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
  telegram_auto_forward: z.boolean(),
  telegram_bot_token: z.string().optional().or(z.literal('')),
  telegram_chat_id: z.string().optional().or(z.literal('')),
  telegram_customer_link: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  telegram_button_label: z.string().optional().or(z.literal('')),
  show_telegram_on_confirmation: z.boolean(),
});

type GeneralFormValues = z.infer<typeof generalSchema>;
type SecurityFormValues = z.infer<typeof securitySchema>;
type NotificationFormValues = z.infer<typeof notificationSchema>;

interface SettingsPageProps {
  embedded?: boolean;
}

export default function SettingsPage({ embedded = false }: SettingsPageProps) {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { account, accountSettings, refreshAccount, loading: accountLoading } = useAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'general';
  const [generalLoading, setGeneralLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [formsInitialized, setFormsInitialized] = useState(false);
  const [testingSending, setTestingSending] = useState(false);

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
      telegram_auto_forward: false,
      telegram_bot_token: '',
      telegram_chat_id: '',
      telegram_customer_link: '',
      telegram_button_label: 'Chat with us on Telegram',
      show_telegram_on_confirmation: false,
    }
  });

  // Initialize forms with data
  useEffect(() => {
    if (account) {
      const metadata = (account as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      generalForm.reset({
        companyName: account.company_name,
        email: account.billing_email ?? '',
        phone: (metadata?.phone as string) ?? '',
        address: (metadata?.address as string) ?? '',
      });

      const secSettings = (metadata?.security as Record<string, unknown>) || {};
      securityForm.reset({
        twoFactorEnabled: secSettings.twoFactorEnabled ?? false,
        requirePasswordChange: secSettings.requirePasswordChange ?? false,
        sessionTimeout: secSettings.sessionTimeout || 30,
        passwordMinLength: secSettings.passwordMinLength || 8,
      });

      // Mark forms as initialized once account data is loaded
      setFormsInitialized(true);
    }

    if (accountSettings) {
      const notifSettings = (accountSettings.notification_settings as Record<string, unknown>) || {};
      notificationForm.reset({
        emailNotifications: notifSettings.emailNotifications ?? true,
        smsNotifications: notifSettings.smsNotifications ?? false,
        lowStockAlerts: notifSettings.lowStockAlerts ?? true,
        overdueAlerts: notifSettings.overdueAlerts ?? true,
        orderAlerts: notifSettings.orderAlerts ?? true,
        telegram_auto_forward: (notifSettings.telegram_auto_forward as boolean) ?? false,
        telegram_bot_token: (notifSettings.telegram_bot_token as string) ?? '',
        telegram_chat_id: (notifSettings.telegram_chat_id as string) ?? '',
        telegram_customer_link: (notifSettings.telegram_customer_link as string) ?? '',
        telegram_button_label: (notifSettings.telegram_button_label as string) ?? 'Chat with us on Telegram',
        show_telegram_on_confirmation: (notifSettings.show_telegram_on_confirmation as boolean) ?? false,
      });
    }
  }, [account, accountSettings, generalForm, securityForm, notificationForm]);

  // Determine if we should show loading skeletons
  const showSkeletons = accountLoading || !formsInitialized;

  // Warn on unsaved changes when navigating away
  const isDirty = formsInitialized && (
    generalForm.formState.isDirty ||
    securityForm.formState.isDirty ||
    notificationForm.formState.isDirty
  );
  const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
    isDirty,
  });

  const mod = useModifierKey();

  // Cmd/Ctrl+S submits the active tab's form
  useFormKeyboardShortcuts({
    onSave: () => {
      if (activeTab === 'general') generalForm.handleSubmit(onSaveGeneral)();
      else if (activeTab === 'security') securityForm.handleSubmit(onSaveSecurity)();
      else if (activeTab === 'notifications') notificationForm.handleSubmit(onSaveNotifications)();
    },
  });


  // --- Submit Handlers ---

  const onSaveGeneral = async (data: GeneralFormValues) => {
    if (!account) return;
    setGeneralLoading(true);
    try {
      const existingMetadata = ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('accounts')
        .update({
          company_name: data.companyName,
          billing_email: data.email || null,
          metadata: {
            ...existingMetadata,
            phone: data.phone,
            address: data.address,
          }
        })
        .eq('id', account.id);

      if (error) throw error;

      await refreshAccount();
      toast.success("General settings updated successfully.");
    } catch (err) {
      logger.error("Error saving general settings", err);
      toast.error("Failed to save general settings.");
    } finally {
      setGeneralLoading(false);
    }
  };

  const onSaveSecurity = async (data: SecurityFormValues) => {
    if (!account) return;
    setSecurityLoading(true);
    try {
      // Saving security settings to account metadata as user profile preferences are separate
      const existingMetadataSec = ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('accounts')
        .update({
          metadata: {
            ...existingMetadataSec,
            security: data,
          }
        })
        .eq('id', account.id);

      if (error) throw error;
      await refreshAccount();
      toast.success("Security settings updated successfully.");
    } catch (err) {
      logger.error("Error saving security settings", err);
      toast.error("Failed to save security settings.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const onSaveNotifications = async (data: NotificationFormValues) => {
    if (!account) return;
    setNotificationLoading(true);
    try {
      const existingNotif = accountSettings
        ? (accountSettings.notification_settings as Record<string, unknown>) || {}
        : {};
      const merged = { ...existingNotif, ...data } as Record<string, unknown>;

      if (accountSettings) {
        const { error } = await supabase
          .from('account_settings')
          .update({
            notification_settings: merged
          })
          .eq('id', accountSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('account_settings')
          .insert({
            account_id: account.id,
            notification_settings: merged
          });
        if (error) throw error;
      }

      await refreshAccount();
      toast.success("Notification preferences updated.");
    } catch (err) {
      logger.error("Error saving notification settings", err);
      toast.error("Failed to save notification settings.");
    } finally {
      setNotificationLoading(false);
    }
  };

  // --- Telegram Test ---
  // Saves notification settings first, then tests via edge function (bot_token never sent from client)
  const onTestTelegram = async () => {
    if (!account) return;

    const botToken = notificationForm.getValues("telegram_bot_token");
    const chatId = notificationForm.getValues("telegram_chat_id");

    if (!botToken || !chatId) {
      toast.error("Please enter both Bot Token and Chat ID before testing.");
      return;
    }

    setTestingSending(true);
    try {
      // Save current notification settings so the edge function can read them
      await notificationForm.handleSubmit(onSaveNotifications)();

      const { data, error } = await supabase.functions.invoke("test-telegram", {
        body: { accountId: account.id },
      });

      if (error) throw error;

      if (data?.sent) {
        toast.success("Test message sent! Check your Telegram chat.");
      } else {
        toast.error(data?.reason ?? "Failed to send test message.");
      }
    } catch (err) {
      logger.error("Telegram test failed", err);
      toast.error("Failed to send test message. Check your credentials.");
    } finally {
      setTestingSending(false);
    }
  };

  // --- Import Handler ---
  const handleImportSettings = async (settings: ImportedSettings) => {
    if (!account) {
      throw new Error('No account found');
    }

    setImportLoading(true);
    try {
      // Import general settings if provided
      if (settings.general) {
        const generalData = settings.general;
        const { error: generalError } = await supabase
          .from('accounts')
          .update({
            company_name: generalData.companyName || account.company_name,
            billing_email: generalData.email || account.billing_email,
            metadata: {
              ...(((account as unknown as Record<string, unknown>).metadata as object) || {}),
              phone: (generalData.phone ?? ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>)?.phone) as string | null,
              address: (generalData.address ?? ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>)?.address) as string | null,
            }
          })
          .eq('id', account.id);

        if (generalError) throw generalError;

        // Update form with imported values
        generalForm.reset({
          companyName: generalData.companyName || account.company_name,
          email: generalData.email ?? account.billing_email ?? '',
          phone: generalData.phone ?? '',
          address: generalData.address ?? '',
        });
      }

      // Import security settings if provided
      if (settings.security) {
        const securityData = settings.security;
        const existingMetadata = ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>) || {};
        const existingSecurity = (existingMetadata.security as Record<string, unknown>) || {};

        const { error: securityError } = await supabase
          .from('accounts')
          .update({
            metadata: {
              ...existingMetadata,
              security: {
                ...existingSecurity,
                ...securityData,
              },
            }
          })
          .eq('id', account.id);

        if (securityError) throw securityError;

        // Update form with imported values
        securityForm.reset({
          twoFactorEnabled: securityData.twoFactorEnabled ?? securityForm.getValues('twoFactorEnabled'),
          requirePasswordChange: securityData.requirePasswordChange ?? securityForm.getValues('requirePasswordChange'),
          sessionTimeout: securityData.sessionTimeout ?? securityForm.getValues('sessionTimeout'),
          passwordMinLength: securityData.passwordMinLength ?? securityForm.getValues('passwordMinLength'),
        });
      }

      // Import notification settings if provided
      if (settings.notifications) {
        const notifData = settings.notifications;

        if (accountSettings) {
          const existingNotif = (accountSettings.notification_settings as Record<string, unknown>) || {};
          const { error: notifError } = await supabase
            .from('account_settings')
            .update({
              notification_settings: {
                ...existingNotif,
                ...notifData,
              }
            })
            .eq('id', accountSettings.id);

          if (notifError) throw notifError;
        } else {
          const { error: notifError } = await supabase
            .from('account_settings')
            .insert({
              account_id: account.id,
              notification_settings: notifData
            });

          if (notifError) throw notifError;
        }

        // Update form with imported values
        notificationForm.reset({
          emailNotifications: notifData.emailNotifications ?? notificationForm.getValues('emailNotifications'),
          smsNotifications: notifData.smsNotifications ?? notificationForm.getValues('smsNotifications'),
          lowStockAlerts: notifData.lowStockAlerts ?? notificationForm.getValues('lowStockAlerts'),
          overdueAlerts: notifData.overdueAlerts ?? notificationForm.getValues('overdueAlerts'),
          orderAlerts: notifData.orderAlerts ?? notificationForm.getValues('orderAlerts'),
          telegram_auto_forward: notificationForm.getValues('telegram_auto_forward'),
          telegram_bot_token: notificationForm.getValues('telegram_bot_token'),
          telegram_chat_id: notificationForm.getValues('telegram_chat_id'),
          telegram_customer_link: notificationForm.getValues('telegram_customer_link'),
          telegram_button_label: notificationForm.getValues('telegram_button_label'),
          show_telegram_on_confirmation: notificationForm.getValues('show_telegram_on_confirmation'),
        });
      }

      await refreshAccount();
      toast.success("Your settings have been imported successfully.");
    } catch (err) {
      logger.error("Error importing settings", err);
      throw err;
    } finally {
      setImportLoading(false);
    }
  };


  // General settings content - shared between embedded and standalone modes
  const generalSettingsContent = (
    <>
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
                  {generalForm.formState.errors.phone && (
                    <p className="text-sm text-destructive">{generalForm.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea {...generalForm.register("address")} rows={3} />
              {generalForm.formState.errors.address && (
                <p className="text-sm text-destructive mt-1">{generalForm.formState.errors.address.message}</p>
              )}
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
            <ShortcutHint keys={[mod, "S"]} label="Save">
              <Button type="submit" disabled={generalLoading}>
                {generalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save General Settings
              </Button>
            </ShortcutHint>
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
    </>
  );

  // When embedded inside SettingsHubPage, render only general settings content
  if (embedded) {
    return (
      <div className="p-2 sm:p-4 space-y-4">
        {generalSettingsContent}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateToAdmin('dashboard')}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage your account and system preferences</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            disabled={importLoading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Settings
          </Button>
        </div>
      </div>

      <SettingsImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImportSettings}
      />

      <Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab })} className="space-y-6">
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
          <TabsTrigger value="features" className="justify-start lg:justify-center w-full lg:w-auto">
            <ToggleRight className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          {generalSettingsContent}
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
                <FieldHelp tooltip={fieldHelpTexts.dataIsolation.tooltip} variant="info" size="md" />
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
                <ShortcutHint keys={[mod, "S"]} label="Save">
                  <Button type="submit" disabled={securityLoading}>
                    {securityLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Security Settings
                  </Button>
                </ShortcutHint>
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

                {/* Telegram Configuration */}
                <div className="pt-4 border-t space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Telegram Order Notifications
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically forward new orders to a Telegram group or chat.
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Forward Orders</Label>
                      <p className="text-sm text-muted-foreground">Send order details to Telegram when a customer places an order</p>
                    </div>
                    <Switch
                      checked={notificationForm.watch("telegram_auto_forward")}
                      onCheckedChange={(c) => notificationForm.setValue("telegram_auto_forward", c, { shouldDirty: true })}
                    />
                  </div>
                  {notificationForm.watch("telegram_auto_forward") && (
                    <div className="space-y-3 pl-1">
                      <div className="space-y-1">
                        <Label required>Bot Token</Label>
                        <Input
                          type="password"
                          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                          {...notificationForm.register("telegram_bot_token")}
                        />
                        <p className="text-xs text-muted-foreground">
                          Create a bot via @BotFather on Telegram to get this token
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label required>Chat ID</Label>
                        <Input
                          placeholder="-1001234567890"
                          {...notificationForm.register("telegram_chat_id")}
                        />
                        <p className="text-xs text-muted-foreground">
                          The group or channel ID where order notifications will be sent
                        </p>
                      </div>
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={testingSending}
                          onClick={onTestTelegram}
                        >
                          {testingSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Send Test Message
                        </Button>
                      </div>
                      <div className="pt-3 border-t space-y-3">
                        <h5 className="text-sm font-medium">Customer-Facing Settings</h5>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Show on Confirmation Page</Label>
                            <p className="text-sm text-muted-foreground">Display a Telegram button on the order confirmation page</p>
                          </div>
                          <Switch
                            checked={notificationForm.watch("show_telegram_on_confirmation")}
                            onCheckedChange={(c) => notificationForm.setValue("show_telegram_on_confirmation", c, { shouldDirty: true })}
                          />
                        </div>
                        {notificationForm.watch("show_telegram_on_confirmation") && (
                          <div className="space-y-3 pl-1">
                            <div className="space-y-1">
                              <Label>Customer Telegram Link</Label>
                              <Input
                                type="url"
                                placeholder="https://t.me/yourstorename"
                                {...notificationForm.register("telegram_customer_link")}
                              />
                              {notificationForm.formState.errors.telegram_customer_link && (
                                <p className="text-sm text-destructive">{notificationForm.formState.errors.telegram_customer_link.message}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Shown on the order confirmation page so customers can reach you
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Label>Button Label</Label>
                              <Input
                                placeholder="Chat with us on Telegram"
                                {...notificationForm.register("telegram_button_label")}
                              />
                              <p className="text-xs text-muted-foreground">
                                The text displayed on the Telegram button
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <ShortcutHint keys={[mod, "S"]} label="Save">
                  <Button type="submit" disabled={notificationLoading}>
                    {notificationLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Notification Settings
                  </Button>
                </ShortcutHint>
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

        {/* Feature Toggles */}
        <TabsContent value="features">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ToggleRight className="h-5 w-5" />
              Feature Toggles
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Enable or disable optional features for your account. Core features like Orders, Products, and Invoices are always available.
            </p>
            <FeatureTogglesPanel />
          </Card>
        </TabsContent>
      </Tabs>

      <UnsavedChangesDialog
        open={showBlockerDialog}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
}
