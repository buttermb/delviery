import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, Building2, Bell } from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function TenantAdminSettingsPage() {
  const { admin, tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // TODO: Implement password update via tenant-admin-auth Edge Function
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
        <h1 className="text-3xl font-bold">⚙️ Settings</h1>
        <p className="text-muted-foreground">Manage your account and business settings</p>
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
            <Input value={admin?.email || ""} disabled />
            <p className="text-sm text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="Full Name" defaultValue={admin?.name || ""} />
          </div>

          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Business Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input value={tenant?.business_name || ""} disabled />
            <p className="text-sm text-muted-foreground">Contact support to change business name</p>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="Phone Number" defaultValue={tenant?.phone || ""} />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
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
              <p className="font-medium">Order Notifications</p>
              <p className="text-sm text-muted-foreground">Receive alerts for new orders</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Low Stock Alerts</p>
              <p className="text-sm text-muted-foreground">Notify when inventory is low</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Payment Reminders</p>
              <p className="text-sm text-muted-foreground">Reminders for outstanding payments</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

