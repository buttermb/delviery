import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, User, Bell } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function CustomerSettingsPage() {
  const { customer } = useCustomerAuth();
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
    <div className="min-h-screen bg-[hsl(var(--customer-bg))] p-6">
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
                <Label className="text-[hsl(var(--customer-text))]">Change Password</Label>
                <Input 
                  type="password" 
                  placeholder="Current Password" 
                  required
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="New Password" 
                  required
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Input 
                  type="password" 
                  placeholder="Confirm New Password" 
                  required
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
      </div>
    </div>
  );
}
