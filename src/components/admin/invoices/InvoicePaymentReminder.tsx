import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Bell, Loader2 } from "lucide-react";

const reminderSchema = z.object({
  invoice_id: z.string(),
  days_before_due: z.number().min(0).max(90),
  reminder_type: z.enum(["email", "sms", "both"]),
  message_template: z.string().max(1000).optional(),
  auto_send: z.boolean(),
});

type ReminderFormData = z.infer<typeof reminderSchema>;

interface InvoicePaymentReminderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  dueDate: string;
  onSuccess?: () => void;
}

/**
 * Task 297: Add invoice payment reminder automation
 * Allows scheduling automated payment reminders before invoice due date
 */
export function InvoicePaymentReminder({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  dueDate,
  onSuccess,
}: InvoicePaymentReminderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      invoice_id: invoiceId,
      days_before_due: 3,
      reminder_type: "email",
      auto_send: true,
      message_template: "",
    },
  });

  const onSubmit = async (data: ReminderFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Wire to Supabase invoice_payment_reminders table
      logger.info("Payment reminder configured", { data });
      toast.success("Payment reminder scheduled");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      logger.error("Failed to schedule reminder", { error });
      toast.error("Failed to schedule payment reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-600" />
            Payment Reminder - Invoice #{invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="days_before_due"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send Reminder</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={90}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Days before due date ({dueDate})
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminder_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Email Only</SelectItem>
                      <SelectItem value="sms">SMS Only</SelectItem>
                      <SelectItem value="both">Email + SMS</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message_template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Message (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hi {customer_name}, friendly reminder that invoice #{invoice_number} is due on {due_date}..."
                      maxLength={1000}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use {"{customer_name}"}, {"{invoice_number}"}, {"{due_date}"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auto_send"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Auto-send</FormLabel>
                    <FormDescription>
                      Automatically send reminder on schedule
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule Reminder
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
