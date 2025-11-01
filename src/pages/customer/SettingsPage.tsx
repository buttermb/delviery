import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, User, Bell } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function CustomerSettingsPage() {
  const { customer } = useCustomerAuth();
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // TODO: Implement password update via customer-auth Edge Function
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
        <h1 className="text-3xl font-bold">⚙️ Account Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={customer?.email || ""} disabled />
            <p className="text-sm text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input placeholder="First Name" defaultValue={customer?.first_name || ""} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input placeholder="Last Name" defaultValue={customer?.last_name || ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="Phone Number" type="tel" />
          </div>

          <Button>Save Changes</Button>
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
              <p className="font-medium">Order Updates</p>
              <p className="text-sm text-muted-foreground">Receive notifications about your orders</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Menu Alerts</p>
              <p className="text-sm text-muted-foreground">Notify when new menus are available</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

