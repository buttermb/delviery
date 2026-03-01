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

const ticketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
}

interface TicketFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket?: Ticket | null;
  onSuccess?: () => void;
}

export function TicketForm({
  open,
  onOpenChange,
  ticket,
  onSuccess,
}: TicketFormProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      description: "",
      priority: "medium",
      status: "open",
    },
  });

  useEffect(() => {
    if (ticket) {
      form.reset({
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority as TicketFormValues["priority"],
        status: ticket.status as TicketFormValues["status"],
      });
    } else {
      form.reset({
        subject: "",
        description: "",
        priority: "medium",
        status: "open",
      });
    }
  }, [ticket, open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: { subject: string; description: string; priority?: string; category?: string }) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      try {
        if (ticket) {
          const { error } = await supabase
            .from("support_tickets")
            .update(data)
            .eq("id", ticket.id);

          if (error && error.code !== "42P01") throw error;
        } else {
          const { error } = await supabase.from("support_tickets").insert([
            {
              tenant_id: tenant.id,
              account_id: tenant.id,
              ticket_number: `TKT-${Date.now()}`,
              ...data,
            },
          ]);

          if (error && error.code !== "42P01") throw error;
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code !== "42P01") throw error;
        logger.warn('Support tickets table does not exist yet', { component: 'TicketForm' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.support.tickets() });
      toast.success(ticket ? "Ticket updated successfully" : "Ticket created successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to save ticket', error, { component: 'TicketForm' });
      toast.error(ticket ? "Failed to update ticket" : "Failed to create ticket", { description: humanizeError(error) });
    },
  });

  const onSubmit = async (values: TicketFormValues) => {
    await createMutation.mutateAsync({
      subject: sanitizeFormInput(values.subject, 200),
      description: sanitizeTextareaInput(values.description, 2000),
      priority: values.priority,
      category: values.status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket ? "Edit Ticket" : "Create New Ticket"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Subject</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief description of the issue"
                      className="min-h-[44px] touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Detailed description of the issue"
                      rows={6}
                      className="min-h-[44px] touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {ticket ? "Update Ticket" : "Create Ticket"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
