import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, Bell, Shield, User } from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function SuperAdminSettingsPage() {
  const { superAdmin } = useSuperAdminAuth();
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const currentPassword = formData.get('currentPassword') as string;
      const newPassword = formData.get('newPassword') as string;
      const confirmPassword = formData.get('confirmPassword') as string;

      if (newPassword !== confirmPassword) {
        toast({
          title: "Error",
          description: "New passwords don't match",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully",
      });
      
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update password",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))] p-6">
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
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus:border-[hsl(var(--super-admin-primary))]"
                />
                <Input 
                  placeholder="Last Name" 
                  defaultValue={superAdmin?.last_name || ""}
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus:border-[hsl(var(--super-admin-primary))]"
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
                <Label className="text-[hsl(var(--super-admin-text))]">Change Password</Label>
                <Input 
                  type="password" 
                  placeholder="Current Password" 
                  required
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus:border-[hsl(var(--super-admin-primary))]"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="New Password" 
                  required
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus:border-[hsl(var(--super-admin-primary))]"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="Confirm New Password" 
                  required
                  className="bg-[hsl(var(--super-admin-surface))] border-[hsl(var(--super-admin-border))] text-[hsl(var(--super-admin-text))] focus:border-[hsl(var(--super-admin-primary))]"
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
                    {(superAdmin as any)?.two_factor_enabled ? "Enabled - Additional security layer active" : "Disabled - Enable for enhanced security"}
                  </p>
                </div>
                <Switch 
                  checked={(superAdmin as any)?.two_factor_enabled || false}
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
