import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { humanizeError } from '@/lib/humanizeError';
import { logger } from "@/lib/logger";
import type { Json } from "@/integrations/supabase/types";

export interface RecurringOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export type RecurringOrderFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";

export interface RecurringOrderSchedule {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  order_items: RecurringOrderItem[];
  frequency: RecurringOrderFrequency;
  next_order_date: string;
  end_date: string | null;
  last_order_date: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  auto_confirm: boolean;
  auto_assign_runner: boolean;
  preferred_runner_id: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    business_name: string;
    contact_name: string;
    email: string;
    phone: string;
    address: string;
  };
  preferred_runner?: {
    id: string;
    full_name: string;
  } | null;
}

export type CreateRecurringOrderInput = Omit<
  RecurringOrderSchedule,
  "id" | "tenant_id" | "created_at" | "updated_at" | "last_order_date" | "client" | "preferred_runner"
>;

export type UpdateRecurringOrderInput = Partial<CreateRecurringOrderInput> & { id: string };

export function useRecurringOrders() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading, error } = useQuery({
    queryKey: queryKeys.recurringOrders.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("recurring_order_schedules")
        .select(`
          *,
          client:wholesale_clients(id, business_name, contact_name, email, phone, address),
          preferred_runner:wholesale_runners(id, full_name)
        `)
        .eq("tenant_id", tenant.id)
        .order("next_order_date", { ascending: true });

      if (error) {
        logger.error("Failed to fetch recurring order schedules", error, {
          component: "useRecurringOrders",
          tenantId: tenant.id,
        });
        throw error;
      }

      return (data ?? []).map((schedule) => ({
        ...schedule,
        order_items: (schedule.order_items ?? []) as unknown as RecurringOrderItem[],
        frequency: schedule.frequency as RecurringOrderFrequency,
      })) as RecurringOrderSchedule[];
    },
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds
  });

  const createSchedule = useMutation({
    mutationFn: async (input: CreateRecurringOrderInput) => {
      if (!tenant?.id) throw new Error("No tenant context");

      const { data, error } = await supabase
        .from("recurring_order_schedules")
        .insert([{
          tenant_id: tenant.id,
          client_id: input.client_id,
          name: input.name,
          order_items: input.order_items as unknown as Json,
          frequency: input.frequency,
          next_order_date: input.next_order_date,
          end_date: input.end_date,
          day_of_week: input.day_of_week,
          day_of_month: input.day_of_month,
          auto_confirm: input.auto_confirm,
          auto_assign_runner: input.auto_assign_runner,
          preferred_runner_id: input.preferred_runner_id,
          delivery_address: input.delivery_address,
          delivery_notes: input.delivery_notes,
          is_active: input.is_active,
          notes: input.notes,
        }])
        .select()
        .maybeSingle();

      if (error) {
        logger.error("Failed to create recurring order schedule", error, {
          component: "useRecurringOrders",
          tenantId: tenant.id,
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringOrders.list(tenant?.id) });
      toast.success("Recurring order schedule created");
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to create schedule'));
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateRecurringOrderInput) => {
      if (!tenant?.id) throw new Error("No tenant context");

      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.client_id !== undefined) payload.client_id = updates.client_id;
      if (updates.order_items !== undefined) payload.order_items = updates.order_items as unknown as Json;
      if (updates.frequency !== undefined) payload.frequency = updates.frequency;
      if (updates.next_order_date !== undefined) payload.next_order_date = updates.next_order_date;
      if (updates.end_date !== undefined) payload.end_date = updates.end_date;
      if (updates.day_of_week !== undefined) payload.day_of_week = updates.day_of_week;
      if (updates.day_of_month !== undefined) payload.day_of_month = updates.day_of_month;
      if (updates.auto_confirm !== undefined) payload.auto_confirm = updates.auto_confirm;
      if (updates.auto_assign_runner !== undefined) payload.auto_assign_runner = updates.auto_assign_runner;
      if (updates.preferred_runner_id !== undefined) payload.preferred_runner_id = updates.preferred_runner_id;
      if (updates.delivery_address !== undefined) payload.delivery_address = updates.delivery_address;
      if (updates.delivery_notes !== undefined) payload.delivery_notes = updates.delivery_notes;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active;
      if (updates.notes !== undefined) payload.notes = updates.notes;

      const { data, error } = await supabase
        .from("recurring_order_schedules")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error("Failed to update recurring order schedule", error, {
          component: "useRecurringOrders",
          scheduleId: id,
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringOrders.list(tenant?.id) });
      toast.success("Schedule updated");
    },
    onError: (error: unknown) => {
      toast.error("Failed to update schedule", { description: humanizeError(error) });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!tenant?.id) throw new Error("No tenant context");

      const { error } = await supabase
        .from("recurring_order_schedules")
        .update({ is_active })
        .eq("id", id)
        .eq("tenant_id", tenant.id);

      if (error) {
        logger.error("Failed to toggle recurring order schedule", error, {
          component: "useRecurringOrders",
          scheduleId: id,
        });
        throw error;
      }
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringOrders.list(tenant?.id) });
      toast.success(is_active ? "Schedule activated" : "Schedule paused");
    },
    onError: (error: unknown) => {
      toast.error("Failed to update schedule", { description: humanizeError(error) });
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error("No tenant context");

      const { error } = await supabase
        .from("recurring_order_schedules")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenant.id);

      if (error) {
        logger.error("Failed to delete recurring order schedule", error, {
          component: "useRecurringOrders",
          scheduleId: id,
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringOrders.list(tenant?.id) });
      toast.success("Schedule deleted");
    },
    onError: (error: unknown) => {
      toast.error("Failed to delete schedule", { description: humanizeError(error) });
    },
  });

  const triggerOrderNow = useMutation({
    mutationFn: async (scheduleId: string) => {
      if (!tenant?.id) throw new Error("No tenant context");

      // This would call an edge function to create the order immediately
      const { data, error } = await supabase.functions.invoke("generate-recurring-order", {
        body: { schedule_id: scheduleId, trigger: "manual" },
      });

      if (error) {
        logger.error("Failed to trigger recurring order", error, {
          component: "useRecurringOrders",
          scheduleId,
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringOrders.list(tenant?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      toast.success("Order created from recurring schedule");
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to create order'));
    },
  });

  // Computed values
  const activeSchedules = schedules.filter((s) => s.is_active);

  const upcomingCount = activeSchedules.filter((s) => {
    const nextOrder = new Date(s.next_order_date);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return nextOrder <= weekFromNow;
  }).length;

  const totalMonthlyValue = activeSchedules.reduce((total, schedule) => {
    const orderValue = schedule.order_items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    // Normalize to monthly value
    const multiplier = {
      daily: 30,
      weekly: 4,
      biweekly: 2,
      monthly: 1,
      quarterly: 0.33,
    }[schedule.frequency];
    return total + orderValue * multiplier;
  }, 0);

  return {
    schedules,
    activeSchedules,
    upcomingCount,
    totalMonthlyValue,
    isLoading,
    error,
    createSchedule,
    updateSchedule,
    toggleActive,
    deleteSchedule,
    triggerOrderNow,
  };
}
