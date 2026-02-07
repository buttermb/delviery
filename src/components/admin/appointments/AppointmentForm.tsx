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
  const [formData, setFormData] = useState({
    customer_id: "",
    scheduled_at: selectedDate
      ? new Date(selectedDate).toISOString().slice(0, 16)
      : "",
    duration_minutes: "30",
    appointment_type: "consultation",
    notes: "",
  });

  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        scheduled_at: new Date(selectedDate).toISOString().slice(0, 16),
      }));
    }
  }, [selectedDate]);

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
      toast.error("Failed to create appointment");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.scheduled_at || !formData.customer_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    await createMutation.mutateAsync({
      customer_id: sanitizeFormInput(formData.customer_id),
      scheduled_at: formData.scheduled_at,
      duration_minutes: parseInt(formData.duration_minutes, 10),
      appointment_type: formData.appointment_type,
      notes: formData.notes ? sanitizeTextareaInput(formData.notes, 1000) : null,
      status: "scheduled",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer_id">
              Customer <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customer_id"
              value={formData.customer_id}
              onChange={(e) =>
                setFormData({ ...formData, customer_id: e.target.value })
              }
              placeholder="Customer ID or email"
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">
                Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) =>
                  setFormData({ ...formData, scheduled_at: e.target.value })
                }
                required
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Select
                value={formData.duration_minutes}
                onValueChange={(value) =>
                  setFormData({ ...formData, duration_minutes: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment_type">Appointment Type</Label>
            <Select
              value={formData.appointment_type}
              onValueChange={(value) =>
                setFormData({ ...formData, appointment_type: value })
              }
            >
              <SelectTrigger className="min-h-[44px] touch-manipulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="follow-up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes or special instructions"
              rows={3}
              className="min-h-[44px] touch-manipulation"
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
              Schedule Appointment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

