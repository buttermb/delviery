import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";

export const useFinancialSnapshot = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.finance.snapshot(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Fetch from both orders tables to get comprehensive revenue data
      const [ordersResult, wholesaleResult] = await Promise.all([
        // Regular orders (retail, POS, etc.)
        supabase
          .from("orders")
          .select("total_amount, status, payment_status")
          .eq("tenant_id", tenant.id)
          .gte("created_at", startOfToday.toISOString())
          .lte("created_at", endOfToday.toISOString()),
        // Wholesale orders (B2B)
        supabase
          .from("wholesale_orders")
          .select("total_amount, status, payment_status")
          .eq("tenant_id", tenant.id)
          .gte("created_at", startOfToday.toISOString())
          .lte("created_at", endOfToday.toISOString()),
      ]);

      const orders = ordersResult.data ?? [];
      const wholesaleOrders = wholesaleResult.data ?? [];
      const allOrders = [...orders, ...wholesaleOrders];

      // Calculate revenue from completed/delivered orders (real revenue)
      const completedStatuses = ['completed', 'delivered'];
      const completedOrders = allOrders.filter(o => completedStatuses.includes(o.status));
      const pendingOrders = allOrders.filter(o => !completedStatuses.includes(o.status) && o.status !== 'cancelled' && o.status !== 'rejected');

      // Real revenue from completed orders
      const completedRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      // Pending revenue (not yet finalized)
      const pendingRevenue = pendingOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      // Total revenue includes completed orders
      const revenue = completedRevenue;
      const deals = allOrders.length;

      // Calculate margin based on actual data if available, otherwise estimate
      // For now, using estimated COGS but flagging for future product cost integration
      const estimatedCOGSPercentage = 0.62;
      const cost = revenue * estimatedCOGSPercentage;
      const net_profit = revenue - cost;
      const margin = revenue > 0 ? Math.round((net_profit / revenue) * 100) : 0;

      return {
        revenue,
        deals,
        cost,
        net_profit,
        margin,
        pendingRevenue, // Additional data for UI
        completedDeals: completedOrders.length,
        pendingDeals: pendingOrders.length,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 30_000, // Reduced for more real-time updates
    gcTime: 300_000,
  });
};

export const useCashFlow = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.finance.cashFlow(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const today = new Date();
      const startOfToday = startOfDay(today);
      const weekStart = startOfWeek(today);
      const weekEnd = endOfWeek(today);

      // Today's collections - filtered by tenant_id
      const { data: todayPayments } = await supabase.from("wholesale_payments").select("amount")
        .eq("tenant_id", tenant.id).gte("created_at", startOfToday.toISOString());

      const collections_today = todayPayments?.reduce((sum: number, p) => sum + Number(p.amount), 0) ?? 0;

      // Expected this week - filtered by tenant_id
      const { data: weekOrders } = await supabase.from("wholesale_orders").select("total_amount")
        .eq("tenant_id", tenant.id)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString())
        .neq("status", "cancelled");

      const expected_this_week = weekOrders?.reduce((sum: number, o) => sum + Number(o.total_amount), 0) ?? 0;

      // Outstanding balance - filtered by tenant_id
      const { data: clients } = await supabase.from("wholesale_clients").select("outstanding_balance")
        .eq("tenant_id", tenant.id);

      const outstanding = clients?.reduce((sum: number, c) => sum + Number(c.outstanding_balance), 0) ?? 0;

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
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
};

export const useCreditOut = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.finance.creditOut(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data: clients, error } = await supabase
        .from("wholesale_clients")
        .select("id, business_name, outstanding_balance, last_payment_date, payment_terms")
        .eq("tenant_id", tenant.id)
        .gt("outstanding_balance", 0)
        .order("outstanding_balance", { ascending: false });

      if (error) throw error;

      const total_outstanding = clients?.reduce((sum, c) => sum + Number(c.outstanding_balance), 0) ?? 0;

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
      })) ?? [];

      return {
        total_outstanding,
        overdue,
        due_this_week: [], // Would need more sophisticated date tracking
        future: 0
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
};

export const useCreatePaymentSchedule = () => {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async (data: { client_id: string; amount: number; due_date: string; notes?: string }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data: result, error } = await supabase
        .from("payment_schedules")
        .insert({
          client_id: data.client_id,
          amount: data.amount,
          due_date: data.due_date,
          notes: data.notes,
          status: "pending",
          tenant_id: tenant.id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialData.paymentSchedules() });
      showSuccessToast("Payment Scheduled", "Payment schedule created successfully");
    },
    onError: (error) => {
      showErrorToast("Schedule Failed", error instanceof Error ? error.message : "Failed to schedule payment");
    }
  });
};

export const useCreateCollectionActivity = () => {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async (data: { client_id: string; activity_type: string; amount?: number; notes?: string }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data: result, error } = await supabase
        .from("collection_activities")
        .insert({
          client_id: data.client_id,
          activity_type: data.activity_type,
          amount: data.amount,
          notes: data.notes,
          tenant_id: tenant.id,
          performed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      showSuccessToast("Activity Logged", "Collection activity recorded successfully");
    },
    onError: (error) => {
      showErrorToast("Log Failed", error instanceof Error ? error.message : "Failed to log activity");
    }
  });
};

export const useMonthlyPerformance = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.finance.monthlyPerformance(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // Fetch from both orders tables for complete picture
      const [ordersResult, wholesaleResult] = await Promise.all([
        supabase
          .from("orders")
          .select("total_amount, status, payment_status")
          .eq("tenant_id", tenant.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString()),
        supabase
          .from("wholesale_orders")
          .select("total_amount, status, payment_status")
          .eq("tenant_id", tenant.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString()),
      ]);

      const orders = ordersResult.data ?? [];
      const wholesaleOrders = wholesaleResult.data ?? [];
      const allOrders = [...orders, ...wholesaleOrders];

      // Calculate revenue from completed orders only (real recognized revenue)
      const completedStatuses = ['completed', 'delivered'];
      const completedOrders = allOrders.filter(o => completedStatuses.includes(o.status));

      const revenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      // Estimated COGS (can be enhanced with real product costs later)
      const estimatedCOGSPercentage = 0.635;
      const cost = revenue * estimatedCOGSPercentage;
      const gross_profit = revenue - cost;
      const margin = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
      const deals = allOrders.length;
      const completedDeals = completedOrders.length;

      return {
        revenue,
        cost,
        gross_profit,
        margin: Math.round(margin * 10) / 10,
        deals,
        completedDeals,
        avg_deal_size: completedDeals > 0 ? Math.round(revenue / completedDeals) : 0
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60_000, // Reduced for more real-time updates
    gcTime: 600_000,
  });
};

export interface ExpenseSummary {
  totalExpenses: number;
  thisMonthExpenses: number;
  categoryBreakdown: Array<{ name: string; value: number; percentage: number }>;
  recentExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    created_at: string;
  }>;
  topCategory: { name: string; amount: number } | null;
}

export const useExpenseSummary = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.financialData.expenseSummary(tenant?.id),
    queryFn: async (): Promise<ExpenseSummary> => {
      if (!tenant?.id) throw new Error('No tenant context');

      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // Fetch all expenses for the tenant (using any to avoid type issues with optional table)
      const expensesQuery = supabase
        .from("expenses")
        .select('id, description, amount, category, created_at')
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: expenses, error } = await expensesQuery;

      // Handle table not existing gracefully
      if (error && (error as { code?: string }).code === '42P01') {
        return {
          totalExpenses: 0,
          thisMonthExpenses: 0,
          categoryBreakdown: [],
          recentExpenses: [],
          topCategory: null
        };
      }

      if (error) throw error;

      const expenseList = (expenses ?? []) as Array<{
        id: string;
        description: string;
        amount: number | string;
        category: string;
        created_at: string;
      }>;

      // Calculate total expenses
      const totalExpenses = expenseList.reduce(
        (sum, e) => sum + Number(e.amount || 0),
        0
      );

      // Calculate this month's expenses
      const thisMonthExpenses = expenseList
        .filter(e => {
          const expenseDate = new Date(e.created_at);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        })
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // Calculate category breakdown
      const categoryTotals: Record<string, number> = {};
      expenseList.forEach(e => {
        const category = e.category || 'Uncategorized';
        categoryTotals[category] = (categoryTotals[category] ?? 0) + Number(e.amount || 0);
      });

      const categoryBreakdown = Object.entries(categoryTotals)
        .map(([name, value]) => ({
          name,
          value,
          percentage: totalExpenses > 0 ? Math.round((value / totalExpenses) * 100) : 0
        }))
        .sort((a, b) => b.value - a.value);

      // Get top category
      const topCategory = categoryBreakdown.length > 0
        ? { name: categoryBreakdown[0].name, amount: categoryBreakdown[0].value }
        : null;

      // Get recent expenses (last 5)
      const recentExpenses = expenseList.slice(0, 5).map(e => ({
        id: e.id,
        description: e.description || 'No description',
        amount: Number(e.amount || 0),
        category: e.category || 'Uncategorized',
        created_at: e.created_at
      }));

      return {
        totalExpenses,
        thisMonthExpenses,
        categoryBreakdown,
        recentExpenses,
        topCategory
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
};
