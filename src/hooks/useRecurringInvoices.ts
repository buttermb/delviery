import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import { humanizeError } from "@/lib/humanizeError";

export interface RecurringLineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface RecurringSchedule {
  id: string;
  tenant_id: string;
  client_id: string;
  template_id: string | null;
  name: string;
  line_items: RecurringLineItem[];
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  next_run_date: string;
  last_run_date: string | null;
  day_of_month: number | null;
  auto_send_email: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    email: string | null;
  };
}

export type CreateScheduleInput = Omit<RecurringSchedule, "id" | "tenant_id" | "created_at" | "updated_at" | "last_run_date" | "client">;

export function useRecurringInvoices() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: queryKeys.recurringSchedules.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("recurring_invoice_schedules")
        .select(`
          *,
          client:crm_clients(id, name, email)
        `)
        .eq("tenant_id", tenant.id)
        .order("next_run_date", { ascending: true });

      if (error) throw error;

      return data.map(d => ({
        ...d,
        line_items: (d.line_items || []) as unknown as RecurringLineItem[]
      })) as RecurringSchedule[];
    },
    enabled: !!tenant?.id
  });

  const createSchedule = useMutation({
    mutationFn: async (input: CreateScheduleInput) => {
      if (!tenant?.id) throw new Error("No tenant");

      const { data, error } = await supabase
        .from("recurring_invoice_schedules")
        .insert([{
          tenant_id: tenant.id,
          client_id: input.client_id,
          template_id: input.template_id,
          name: input.name,
          line_items: input.line_items as unknown as Json,
          frequency: input.frequency,
          next_run_date: input.next_run_date,
          day_of_month: input.day_of_month,
          auto_send_email: input.auto_send_email,
          is_active: input.is_active,
          notes: input.notes
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSchedules.byTenant(tenant?.id) });
      toast.success("Recurring invoice schedule created");
    },
    onError: (error: unknown) => toast.error("Failed to create schedule", { description: humanizeError(error) })
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringSchedule> & { id: string }) => {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.client_id !== undefined) payload.client_id = updates.client_id;
      if (updates.template_id !== undefined) payload.template_id = updates.template_id;
      if (updates.line_items !== undefined) payload.line_items = updates.line_items as unknown as Json;
      if (updates.frequency !== undefined) payload.frequency = updates.frequency;
      if (updates.next_run_date !== undefined) payload.next_run_date = updates.next_run_date;
      if (updates.day_of_month !== undefined) payload.day_of_month = updates.day_of_month;
      if (updates.auto_send_email !== undefined) payload.auto_send_email = updates.auto_send_email;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active;
      if (updates.notes !== undefined) payload.notes = updates.notes;

      if (!tenant?.id) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("recurring_invoice_schedules")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenant.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSchedules.byTenant(tenant?.id) });
      toast.success("Schedule updated");
    },
    onError: (error: unknown) => toast.error("Failed to update schedule", { description: humanizeError(error) })
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { error } = await supabase
        .from("recurring_invoice_schedules")
        .update({ is_active })
        .eq("id", id)
        .eq("tenant_id", tenant.id);

      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSchedules.byTenant(tenant?.id) });
      toast.success(is_active ? "Schedule activated" : "Schedule paused");
    },
    onError: (error: unknown) => toast.error("Failed to update schedule", { description: humanizeError(error) })
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { error } = await supabase
        .from("recurring_invoice_schedules")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSchedules.byTenant(tenant?.id) });
      toast.success("Schedule deleted");
    },
    onError: (error: unknown) => toast.error("Failed to delete schedule", { description: humanizeError(error) })
  });

  const activeSchedules = schedules.filter(s => s.is_active);
  const upcomingCount = activeSchedules.filter(s => {
    const nextRun = new Date(s.next_run_date);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return nextRun <= weekFromNow;
  }).length;

  return {
    schedules,
    activeSchedules,
    upcomingCount,
    isLoading,
    createSchedule,
    updateSchedule,
    toggleActive,
    deleteSchedule
  };
}
