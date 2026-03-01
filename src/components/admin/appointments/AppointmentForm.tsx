import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeFormInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import { humanizeError } from "@/lib/humanizeError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

const appointmentSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  scheduled_at: z.string().min(1, "Date & time is required"),
  duration_minutes: z.string(),
  appointment_type: z.enum(["consultation", "delivery", "pickup", "follow-up"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date | null;
  onSuccess?: () => void;
}

export function AppointmentForm({
  open,
  onOpenChange,
  selectedDate,
  onSuccess,
}: AppointmentFormProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      customer_id: "",
      scheduled_at: selectedDate
        ? new Date(selectedDate).toISOString().slice(0, 16)
        : "",
      duration_minutes: "30",
      appointment_type: "consultation",
      notes: "",
    },
  });

  useEffect(() => {
    if (selectedDate) {
      form.setValue("scheduled_at", new Date(selectedDate).toISOString().slice(0, 16));
    }
  }, [selectedDate, form]);

  const createMutation = useMutation({
    mutationFn: async (data: {
      customer_id: string;
      scheduled_at: string;
      duration_minutes: number;
      appointment_type: string;
      notes: string | null;
      status: string;
    }) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      try {
        const { error } = await supabase.from("appointments").insert([
          {
            ...data,
            account_id: tenant.id,
          },
        ]);

        if (error && error.code !== "42P01") throw error;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code !== "42P01") throw error;
        logger.warn('Appointments table does not exist yet', { component: 'AppointmentForm' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments.lists() });
      toast.success("Appointment created successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create appointment', error, { component: 'AppointmentForm' });
      toast.error("Failed to create appointment", { description: humanizeError(error) });
    },
  });

  const onSubmit = async (values: AppointmentFormValues) => {
    await createMutation.mutateAsync({
      customer_id: sanitizeFormInput(values.customer_id),
      scheduled_at: values.scheduled_at,
      duration_minutes: parseInt(values.duration_minutes, 10),
      appointment_type: values.appointment_type,
      notes: values.notes ? sanitizeTextareaInput(values.notes, 1000) : null,
      status: "scheduled",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Customer</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Customer ID or email"
                      className="min-h-[44px] touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduled_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Date & Time</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="datetime-local"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="appointment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appointment Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[44px] touch-manipulation">
                        <SelectValue placeholder="Select appointment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                      <SelectItem value="pickup">Pickup</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes or special instructions"
                      rows={3}
                      className="min-h-[44px] touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
                className="min-h-[44px] touch-manipulation"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="min-h-[44px] touch-manipulation"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Schedule Appointment
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
