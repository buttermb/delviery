import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, User, Bell, Trash2, Download, AlertTriangle } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { apiFetch } from "@/lib/utils/apiClient";
import { useNavigate, useParams } from "react-router-dom";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { PasswordBreachWarning } from "@/components/auth/PasswordBreachWarning";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";
import { SessionManagement } from "@/components/customer/SessionManagement";
import { safeFetch } from "@/utils/safeFetch";
import { BusinessVerificationCard } from "@/components/customer/BusinessVerificationCard";

export default function CustomerSettingsPage() {
  const { customer, tenant, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Password breach checking
  const { checking: breachChecking, result: breachResult, suggestPassword } = usePasswordBreachCheck(passwordData.newPassword);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate inputs
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        toast({
          title: "Missing Fields",
          description: "Please fill in all password fields",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast({
          title: "Passwords Don't Match",
          description: "New password and confirmation must match",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (passwordData.newPassword.length < 8) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 8 characters long",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (breachResult?.blocked) {
        toast({
          title: "Password not allowed",
          description: "This password has been found in too many data breaches. Please choose a different password.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Call Edge Function to update password
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await safeFetch(`${supabaseUrl}/functions/v1/customer-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN)}`,
        },
        body: JSON.stringify({
          action: "update-password",
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update password");
      }

      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully",
      });

      // Clear form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: unknown) {
      logger.error("Password update error", error, { component: "CustomerSettingsPage" });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!customer || !tenant) return;

    setExporting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/export-customer-data`, {
        method: 'POST',
        body: JSON.stringify({
          customer_user_id: customer.id,
          tenant_id: tenant.id,
          format: 'json',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export data');
      }

      const result = await response.json();

      if (result.download_url) {
        window.open(result.download_url, '_blank');
        toast({
          title: 'Data Export Ready',
          description: 'Your data export is ready. The download link will expire in 7 days.',
        });
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer-data-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({
          title: 'Data Export Complete',
          description: 'Your data has been downloaded.',
        });
      }
    } catch (error: unknown) {
      logger.error('Data export error', error, { component: 'CustomerSettingsPage' });
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export your data. Please try again.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!customer || !tenant) return;

    setDeleting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/delete-customer-account`, {
        method: 'POST',
        body: JSON.stringify({
          customer_user_id: customer.id,
          tenant_id: tenant.id,
          reason: 'User requested account deletion',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      toast({
        title: 'Account Deleted',
        description: 'Your account has been deleted. You will be logged out.',
      });

      await logout();
      navigate(`/${tenantSlug}/customer/login`);
    } catch (error: unknown) {
      logger.error('Account deletion error', error, { component: 'CustomerSettingsPage' });
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error instanceof Error ? error.message : 'Failed to delete your account. Please try again.',
      });
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />
      
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--customer-text))] mb-2">⚙️ Account Settings</h1>
          <p className="text-[hsl(var(--customer-text-light))]">Manage your account preferences and notifications</p>
        </div>

        {/* Profile Settings */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--customer-text))]">
              <User className="h-5 w-5 text-[hsl(var(--customer-primary))]" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[hsl(var(--customer-text))]">Email</Label>
              <Input 
                value={customer?.email || ""} 
                disabled 
                className="bg-gray-50 border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text-light))]"
              />
              <p className="text-sm text-[hsl(var(--customer-text-light))]">Email cannot be changed</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[hsl(var(--customer-text))]">First Name</Label>
                <Input 
                  placeholder="First Name" 
                  defaultValue={customer?.first_name || ""}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--customer-text))]">Last Name</Label>
                <Input 
                  placeholder="Last Name" 
                  defaultValue={customer?.last_name || ""}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[hsl(var(--customer-text))]">Phone</Label>
              <Input 
                placeholder="Phone Number" 
                type="tel"
                className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
              />
            </div>

            <Button 
              className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
            >
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--customer-text))]">
              <Key className="h-5 w-5 text-[hsl(var(--customer-primary))]" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[hsl(var(--customer-text))]">Current Password</Label>
                <PasswordInput
                  placeholder="Current Password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--customer-text))]">New Password</Label>
                <PasswordInput
                  placeholder="New Password (min. 8 characters)"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
                {passwordData.newPassword && (
                  <PasswordStrengthIndicator password={passwordData.newPassword} />
                )}
                {passwordData.newPassword.length >= 8 && (
                  <PasswordBreachWarning
                    checking={breachChecking}
                    result={breachResult}
                    suggestPassword={suggestPassword}
                    onGeneratePassword={(pw) => setPasswordData({ ...passwordData, newPassword: pw, confirmPassword: pw })}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--customer-text))]">Confirm New Password</Label>
                <PasswordInput
                  placeholder="Confirm New Password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
              >
                <Key className="h-4 w-4 mr-2" />
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--customer-text))]">
              <Bell className="h-5 w-5 text-[hsl(var(--customer-primary))]" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--customer-text))]">Order Updates</p>
                <p className="text-sm text-[hsl(var(--customer-text-light))]">Receive notifications about your orders</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--customer-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--customer-text))]">New Menu Alerts</p>
                <p className="text-sm text-[hsl(var(--customer-text-light))]">Notify when new menus are available</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--customer-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--customer-text))]">Email Notifications</p>
                <p className="text-sm text-[hsl(var(--customer-text-light))]">Receive updates via email</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--customer-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--customer-text))]">Special Offers</p>
                <p className="text-sm text-[hsl(var(--customer-text-light))]">Get notified about promotions and discounts</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--customer-primary))]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Verification */}
        <BusinessVerificationCard />

        {/* Session Management */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--customer-text))]">
              <Settings className="h-5 w-5 text-[hsl(var(--customer-primary))]" />
              Active Sessions
            </CardTitle>
            <CardDescription className="text-[hsl(var(--customer-text-light))]">
              View and manage devices where you're logged in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SessionManagement />
          </CardContent>
        </Card>

        {/* GDPR Compliance */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-md border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--customer-text))]">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Data & Privacy
            </CardTitle>
            <CardDescription className="text-[hsl(var(--customer-text-light))]">
              Manage your data and privacy settings in accordance with GDPR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export Data */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[hsl(var(--customer-text))]">Export Your Data</Label>
                  <p className="text-sm text-[hsl(var(--customer-text-light))]">
                    Download a copy of all your account data in JSON format
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  disabled={exporting}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
                >
                  {exporting ? (
                    <>
                      <Settings className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--customer-border))] pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-red-600">Delete Account</Label>
                    <p className="text-sm text-[hsl(var(--customer-text-light))]">
                      Permanently delete your account and anonymize your data. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteAccount}
        itemName={customer?.email}
        itemType="account"
        title="Delete Your Account"
        description="Are you sure you want to delete your account? This will permanently delete your account and anonymize your personal data in accordance with GDPR requirements. Your order history will be preserved for accounting purposes but will be anonymized. This action cannot be undone."
        isLoading={deleting}
        destructive={true}
      />
    </div>
  );
}
