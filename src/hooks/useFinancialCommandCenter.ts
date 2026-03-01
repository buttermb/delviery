/**
 * Financial Command Center Hook
 * 
 * Unified data hook for all 4 zones of the Financial Command Center:
 * - Zone A: Cash Flow Pulse (today's movement, weekly forecast, runway)
 * - Zone B: AR Command (outstanding by urgency, collection actions)
 * - Zone C: Fronted Inventory (consignments, aging, value at risk)
 * - Zone D: Performance Pulse (month comparison, trends, top clients)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  differenceInDays,
  addDays,
  format
} from 'date-fns';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

// Types
export interface QuickStats {
  cashPosition: number;
  todayPnL: number;
  outstandingAR: number;
  frontedValue: number;
  alertCount: number;
}

export interface CashFlowData {
  todayIn: number;
  todayOut: number;
  todayNet: number;
  paymentsReceived: number;
  payoutsProcessed: number;
  weeklyForecast: WeekDay[];
  expectedCollections: number;
  scheduledPayouts: number;
  projectedNet: number;
  cashRunway: {
    availableCash: number;
    avgDailyBurn: number;
    daysRemaining: number;
    isHealthy: boolean;
  };
}

export interface WeekDay {
  day: string;
  date: Date;
  amount: number;
  isPast: boolean;
  isToday: boolean;
}

export interface ARClient {
  id: string;
  name: string;
  amount: number;
  daysOverdue: number;
  lastContact?: Date;
  paymentPromise?: Date;
  paidPercentage: number;
  phone?: string;
  email?: string;
}

export interface ARData {
  totalOutstanding: number;
  overdue: number;
  overdueCount: number;
  dueThisWeek: number;
  dueThisWeekCount: number;
  upcoming: number;
  upcomingCount: number;
  priorityClients: ARClient[];
  allClients: ARClient[];
}

export interface FrontedItem {
  id: string;
  clientName: string;
  products: { name: string; quantity: number; unitPrice: number }[];
  totalValue: number;
  daysOut: number;
  expectedReturn: Date;
  status: 'healthy' | 'warning' | 'overdue';
}

export interface FrontedData {
  totalValue: number;
  totalUnits: number;
  avgDaysOut: number;
  activeConsignments: number;
  aging: {
    healthy: { units: number; value: number };
    warning: { units: number; value: number };
    overdue: { units: number; value: number };
  };
  items: FrontedItem[];
  healthScore: number;
}

export interface PerformanceData {
  thisMonth: {
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    deals: number;
    avgDealSize: number;
  };
  lastMonth: {
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    deals: number;
    avgDealSize: number;
  };
  changes: {
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    deals: number;
  };
  topClients: { name: string; revenue: number; percentage: number }[];
  marginTrend: { date: string; margin: number }[];
}

// Hook for Quick Stats Header
export const useQuickStats = () => {
  const { tenant } = useTenantAdminAuth();
  
  return useQuery({
    queryKey: queryKeys.financialCommandCenter.quickStats(tenant?.id),
    queryFn: async (): Promise<QuickStats> => {
      const today = new Date();
      const startOfToday = startOfDay(today);
      
      if (!tenant?.id) throw new Error('No tenant');

      // Parallel fetch all stats
      const [paymentsResult, ordersResult, clientsResult, frontedResult] = await Promise.all([
        // Today's payments received
        supabase
          .from('wholesale_payments')
          .select('amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', startOfToday.toISOString()),

        // Today's orders (revenue) - only count completed or delivered orders
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', startOfToday.toISOString())
          .in('status', ['completed', 'delivered']),

        // Outstanding AR
        supabase
          .from('wholesale_clients')
          .select('outstanding_balance')
          .eq('tenant_id', tenant.id)
          .gt('outstanding_balance', 0),

        // Fronted inventory value
        supabase
          .from('fronted_inventory')
          .select('expected_revenue')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
      ]);
      
      const todayIn = paymentsResult.data?.reduce((sum, p) => sum + Number(p.amount || 0), 0) ?? 0;
      const todayRevenue = ordersResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      const todayProfit = todayRevenue * 0.35; // ~35% margin estimate
      const outstanding = clientsResult.data?.reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0) ?? 0;
      const fronted = frontedResult.data?.reduce((sum, f) => sum + Number(f.expected_revenue || 0), 0) ?? 0;
      
      // Count alerts (overdue AR + aging fronted)
      const overdueCount = clientsResult.data?.filter(c => Number(c.outstanding_balance) > 0).length ?? 0;
      
      return {
        cashPosition: todayIn,
        todayPnL: todayProfit,
        outstandingAR: outstanding,
        frontedValue: fronted,
        alertCount: overdueCount
      };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000
  });
};

// Hook for Cash Flow Pulse (Zone A)
export const useCashFlowPulse = () => {
  const { tenant } = useTenantAdminAuth();
  
  return useQuery({
    queryKey: queryKeys.financialCommandCenter.cashFlowPulse(tenant?.id),
    queryFn: async (): Promise<CashFlowData> => {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);
      const weekStart = startOfWeek(today);
      const weekEnd = endOfWeek(today);
      
      if (!tenant?.id) throw new Error('No tenant');

      // Parallel fetch
      const [
        todayPaymentsResult,
        todayOrdersResult,
        weekOrdersResult,
        last30DaysOrdersResult
      ] = await Promise.all([
        // Today's incoming payments
        supabase
          .from('wholesale_payments')
          .select('amount, created_at')
          .eq('tenant_id', tenant.id)
          .gte('created_at', startOfToday.toISOString())
          .lte('created_at', endOfToday.toISOString()),

        // Today's orders (outgoing product) - only count completed/delivered for revenue
        supabase
          .from('wholesale_orders')
          .select('total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .gte('created_at', startOfToday.toISOString())
          .lte('created_at', endOfToday.toISOString())
          .in('status', ['completed', 'delivered']),

        // This week's orders (for forecast) - only count completed/delivered
        supabase
          .from('wholesale_orders')
          .select('total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString())
          .in('status', ['completed', 'delivered']),

        // Last 30 days for burn rate calculation - only count completed/delivered
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', subDays(today, 30).toISOString())
          .in('status', ['completed', 'delivered'])
      ]);
      
      const todayIn = todayPaymentsResult.data?.reduce((sum, p) => sum + Number(p.amount || 0), 0) ?? 0;
      const todayOrdersTotal = todayOrdersResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      const todayOut = todayOrdersTotal * 0.62; // COGS estimate
      const todayNet = todayIn - todayOut;
      
      // Calculate weekly forecast
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weeklyForecast: WeekDay[] = [];
      
      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const isPast = date < startOfToday;
        const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        
        // Get actual amount for past days
        let amount = 0;
        if (isPast || isToday) {
          const dayOrders = weekOrdersResult.data?.filter(o => {
            const orderDate = new Date(o.created_at);
            return format(orderDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
          }) ?? [];
          amount = dayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        }
        
        weeklyForecast.push({
          day: daysOfWeek[i],
          date,
          amount,
          isPast,
          isToday
        });
      }
      
      // Cash runway calculation
      const last30DaysTotal = last30DaysOrdersResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      const avgDailyBurn = (last30DaysTotal * 0.62) / 30; // COGS per day
      const availableCash = todayIn + 45000; // Placeholder - would need actual cash balance
      const daysRemaining = avgDailyBurn > 0 ? Math.floor(availableCash / avgDailyBurn) : 999;
      
      return {
        todayIn,
        todayOut,
        todayNet,
        paymentsReceived: todayPaymentsResult.data?.length ?? 0,
        payoutsProcessed: todayOrdersResult.data?.length ?? 0,
        weeklyForecast,
        expectedCollections: todayIn * 5, // Estimate
        scheduledPayouts: todayOut * 5,
        projectedNet: (todayIn - todayOut) * 5,
        cashRunway: {
          availableCash,
          avgDailyBurn,
          daysRemaining,
          isHealthy: daysRemaining >= 30
        }
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000
  });
};

// Hook for AR Command (Zone B)
export const useARCommand = () => {
  const { tenant } = useTenantAdminAuth();
  
  return useQuery({
    queryKey: queryKeys.financialCommandCenter.arCommand(tenant?.id),
    queryFn: async (): Promise<ARData> => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data: clients, error } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, outstanding_balance, last_payment_date, payment_terms, phone, email')
        .eq('tenant_id', tenant.id)
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false });
      
      if (error) throw error;
      
      const totalOutstanding = clients?.reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0) ?? 0;
      
      // Categorize clients by urgency
      const now = new Date();
      const categorized = (clients ?? []).map(c => {
        const amount = Number(c.outstanding_balance || 0);
        const daysSincePayment = c.last_payment_date 
          ? differenceInDays(now, new Date(c.last_payment_date))
          : 999;
        const isOverdue = daysSincePayment > (c.payment_terms || 30);
        
        return {
          id: c.id,
          name: c.business_name || 'Unknown',
          amount,
          daysOverdue: isOverdue ? daysSincePayment - (c.payment_terms || 30) : 0,
          lastContact: c.last_payment_date ? new Date(c.last_payment_date) : undefined,
          paidPercentage: 0,
          phone: c.phone,
          email: c.email,
          isOverdue,
          isDueThisWeek: !isOverdue && daysSincePayment > (c.payment_terms || 30) - 7
        };
      });
      
      const overdueClients = categorized.filter(c => c.isOverdue);
      const dueThisWeekClients = categorized.filter(c => c.isDueThisWeek);
      const upcomingClients = categorized.filter(c => !c.isOverdue && !c.isDueThisWeek);
      
      return {
        totalOutstanding,
        overdue: overdueClients.reduce((sum, c) => sum + c.amount, 0),
        overdueCount: overdueClients.length,
        dueThisWeek: dueThisWeekClients.reduce((sum, c) => sum + c.amount, 0),
        dueThisWeekCount: dueThisWeekClients.length,
        upcoming: upcomingClients.reduce((sum, c) => sum + c.amount, 0),
        upcomingCount: upcomingClients.length,
        priorityClients: overdueClients.slice(0, 4),
        allClients: categorized
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000
  });
};

// Hook for Fronted Inventory (Zone C)
export const useFrontedInventory = () => {
  const { tenant } = useTenantAdminAuth();
  
  return useQuery({
    queryKey: queryKeys.financialCommandCenter.frontedInventory(tenant?.id),
    queryFn: async (): Promise<FrontedData> => {
      const now = new Date();
      
      if (!tenant?.id) throw new Error('No tenant');

      const { data: items, error } = await supabase
        .from('fronted_inventory')
        .select(`
          id,
          fronted_to_customer_name,
          dispatched_at,
          payment_due_date,
          expected_revenue,
          quantity_fronted,
          status,
          product:products(name)
        `)
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('dispatched_at', { ascending: true });
      
      if (error) throw error;
      
      const frontedItems: FrontedItem[] = (items ?? []).map(item => {
        const daysOut = differenceInDays(now, new Date(item.dispatched_at));
        let status: 'healthy' | 'warning' | 'overdue' = 'healthy';
        
        if (daysOut > 14) status = 'overdue';
        else if (daysOut > 7) status = 'warning';
        
        return {
          id: item.id,
          clientName: item.fronted_to_customer_name || 'Unknown',
          products: [{
            name: (item.product as { name?: string })?.name || 'Unknown Product',
            quantity: item.quantity_fronted ?? 0,
            unitPrice: (item.expected_revenue ?? 0) / (item.quantity_fronted || 1)
          }],
          totalValue: item.expected_revenue ?? 0,
          daysOut,
          expectedReturn: new Date(item.payment_due_date),
          status
        };
      });
      
      // Calculate aging breakdown
      const healthy = frontedItems.filter(i => i.status === 'healthy');
      const warning = frontedItems.filter(i => i.status === 'warning');
      const overdue = frontedItems.filter(i => i.status === 'overdue');
      
      const totalValue = frontedItems.reduce((sum, i) => sum + i.totalValue, 0);
      const totalUnits = frontedItems.reduce((sum, i) => 
        sum + i.products.reduce((s, p) => s + p.quantity, 0), 0
      );
      const avgDaysOut = frontedItems.length > 0 
        ? Math.round(frontedItems.reduce((sum, i) => sum + i.daysOut, 0) / frontedItems.length)
        : 0;
      
      // Health score: 100 if no overdue, decreases with overdue percentage
      const overduePercentage = totalValue > 0 
        ? (overdue.reduce((sum, i) => sum + i.totalValue, 0) / totalValue) * 100
        : 0;
      const healthScore = Math.max(0, 100 - overduePercentage * 2);
      
      return {
        totalValue,
        totalUnits,
        avgDaysOut,
        activeConsignments: frontedItems.length,
        aging: {
          healthy: {
            units: healthy.reduce((sum, i) => sum + i.products.reduce((s, p) => s + p.quantity, 0), 0),
            value: healthy.reduce((sum, i) => sum + i.totalValue, 0)
          },
          warning: {
            units: warning.reduce((sum, i) => sum + i.products.reduce((s, p) => s + p.quantity, 0), 0),
            value: warning.reduce((sum, i) => sum + i.totalValue, 0)
          },
          overdue: {
            units: overdue.reduce((sum, i) => sum + i.products.reduce((s, p) => s + p.quantity, 0), 0),
            value: overdue.reduce((sum, i) => sum + i.totalValue, 0)
          }
        },
        items: frontedItems,
        healthScore
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000
  });
};

// Hook for Performance Pulse (Zone D)
export const usePerformancePulse = () => {
  const { tenant } = useTenantAdminAuth();
  
  return useQuery({
    queryKey: queryKeys.financialCommandCenter.performancePulse(tenant?.id),
    queryFn: async (): Promise<PerformanceData> => {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      
      if (!tenant?.id) throw new Error('No tenant');

      // Parallel fetch - only count completed/delivered orders for revenue
      const [thisMonthResult, lastMonthResult, clientsResult, trendResult] = await Promise.all([
        // This month orders - only completed/delivered
        supabase
          .from('wholesale_orders')
          .select('total_amount, client_id')
          .eq('tenant_id', tenant.id)
          .gte('created_at', thisMonthStart.toISOString())
          .lte('created_at', thisMonthEnd.toISOString())
          .in('status', ['completed', 'delivered']),

        // Last month orders - only completed/delivered
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', lastMonthStart.toISOString())
          .lte('created_at', lastMonthEnd.toISOString())
          .in('status', ['completed', 'delivered']),

        // Client names for top clients
        supabase
          .from('wholesale_clients')
          .select('id, business_name')
          .eq('tenant_id', tenant.id),

        // Last 90 days for trend - only completed/delivered
        supabase
          .from('wholesale_orders')
          .select('total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .gte('created_at', subDays(now, 90).toISOString())
          .in('status', ['completed', 'delivered'])
      ]);
      
      // Calculate this month metrics
      const thisMonthRevenue = thisMonthResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      const thisMonthCost = thisMonthRevenue * 0.635;
      const thisMonthProfit = thisMonthRevenue - thisMonthCost;
      const thisMonthMargin = thisMonthRevenue > 0 ? (thisMonthProfit / thisMonthRevenue) * 100 : 0;
      const thisMonthDeals = thisMonthResult.data?.length ?? 0;
      
      // Calculate last month metrics
      const lastMonthRevenue = lastMonthResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      const lastMonthCost = lastMonthRevenue * 0.635;
      const lastMonthProfit = lastMonthRevenue - lastMonthCost;
      const lastMonthMargin = lastMonthRevenue > 0 ? (lastMonthProfit / lastMonthRevenue) * 100 : 0;
      const lastMonthDeals = lastMonthResult.data?.length ?? 0;
      
      // Calculate changes
      const revenueChange = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;
      const costChange = lastMonthCost > 0 
        ? ((thisMonthCost - lastMonthCost) / lastMonthCost) * 100 
        : 0;
      const profitChange = lastMonthProfit > 0 
        ? ((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 100 
        : 0;
      const marginChange = thisMonthMargin - lastMonthMargin;
      const dealsChange = lastMonthDeals > 0 
        ? ((thisMonthDeals - lastMonthDeals) / lastMonthDeals) * 100 
        : 0;
      
      // Top clients calculation
      const clientMap = new Map(clientsResult.data?.map(c => [c.id, c.business_name]) ?? []);
      const clientRevenue: Record<string, number> = {};
      
      thisMonthResult.data?.forEach(order => {
        const clientId = order.client_id;
        if (clientId) {
          clientRevenue[clientId] = (clientRevenue[clientId] ?? 0) + Number(order.total_amount || 0);
        }
      });
      
      const topClients = Object.entries(clientRevenue)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([clientId, revenue]) => ({
          name: String(clientMap.get(clientId) || 'Unknown'),
          revenue,
          percentage: thisMonthRevenue > 0 ? (revenue / thisMonthRevenue) * 100 : 0
        }));
      
      // Margin trend (weekly for 90 days)
      const marginTrend: { date: string; margin: number }[] = [];
      const trendOrders = trendResult.data ?? [];
      
      for (let i = 12; i >= 0; i--) {
        const weekStart = subDays(now, i * 7);
        const weekEnd = subDays(now, (i - 1) * 7);
        
        const weekOrders = trendOrders.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= weekStart && orderDate < weekEnd;
        });
        
        const weekRevenue = weekOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        const weekCost = weekRevenue * 0.635;
        const weekMargin = weekRevenue > 0 ? ((weekRevenue - weekCost) / weekRevenue) * 100 : 0;
        
        marginTrend.push({
          date: format(weekStart, 'MMM d'),
          margin: Math.round(weekMargin * 10) / 10
        });
      }
      
      return {
        thisMonth: {
          revenue: thisMonthRevenue,
          cost: thisMonthCost,
          profit: thisMonthProfit,
          margin: Math.round(thisMonthMargin * 10) / 10,
          deals: thisMonthDeals,
          avgDealSize: thisMonthDeals > 0 ? Math.round(thisMonthRevenue / thisMonthDeals) : 0
        },
        lastMonth: {
          revenue: lastMonthRevenue,
          cost: lastMonthCost,
          profit: lastMonthProfit,
          margin: Math.round(lastMonthMargin * 10) / 10,
          deals: lastMonthDeals,
          avgDealSize: lastMonthDeals > 0 ? Math.round(lastMonthRevenue / lastMonthDeals) : 0
        },
        changes: {
          revenue: Math.round(revenueChange * 10) / 10,
          cost: Math.round(costChange * 10) / 10,
          profit: Math.round(profitChange * 10) / 10,
          margin: Math.round(marginChange * 10) / 10,
          deals: Math.round(dealsChange * 10) / 10
        },
        topClients,
        marginTrend
      };
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000 // 5 minutes for performance data
  });
};

// Collection actions
export const useCollectionActions = () => {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const logActivity = useMutation({
    mutationFn: async (data: {
      clientId: string;
      type: 'call' | 'text' | 'invoice' | 'reminder';
      notes?: string;
    }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data: result, error } = await supabase
        .from('collection_activities')
        .insert({
          client_id: data.clientId,
          activity_type: data.type,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.arCommand(tenant?.id) });
      showSuccessToast('Activity Logged', 'Collection activity recorded');
    },
    onError: (error) => {
      showErrorToast('Error', error instanceof Error ? error.message : 'Failed to log activity');
    }
  });
  
  const sendReminder = useMutation({
    mutationFn: async (clientId: string) => {
      // Would integrate with notification system
      return logActivity.mutateAsync({ clientId, type: 'reminder' });
    }
  });
  
  const sendAllReminders = useMutation({
    mutationFn: async (clientIds: string[]) => {
      await Promise.all(clientIds.map(id => 
        logActivity.mutateAsync({ clientId: id, type: 'reminder' })
      ));
    },
    onSuccess: () => {
      showSuccessToast('Reminders Sent', 'All collection reminders have been sent');
    }
  });
  
  return {
    logActivity,
    sendReminder,
    sendAllReminders
  };
};

// Fronted inventory actions
export const useFrontedActions = () => {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const convertToSale = useMutation({
    mutationFn: async (frontedId: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('fronted_inventory')
        .update({ status: 'sold' })
        .eq('id', frontedId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.frontedInventory(tenant?.id) });
      showSuccessToast('Converted', 'Fronted inventory converted to sale');
    }
  });
  
  const recallInventory = useMutation({
    mutationFn: async (frontedId: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('fronted_inventory')
        .update({ status: 'recalled' })
        .eq('id', frontedId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.frontedInventory(tenant?.id) });
      showSuccessToast('Recalled', 'Inventory has been recalled');
    }
  });
  
  const extendDueDate = useMutation({
    mutationFn: async ({ frontedId, newDate }: { frontedId: string; newDate: Date }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('fronted_inventory')
        .update({ payment_due_date: newDate.toISOString() })
        .eq('id', frontedId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.frontedInventory(tenant?.id) });
      showSuccessToast('Extended', 'Due date has been extended');
    }
  });
  
  return {
    convertToSale,
    recallInventory,
    extendDueDate
  };
};

/**
 * Hook to subscribe to order status changes (especially completed/delivered)
 * Invalidates all financial queries when order status changes to completed/delivered
 */
export const useOrderStatusSubscription = () => {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel('financial-order-status-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wholesale_orders',
          filter: `tenant_id=eq.${tenant.id}`
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string })?.status;
          const oldStatus = (payload.old as { status?: string })?.status;

          // Invalidate financial queries when order status changes to/from completed/delivered
          // This ensures revenue dashboards update in real-time
          if (
            newStatus === 'completed' ||
            newStatus === 'delivered' ||
            oldStatus === 'completed' ||
            oldStatus === 'delivered'
          ) {
            logger.debug('Order completed/delivered - invalidating financial queries', {
              component: 'useOrderStatusSubscription',
              newStatus,
              oldStatus
            });

            // Invalidate all financial command center queries
            queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.quickStats(tenant?.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.cashFlowPulse(tenant?.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.performancePulse(tenant?.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.revenueReports() });
            queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.revenueChart() });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Order status subscription error', { status, component: 'useOrderStatusSubscription' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, queryClient]);
};

// Combined hook for all data
export const useFinancialCommandCenter = () => {
  const quickStats = useQuickStats();
  const cashFlow = useCashFlowPulse();
  const ar = useARCommand();
  const fronted = useFrontedInventory();
  const performance = usePerformancePulse();
  const collectionActions = useCollectionActions();
  const frontedActions = useFrontedActions();

  // Subscribe to order status changes to update revenue when orders complete
  useOrderStatusSubscription();

  return {
    quickStats,
    cashFlow,
    ar,
    fronted,
    performance,
    actions: {
      collection: collectionActions,
      fronted: frontedActions
    },
    isLoading: quickStats.isLoading || cashFlow.isLoading || ar.isLoading || fronted.isLoading || performance.isLoading
  };
};

