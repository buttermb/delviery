import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Key, Bell, Shield, User } from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { useState } from "react";
import { toast } from 'sonner';
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { safeFetch } from "@/utils/safeFetch";

export default function SuperAdminSettingsPage() {
  const { superAdmin } = useSuperAdminAuth();
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate inputs
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        toast.error('Please fill in all password fields');
        setLoading(false);
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error('New password and confirmation must match');
        setLoading(false);
        return;
      }

      if (passwordData.newPassword.length < 8) {
        toast.error('Password must be at least 8 characters long');
        setLoading(false);
        return;
      }

      // Call Edge Function to update password
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await safeFetch(`${supabaseUrl}/functions/v1/super-admin-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN)}`,
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

      toast.success('Your password has been updated successfully');

      // Clear form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[hsl(var(--super-admin-bg))] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--super-admin-text))] mb-2">⚙️ Platform Settings</h1>
          <p className="text-[hsl(var(--super-admin-text-light))]">Manage platform-wide configurations and security</p>
        </div>

        {/* Account Settings */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-sm border-[hsl(var(--super-admin-border))] shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--super-admin-text))]">
              <User className="h-5 w-5 text-[hsl(var(--super-admin-primary))]" />
              Account Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[hsl(var(--super-admin-text))]">Email</Label>
              <Input 
                value={superAdmin?.email || ""} 
                disabled 
                className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text-light))]"
              />
              <p className="text-sm text-[hsl(var(--super-admin-text-light))]">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[hsl(var(--super-admin-text))]">Name</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  placeholder="First Name" 
                  defaultValue={superAdmin?.first_name || ""}
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus-visible:border-[hsl(var(--super-admin-primary))]"
                />
                <Input 
                  placeholder="Last Name" 
                  defaultValue={superAdmin?.last_name || ""}
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus-visible:border-[hsl(var(--super-admin-primary))]"
                />
              </div>
            </div>

            <Button 
              className="bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white"
            >
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-sm border-[hsl(var(--super-admin-border))] shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--super-admin-text))]">
              <Shield className="h-5 w-5 text-[hsl(var(--super-admin-primary))]" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[hsl(var(--super-admin-text))]">Current Password</Label>
                <PasswordInput
                  placeholder="Current Password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus-visible:border-[hsl(var(--super-admin-primary))]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--super-admin-text))]">New Password</Label>
                <PasswordInput
                  placeholder="New Password (min. 8 characters)"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus-visible:border-[hsl(var(--super-admin-primary))]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--super-admin-text))]">Confirm New Password</Label>
                <PasswordInput
                  placeholder="Confirm New Password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus-visible:border-[hsl(var(--super-admin-primary))]"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white"
              >
                <Key className="h-4 w-4 mr-2" />
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>

            <div className="pt-4 border-t border-[hsl(var(--super-admin-border))] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[hsl(var(--super-admin-text))]">Two-Factor Authentication</p>
                  <p className="text-sm text-[hsl(var(--super-admin-text-light))]">
                    {(superAdmin as unknown as Record<string, unknown>)?.two_factor_enabled ? "Enabled - Additional security layer active" : "Disabled - Enable for enhanced security"}
                  </p>
                </div>
                <Switch 
                  checked={Boolean((superAdmin as unknown as Record<string, unknown>)?.two_factor_enabled)}
                  className="data-[state=checked]:bg-[hsl(var(--super-admin-primary))]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-sm border-[hsl(var(--super-admin-border))] shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--super-admin-text))]">
              <Bell className="h-5 w-5 text-[hsl(var(--super-admin-primary))]" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--super-admin-text))]">Email Notifications</p>
                <p className="text-sm text-[hsl(var(--super-admin-text-light))]">Receive email alerts for platform events</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--super-admin-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--super-admin-text))]">New Tenant Alerts</p>
                <p className="text-sm text-[hsl(var(--super-admin-text-light))]">Notify when new tenants sign up</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--super-admin-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--super-admin-text))]">Payment Failures</p>
                <p className="text-sm text-[hsl(var(--super-admin-text-light))]">Alert on payment processing issues</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--super-admin-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--super-admin-text))]">System Alerts</p>
                <p className="text-sm text-[hsl(var(--super-admin-text-light))]">Critical platform notifications</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--super-admin-primary))]"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
