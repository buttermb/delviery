import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Send, Calendar, AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FrontedInventoryItem {
  id: string;
  fronted_to_customer_name: string;
  payment_due_date: string | null;
  expected_revenue: number | null;
  payment_received: number | null;
  status: string;
  products?: { name: string } | null;
  fronted_payments?: { amount: number }[] | null;
}

export default function FrontedInventoryReminders() {
  const [reminders, setReminders] = useState<FrontedInventoryItem[]>([]);
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState("3");

  const loadOverdueFronts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("fronted_inventory")
        .select(`
          *,
          products (name),
          fronted_payments (amount)
        `)
        .eq("status", "active")
        .order("payment_due_date", { ascending: true });

      if (error) throw error;

      const now = new Date();
      const frontsNeedingReminder = data?.filter((front) => {
        if (!front.payment_due_date) return false;

        const dueDate = new Date(front.payment_due_date);
        const amountOwed = parseFloat(String(front.expected_revenue || 0)) - parseFloat(String(front.payment_received || 0));

        // Include if overdue or due within reminder days
        const daysUntilDue = differenceInDays(dueDate, now);
        return amountOwed > 0 && daysUntilDue <= parseInt(reminderDays);
      });

      setReminders(frontsNeedingReminder || []);
    } catch (error: unknown) {
      logger.error("Failed to load reminders", error instanceof Error ? error : new Error(String(error)), { component: 'FrontedInventoryReminders' });
      toast.error("Failed to load reminders: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  }, [reminderDays]);

  useEffect(() => {
    loadOverdueFronts();
  }, [loadOverdueFronts]);

  const sendReminder = async (front: FrontedInventoryItem) => {
    try {
      // In production, this would trigger an SMS/email via edge function
      toast.success(`Reminder sent to ${front.fronted_to_customer_name}`);
      
      // Log the reminder
      await supabase.from("audit_logs").insert({
        entity_type: "fronted_inventory",
        entity_id: front.id,
        action: "REMINDER_SENT",
        details: {
          customer: front.fronted_to_customer_name,
          amount_owed: parseFloat(String(front.expected_revenue || 0)) - parseFloat(String(front.payment_received || 0)),
          due_date: front.payment_due_date,
        },
      });
    } catch (error: unknown) {
      logger.error("Failed to send reminder", error instanceof Error ? error : new Error(String(error)), { component: 'FrontedInventoryReminders', frontId: front.id });
      toast.error("Failed to send reminder: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const sendBulkReminders = async () => {
    if (reminders.length === 0) {
      toast.error("No reminders to send");
      return;
    }

    try {
      for (const front of reminders) {
        await sendReminder(front);
      }
      toast.success(`Sent ${reminders.length} reminders`);
    } catch (error: unknown) {
      logger.error("Failed to send bulk reminders", error instanceof Error ? error : new Error(String(error)), { component: 'FrontedInventoryReminders' });
      toast.error("Failed to send bulk reminders: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Payment Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Settings */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Automatically send reminders for upcoming payments
              </p>
            </div>
            <Switch
              checked={autoRemindersEnabled}
              onCheckedChange={setAutoRemindersEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Send Reminders When Due In:</Label>
            <Select value={reminderDays} onValueChange={setReminderDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pending Reminders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {reminders.length} Reminder{reminders.length !== 1 ? "s" : ""} Pending
            </p>
            {reminders.length > 0 && (
              <Button size="sm" onClick={sendBulkReminders}>
                <Send className="h-4 w-4 mr-1" />
                Send All
              </Button>
            )}
          </div>

          {reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pending reminders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((front) => {
                const dueDate = new Date(front.payment_due_date);
                const daysUntilDue = differenceInDays(dueDate, new Date());
                const isOverdue = daysUntilDue < 0;
                const amountOwed =
                  parseFloat(String(front.expected_revenue || 0)) - parseFloat(String(front.payment_received || 0));

                return (
                  <div
                    key={front.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">
                          {front.fronted_to_customer_name || "Unknown"}
                        </p>
                        {isOverdue ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {Math.abs(daysUntilDue)} days overdue
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Due in {daysUntilDue} days
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {front.products?.name} • ${amountOwed.toFixed(2)} owed
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendReminder(front)}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Send
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
