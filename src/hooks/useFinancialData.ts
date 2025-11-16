import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export const useFinancialSnapshot = () => {
  return useQuery({
    queryKey: ["financial-snapshot"],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Today's orders
      const { data: orders, error: ordersError } = await supabase
        .from("wholesale_orders")
        .select("total_amount, status")
        .gte("created_at", startOfToday.toISOString())
        .lte("created_at", endOfToday.toISOString());

      if (ordersError) throw ordersError;

      const revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const deals = orders?.length || 0;

      return {
        revenue,
        deals,
        cost: revenue * 0.62, // Estimate 62% COGS
        net_profit: revenue * 0.38, // Estimate 38% margin
        margin: 38
      };
    }
  });
};

export const useCashFlow = () => {
  return useQuery({
    queryKey: ["cash-flow"],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const weekStart = startOfWeek(today);
      const weekEnd = endOfWeek(today);

      // Today's collections
      const { data: todayPayments } = await supabase
        .from("wholesale_payments")
        .select("amount")
        .gte("created_at", startOfToday.toISOString());

      const collections_today = todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Expected this week (orders due this week)
      const { data: weekOrders } = await supabase
        .from("wholesale_orders")
        .select("total_amount")
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString())
        .neq("status", "cancelled");

      const expected_this_week = weekOrders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

      // Outstanding balance
      const { data: clients } = await supabase
        .from("wholesale_clients")
        .select("outstanding_balance");

      const outstanding = clients?.reduce((sum, c) => sum + Number(c.outstanding_balance), 0) || 0;

      return {
        incoming: {
          collections_today,
          expected_this_week,
          outstanding
        },
        outgoing: {
          supplier_payments: 0, // Would need supplier_payments table
          payroll: 0,
          operating: 0,
          runner_bonuses: 0
        }
      };
    }
  });
};

export const useCreditOut = () => {
  return useQuery({
    queryKey: ["credit-out"],
    queryFn: async () => {
      const { data: clients, error } = await supabase
        .from("wholesale_clients")
        .select("id, business_name, outstanding_balance, last_payment_date, payment_terms")
        .gt("outstanding_balance", 0)
        .order("outstanding_balance", { ascending: false });

      if (error) throw error;

      const total_outstanding = clients?.reduce((sum, c) => sum + Number(c.outstanding_balance), 0) || 0;

      // Calculate overdue (payment_terms days past last_order without payment)
      const now = new Date();
      const overdue = clients?.filter(c => {
        if (!c.last_payment_date) return true;
        const daysSincePayment = Math.floor((now.getTime() - new Date(c.last_payment_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysSincePayment > c.payment_terms;
      }).slice(0, 5).map(c => ({
        client_id: c.id,
        client: c.business_name,
        amount: Number(c.outstanding_balance),
        days: c.last_payment_date 
          ? Math.floor((now.getTime() - new Date(c.last_payment_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      })) || [];

      return {
        total_outstanding,
        overdue,
        due_this_week: [], // Would need more sophisticated date tracking
        future: 0
      };
    }
  });
};

export const useCreatePaymentSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { client_id: string; amount: number; due_date: string; notes?: string }) => {
      const { data: result, error } = await supabase
        .from("payment_schedules")
        .insert({
          client_id: data.client_id,
          amount: data.amount,
          due_date: data.due_date,
          notes: data.notes,
          status: "pending",
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-schedules"] });
      showSuccessToast("Payment Scheduled", "Payment schedule created successfully");
    },
    onError: (error) => {
      showErrorToast("Schedule Failed", error instanceof Error ? error.message : "Failed to schedule payment");
    }
  });
};

export const useCreateCollectionActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { client_id: string; activity_type: string; amount?: number; notes?: string }) => {
      const { data: result, error } = await supabase
        .from("collection_activities")
        .insert({
          client_id: data.client_id,
          activity_type: data.activity_type,
          amount: data.amount,
          notes: data.notes,
          performed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-activities"] });
      queryClient.invalidateQueries({ queryKey: ["credit-out"] });
      showSuccessToast("Activity Logged", "Collection activity recorded successfully");
    },
    onError: (error) => {
      showErrorToast("Log Failed", error instanceof Error ? error.message : "Failed to log activity");
    }
  });
};

export const useMonthlyPerformance = () => {
  return useQuery({
    queryKey: ["monthly-performance"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      const { data: orders, error } = await supabase
        .from("wholesale_orders")
        .select("total_amount, status")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      if (error) throw error;

      const revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const cost = revenue * 0.635; // Estimate
      const gross_profit = revenue - cost;
      const margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
      const deals = orders?.length || 0;

      return {
        revenue,
        cost,
        gross_profit,
        margin: Math.round(margin * 10) / 10,
        deals,
        avg_deal_size: deals > 0 ? Math.round(revenue / deals) : 0
      };
    }
  });
};
