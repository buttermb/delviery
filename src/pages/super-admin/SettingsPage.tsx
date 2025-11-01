import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, Bell, Shield } from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function SuperAdminSettingsPage() {
  const { superAdmin } = useSuperAdminAuth();
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // TODO: Implement password update
    setTimeout(() => {
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully",
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⚙️ Platform Settings</h1>
        <p className="text-muted-foreground">Manage platform-wide configurations</p>
      </div>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Account Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={superAdmin?.email || ""} disabled />
            <p className="text-sm text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="First Name" defaultValue={superAdmin?.first_name || ""} />
              <Input placeholder="Last Name" defaultValue={superAdmin?.last_name || ""} />
            </div>
          </div>

          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Change Password</Label>
              <Input type="password" placeholder="Current Password" required />
            </div>
            <div className="space-y-2">
              <Input type="password" placeholder="New Password" required />
            </div>
            <div className="space-y-2">
              <Input type="password" placeholder="Confirm New Password" required />
            </div>
            <Button type="submit" disabled={loading}>
              <Key className="h-4 w-4 mr-2" />
              Update Password
            </Button>
          </form>

          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  {superAdmin?.two_factor_enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <Switch checked={superAdmin?.two_factor_enabled || false} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive email alerts for platform events</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Tenant Alerts</p>
              <p className="text-sm text-muted-foreground">Notify when new tenants sign up</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Payment Failures</p>
              <p className="text-sm text-muted-foreground">Alert on payment processing issues</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

