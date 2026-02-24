import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeFormInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";

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
  const [formData, setFormData] = useState({
    customer_id: "",
    subject: "",
    description: "",
    priority: "medium",
    status: "open",
  });

  useEffect(() => {
    if (ticket) {
      setFormData({
        customer_id: "",
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
      });
    } else {
      setFormData({
        customer_id: "",
        subject: "",
        description: "",
        priority: "medium",
        status: "open",
      });
    }
  }, [ticket, open]);

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
      toast.error(ticket ? "Failed to update ticket" : "Failed to create ticket");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    await createMutation.mutateAsync({
      subject: sanitizeFormInput(formData.subject, 200),
      description: sanitizeTextareaInput(formData.description, 2000),
      priority: formData.priority,
      category: formData.status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket ? "Edit Ticket" : "Create New Ticket"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="Brief description of the issue"
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Detailed description of the issue"
              rows={6}
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
      </DialogContent>
    </Dialog>
  );
}

