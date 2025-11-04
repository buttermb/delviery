import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, User, Bell } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";

export default function CustomerSettingsPage() {
  const { customer, tenant } = useCustomerAuth();
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
      const response = await window.fetch(`${supabaseUrl}/functions/v1/customer-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("customer_token")}`,
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
    <div className="min-h-screen bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
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
                <Input 
                  type="password" 
                  placeholder="Current Password" 
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--customer-text))]">New Password</Label>
                <Input 
                  type="password" 
                  placeholder="New Password (min. 8 characters)" 
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] focus:border-[hsl(var(--customer-primary))] focus:ring-[hsl(var(--customer-primary))]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--customer-text))]">Confirm New Password</Label>
                <Input 
                  type="password" 
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
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />
    </div>
  );
}
