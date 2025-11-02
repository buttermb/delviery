import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, Building2, Bell, User } from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function TenantAdminSettingsPage() {
  const { admin, tenant } = useTenantAdminAuth();
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

      // Call Edge Function to update password
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("tenant_admin_token")}`,
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--tenant-bg))] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--tenant-text))] mb-2">⚙️ Settings</h1>
          <p className="text-[hsl(var(--tenant-text-light))]">Manage your account and business settings</p>
        </div>

        {/* Account Settings */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--tenant-text))]">
              <User className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              Account Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[hsl(var(--tenant-text))]">Email</Label>
              <Input 
                value={admin?.email || ""} 
                disabled 
                className="bg-gray-50 border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text-light))]"
              />
              <p className="text-sm text-[hsl(var(--tenant-text-light))]">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[hsl(var(--tenant-text))]">Name</Label>
              <Input 
                placeholder="Full Name" 
                defaultValue={admin?.name || ""}
                className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20"
              />
            </div>

            <Button 
              className="bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white"
            >
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--tenant-text))]">
              <Building2 className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[hsl(var(--tenant-text))]">Business Name</Label>
              <Input 
                value={tenant?.business_name || ""} 
                disabled 
                className="bg-gray-50 border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text-light))]"
              />
              <p className="text-sm text-[hsl(var(--tenant-text-light))]">Contact support to change business name</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[hsl(var(--tenant-text))]">Phone</Label>
              <Input 
                placeholder="Phone Number" 
                defaultValue={(tenant as any)?.phone || ""}
                className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[hsl(var(--tenant-text))]">Address</Label>
              <Input 
                placeholder="Business Address" 
                defaultValue={(tenant as any)?.address || ""}
                className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--tenant-text))]">
              <Key className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[hsl(var(--tenant-text))]">Current Password</Label>
                <Input 
                  type="password" 
                  placeholder="Current Password" 
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--tenant-text))]">New Password</Label>
                <Input 
                  type="password" 
                  placeholder="New Password (min. 8 characters)" 
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--tenant-text))]">Confirm New Password</Label>
                <Input 
                  type="password" 
                  placeholder="Confirm New Password" 
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] focus:border-[hsl(var(--tenant-primary))] focus:ring-[hsl(var(--tenant-primary))]/20"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white"
              >
                <Key className="h-4 w-4 mr-2" />
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--tenant-text))]">
              <Bell className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--tenant-text))]">Order Notifications</p>
                <p className="text-sm text-[hsl(var(--tenant-text-light))]">Receive alerts for new orders</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--tenant-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--tenant-text))]">Low Stock Alerts</p>
                <p className="text-sm text-[hsl(var(--tenant-text-light))]">Notify when inventory is low</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--tenant-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--tenant-text))]">Payment Reminders</p>
                <p className="text-sm text-[hsl(var(--tenant-text-light))]">Reminders for outstanding payments</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--tenant-primary))]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[hsl(var(--tenant-text))]">Weekly Reports</p>
                <p className="text-sm text-[hsl(var(--tenant-text-light))]">Receive weekly performance summaries</p>
              </div>
              <Switch 
                defaultChecked
                className="data-[state=checked]:bg-[hsl(var(--tenant-primary))]"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
