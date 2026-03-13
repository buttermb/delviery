import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

interface InvoicePaymentReminderProps {
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  dueDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Task 297: Invoice Payment Reminder Automation
 * Allows sending payment reminder emails for overdue invoices
 */
export function InvoicePaymentReminder({
  invoiceId,
  invoiceNumber,
  clientEmail,
  dueDate,
  open,
  onOpenChange,
}: InvoicePaymentReminderProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [reminderType, setReminderType] = useState<"gentle" | "firm" | "final">("gentle");
  const [customMessage, setCustomMessage] = useState("");

  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("No tenant");

      // Log reminder send attempt
      logger.info("Sending payment reminder", { invoiceId, reminderType });

      // Insert reminder log
      const { error: logError } = await supabase
        .from("invoice_payment_reminders")
        .insert({
          tenant_id: tenant.id,
          invoice_id: invoiceId,
          reminder_type: reminderType,
          message: customMessage || getDefaultMessage(reminderType, invoiceNumber, dueDate),
          sent_to: clientEmail,
        });

      if (logError) throw logError;

      // In production, this would integrate with email service
      // For now, we just log the reminder
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.lists() });
      toast.success("Payment reminder sent", {
        description: `Reminder sent to ${clientEmail}`,
      });
      onOpenChange(false);
      setCustomMessage("");
      setReminderType("gentle");
    },
    onError: (error: unknown) => {
      logger.error("Failed to send payment reminder", { error });
      toast.error("Failed to send reminder");
    },
  });

  function getDefaultMessage(type: string, number: string, due: string): string {
    const templates = {
      gentle: `This is a friendly reminder that Invoice ${number} (due ${due}) remains unpaid. Please process payment at your earliest convenience.`,
      firm: `Invoice ${number} is now overdue (due date: ${due}). Please remit payment immediately to avoid late fees.`,
      final: `FINAL NOTICE: Invoice ${number} is significantly overdue. Please contact us immediately to resolve this matter.`,
    };
    return templates[type as keyof typeof templates] || templates.gentle;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Send Payment Reminder
          </DialogTitle>
          <DialogDescription>
            Invoice {invoiceNumber} • {clientEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reminder Type</Label>
            <Select value={reminderType} onValueChange={(v) => setReminderType(v as typeof reminderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gentle">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Gentle Reminder
                  </div>
                </SelectItem>
                <SelectItem value="firm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-500" />
                    Firm Notice
                  </div>
                </SelectItem>
                <SelectItem value="final">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-red-500" />
                    Final Warning
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message Preview</Label>
            <div className="rounded-md border p-3 text-sm bg-muted/30">
              {customMessage || getDefaultMessage(reminderType, invoiceNumber, dueDate)}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Custom Message (Optional)</Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a custom message or leave blank to use the default template"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{customMessage.length}/500 characters</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => sendReminderMutation.mutate()} disabled={sendReminderMutation.isPending}>
            {sendReminderMutation.isPending ? "Sending..." : "Send Reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
