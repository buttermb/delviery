import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function NotificationPreferences() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    sms_enabled: true,
    sms_all_updates: true,
    sms_critical_only: false,
    push_enabled: true,
    push_all_updates: true,
    push_critical_only: false,
    email_enabled: true,
    email_all_updates: false,
    email_confirmation_only: true,
  });

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setPrefs(data);
    } else if (!data) {
      // Create default preferences
      const { data: newPrefs, error: insertError } = await supabase
        .from("notification_preferences")
        .insert({ user_id: user.id })
        .select()
        .single();
      
      if (!insertError && newPrefs) {
        setPrefs(newPrefs);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      toast.error("Failed to save preferences");
    } else {
      toast.success("Notification preferences saved");
    }
    setSaving(false);
  };

  const updatePref = (key: string, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Choose how you want to receive delivery updates
        </p>
      </div>

      {/* SMS Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h4 className="font-medium">SMS / Text Messages</h4>
        </div>
        <div className="space-y-3 pl-7">
          <div className="flex items-center justify-between">
            <Label htmlFor="sms-enabled">Enable SMS notifications</Label>
            <Switch
              id="sms-enabled"
              checked={prefs.sms_enabled}
              onCheckedChange={(checked) => updatePref("sms_enabled", checked)}
            />
          </div>
          {prefs.sms_enabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sms-all">All updates (Recommended)</Label>
                  <p className="text-xs text-muted-foreground">
                    Order confirmed, driver assigned, pickup, ETA updates
                  </p>
                </div>
                <Switch
                  id="sms-all"
                  checked={prefs.sms_all_updates}
                  onCheckedChange={(checked) => {
                    updatePref("sms_all_updates", checked);
                    if (checked) updatePref("sms_critical_only", false);
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sms-critical">Critical only</Label>
                  <p className="text-xs text-muted-foreground">
                    Order confirmed, driver arrived, delivered
                  </p>
                </div>
                <Switch
                  id="sms-critical"
                  checked={prefs.sms_critical_only}
                  onCheckedChange={(checked) => {
                    updatePref("sms_critical_only", checked);
                    if (checked) updatePref("sms_all_updates", false);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Push Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h4 className="font-medium">Push Notifications</h4>
        </div>
        <div className="space-y-3 pl-7">
          <div className="flex items-center justify-between">
            <Label htmlFor="push-enabled">Enable push notifications</Label>
            <Switch
              id="push-enabled"
              checked={prefs.push_enabled}
              onCheckedChange={(checked) => updatePref("push_enabled", checked)}
            />
          </div>
          {prefs.push_enabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="push-all">All updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Real-time alerts for every stage
                  </p>
                </div>
                <Switch
                  id="push-all"
                  checked={prefs.push_all_updates}
                  onCheckedChange={(checked) => {
                    updatePref("push_all_updates", checked);
                    if (checked) updatePref("push_critical_only", false);
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="push-critical">Critical only</Label>
                  <p className="text-xs text-muted-foreground">
                    Important milestones only
                  </p>
                </div>
                <Switch
                  id="push-critical"
                  checked={prefs.push_critical_only}
                  onCheckedChange={(checked) => {
                    updatePref("push_critical_only", checked);
                    if (checked) updatePref("push_all_updates", false);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Email Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h4 className="font-medium">Email Notifications</h4>
        </div>
        <div className="space-y-3 pl-7">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled">Enable email notifications</Label>
            <Switch
              id="email-enabled"
              checked={prefs.email_enabled}
              onCheckedChange={(checked) => updatePref("email_enabled", checked)}
            />
          </div>
          {prefs.email_enabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-confirmation">Confirmation & receipt only</Label>
                  <p className="text-xs text-muted-foreground">
                    Order placed and delivered emails
                  </p>
                </div>
                <Switch
                  id="email-confirmation"
                  checked={prefs.email_confirmation_only}
                  onCheckedChange={(checked) => {
                    updatePref("email_confirmation_only", checked);
                    if (checked) updatePref("email_all_updates", false);
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-all">All updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Email for every notification stage
                  </p>
                </div>
                <Switch
                  id="email-all"
                  checked={prefs.email_all_updates}
                  onCheckedChange={(checked) => {
                    updatePref("email_all_updates", checked);
                    if (checked) updatePref("email_confirmation_only", false);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Preferences"}
      </Button>
    </Card>
  );
}
