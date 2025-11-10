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
      // Bound fetch to prevent "Illegal invocation" error in production builds
      const safeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;
      const response = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("tenant_admin_access_token")}`,
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
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">⚙️ Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your account and business settings</p>
        </div>

        {/* Account Settings */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Account Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3 sm:p-4 md:p-6 pt-0">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Email</Label>
              <Input 
                value={admin?.email || ""} 
                disabled 
                className="bg-muted min-h-[44px] text-sm sm:text-base"
              />
              <p className="text-xs sm:text-sm text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Name</Label>
              <Input 
                placeholder="Full Name" 
                defaultValue={admin?.name || ""}
                className="min-h-[44px] text-sm sm:text-base"
              />
            </div>

            <Button className="w-full sm:w-auto min-h-[44px] touch-manipulation">
              <span className="text-sm sm:text-base">Save Changes</span>
            </Button>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3 sm:p-4 md:p-6 pt-0">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Business Name</Label>
              <Input 
                value={tenant?.business_name || ""} 
                disabled 
                className="bg-muted min-h-[44px] text-sm sm:text-base"
              />
              <p className="text-xs sm:text-sm text-muted-foreground">Contact support to change business name</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Phone</Label>
              <Input 
                placeholder="Phone Number" 
                defaultValue={(tenant as any)?.phone || ""}
                className="min-h-[44px] text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Address</Label>
              <Input 
                placeholder="Business Address" 
                defaultValue={(tenant as any)?.address || ""}
                className="min-h-[44px] text-sm sm:text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <Key className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3 sm:p-4 md:p-6 pt-0">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Current Password</Label>
                <Input 
                  type="password" 
                  placeholder="Current Password" 
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="min-h-[44px] text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">New Password</Label>
                <Input 
                  type="password" 
                  placeholder="New Password (min. 8 characters)" 
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="min-h-[44px] text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Confirm New Password</Label>
                <Input 
                  type="password" 
                  placeholder="Confirm New Password" 
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="min-h-[44px] text-sm sm:text-base"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full sm:w-auto min-h-[44px] touch-manipulation"
              >
                <Key className="h-4 w-4 mr-2" />
                <span className="text-sm sm:text-base">{loading ? "Updating..." : "Update Password"}</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3 sm:p-4 md:p-6 pt-0">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base text-foreground">Order Notifications</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Receive alerts for new orders</p>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base text-foreground">Low Stock Alerts</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Notify when inventory is low</p>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base text-foreground">Payment Reminders</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Reminders for outstanding payments</p>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base text-foreground">Weekly Reports</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Receive weekly performance summaries</p>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
