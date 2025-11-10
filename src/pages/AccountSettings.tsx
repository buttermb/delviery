import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import CopyButton from "@/components/CopyButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ArrowLeft, Home } from "lucide-react";
import CustomerLayout from "@/layouts/CustomerLayout";
import { logger } from "@/utils/logger";

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  id_verified: boolean;
  user_id_code?: string | null;
  marketing_opt_in?: boolean | null;
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/");
          return;
        }
        setEmail(user.email || "");
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, id_verified, user_id_code")
        .eq("user_id", user.id)
        .maybeSingle();

        if (profileError) throw profileError;
        
        if (data) {
          const profileData: Profile = {
            user_id: data.user_id,
            full_name: data.full_name,
            phone: data.phone,
            id_verified: data.id_verified,
            user_id_code: data.user_id_code,
            marketing_opt_in: null, // This column doesn't exist yet
          };
          setProfile(profileData);
          setFullName(data.full_name || "");
          setPhone(data.phone || "");
          setMarketingOptIn(false);
        } else {
          toast.error("Profile not found");
          navigate("/account");
          return;
        }
      } catch (e) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    init();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('account-settings-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          logger.debug('Profile updated, refreshing settings', undefined, 'AccountSettings');
          init();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Successfully subscribed to account settings', undefined, 'AccountSettings');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Failed to subscribe to account settings updates', { status }, 'AccountSettings');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const requestPasswordReset = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return toast.error("No email on file");
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin + "/account",
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (e) {
      toast.error("Failed to send reset email");
    }
  };

  if (loading) {
    return (
      <CustomerLayout>
        <div className="container mx-auto p-6 max-w-3xl">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container mx-auto p-6 max-w-3xl">
        {/* Back to Home Button */}
        <div className="mb-6">
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>

        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Account", href: "/account" },
          { label: "Settings" }
        ]} />
        
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/account")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Account Settings</h1>
        </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Input id="email" value={email} disabled />
              <CopyButton text={email} label="Email" size="icon" showLabel={false} />
            </div>
          </div>
          <div>
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" inputMode="tel" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Marketing Emails</p>
              <p className="text-xs text-muted-foreground">Get updates on deals and launches</p>
            </div>
            <Switch checked={marketingOptIn} onCheckedChange={setMarketingOptIn} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/account")}>Cancel</Button>
            <Button onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>User ID</Label>
              <div className="flex items-center gap-2">
                <Input value={profile?.user_id_code || "Pending"} disabled />
                {profile?.user_id_code && (
                  <CopyButton text={profile.user_id_code} label="User ID" size="icon" showLabel={false} />
                )}
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Input value={profile?.id_verified ? "ID Verified" : "Not Verified"} disabled />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Send a password reset email to change your password</p>
            </div>
            <Button variant="outline" onClick={requestPasswordReset}>Send Reset Email</Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </CustomerLayout>
  );
}


