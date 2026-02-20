/**
 * Vendor Payment Terms Hook
 *
 * Manages payment terms per vendor (net 15/30/60, COD, prepaid).
 * Features:
 * - Store payment terms configuration
 * - Auto-calculate payment due dates
 * - Track overdue payments
 * - Payment term compliance tracking
 * - Alerts for approaching due dates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export type PaymentTermType =
  | 'cod'
  | 'prepaid'
  | 'net_7'
  | 'net_15'
  | 'net_30'
  | 'net_45'
  | 'net_60'
  | 'net_90'
  | 'custom';

export interface VendorPaymentTerms {
  id: string;
  tenant_id: string;
  vendor_id: string;
  payment_term_type: PaymentTermType;
  custom_days: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayablePO {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  total: number;
  paid_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_due_date: string | null;
  order_date: string | null;
  created_at: string;
  days_overdue: number;
  days_until_due: number;
  outstanding_balance: number;
}

export interface AgingBucket {
  label: string;
  range: string;
  minDays: number;
  maxDays: number;
  count: number;
  total: number;
  pos: PayablePO[];
}

export interface PayablesAgingSummary {
  current: AgingBucket;
  days_1_30: AgingBucket;
  days_31_60: AgingBucket;
  days_61_90: AgingBucket;
  days_over_90: AgingBucket;
  total_outstanding: number;
  total_overdue: number;
  total_count: number;
  overdue_count: number;
}

export interface CreatePaymentTermsInput {
  vendor_id: string;
  payment_term_type: PaymentTermType;
  custom_days?: number;
  notes?: string;
}

export interface UpdatePaymentTermsInput {
  id: string;
  payment_term_type?: PaymentTermType;
  custom_days?: number | null;
  notes?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const PAYMENT_TERM_LABELS: Record<PaymentTermType, string> = {
  cod: 'COD (Cash on Delivery)',
  prepaid: 'Prepaid',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
  net_90: 'Net 90',
  custom: 'Custom',
};

export const PAYMENT_TERM_OPTIONS = Object.entries(PAYMENT_TERM_LABELS).map(
  ([value, label]) => ({
    value: value as PaymentTermType,
    label,
  })
);

export const PAYMENT_TERM_DAYS: Record<PaymentTermType, number> = {
  cod: 0,
  prepaid: 0,
  net_7: 7,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
  net_90: 90,
  custom: 30,
};

export const PAYMENT_DUE_WARNING_DAYS = 7;
export const PAYMENT_OVERDUE_THRESHOLD = 0;

// ============================================================================
// Helper Functions
// ============================================================================

export function getPaymentTermDays(
  termType: PaymentTermType,
  customDays?: number | null
): number {
  if (termType === 'custom' && customDays) {
    return customDays;
  }
  return PAYMENT_TERM_DAYS[termType] ?? 30;
}

export function calculateDueDate(
  orderDate: string | Date,
  termType: PaymentTermType,
  customDays?: number | null
): Date {
  const baseDate = new Date(orderDate);
  const days = getPaymentTermDays(termType, customDays);
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate;
}

export function getDaysUntilDue(dueDate: string | Date | null): number {
  if (!dueDate) return Infinity;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDaysOverdue(dueDate: string | Date | null): number {
  const daysUntil = getDaysUntilDue(dueDate);
  return daysUntil < 0 ? Math.abs(daysUntil) : 0;
}

export function isPaymentOverdue(dueDate: string | Date | null): boolean {
  return getDaysUntilDue(dueDate) < PAYMENT_OVERDUE_THRESHOLD;
}

export function isPaymentDueSoon(dueDate: string | Date | null): boolean {
  const daysUntil = getDaysUntilDue(dueDate);
  return daysUntil >= 0 && daysUntil <= PAYMENT_DUE_WARNING_DAYS;
}

export function getPaymentUrgency(
  dueDate: string | Date | null
): 'overdue' | 'due_soon' | 'ok' {
  if (isPaymentOverdue(dueDate)) return 'overdue';
  if (isPaymentDueSoon(dueDate)) return 'due_soon';
  return 'ok';
}

// ============================================================================
// Hook: useVendorPaymentTerms
// ============================================================================

export function useVendorPaymentTerms(vendorId: string) {
  const { tenant, admin: user } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch payment terms for a vendor
  const termsQuery = useQuery({
    queryKey: [...queryKeys.vendors.detail(tenantId || '', vendorId), 'payment-terms'],
    queryFn: async (): Promise<VendorPaymentTerms | null> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await (supabase as any)
        .from('vendor_payment_terms')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch vendor payment terms', error, {
          component: 'useVendorPaymentTerms',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return data as VendorPaymentTerms | null;
    },
    enabled: !!tenantId && !!vendorId,
  });

  // Upsert (create or update) payment terms
  const upsertTermsMutation = useMutation({
    mutationFn: async (
      input: CreatePaymentTermsInput
    ): Promise<VendorPaymentTerms> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await (supabase as any)
        .from('vendor_payment_terms')
        .upsert(
          {
            tenant_id: tenantId,
            vendor_id: input.vendor_id,
            payment_term_type: input.payment_term_type,
            custom_days: input.payment_term_type === 'custom' ? input.custom_days : null,
            notes: input.notes ?? null,
            created_by: user?.id ?? null,
          },
          {
            onConflict: 'tenant_id,vendor_id',
          }
        )
        .select()
        .single();

      if (error) {
        logger.error('Failed to upsert vendor payment terms', error, {
          component: 'useVendorPaymentTerms',
          tenantId,
          vendorId: input.vendor_id,
        });
        throw error;
      }

      return data as VendorPaymentTerms;
    },
    onSuccess: () => {
      toast.success('Payment terms saved successfully');
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vendors.detail(tenantId || '', vendorId), 'payment-terms'],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to save payment terms'));
    },
  });

  // Update payment terms
  const updateTermsMutation = useMutation({
    mutationFn: async (
      input: UpdatePaymentTermsInput
    ): Promise<VendorPaymentTerms> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const updateData: Record<string, unknown> = {};

      if (input.payment_term_type !== undefined) {
        updateData.payment_term_type = input.payment_term_type;
        updateData.custom_days =
          input.payment_term_type === 'custom' ? input.custom_days : null;
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      const { data, error } = await (supabase as any)
        .from('vendor_payment_terms')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update vendor payment terms', error, {
          component: 'useVendorPaymentTerms',
          tenantId,
          termsId: input.id,
        });
        throw error;
      }

      return data as VendorPaymentTerms;
    },
    onSuccess: () => {
      toast.success('Payment terms updated successfully');
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vendors.detail(tenantId || '', vendorId), 'payment-terms'],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to update payment terms'));
    },
  });

  // Delete payment terms
  const deleteTermsMutation = useMutation({
    mutationFn: async (termsId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { error } = await (supabase as any)
        .from('vendor_payment_terms')
        .delete()
        .eq('id', termsId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete vendor payment terms', error, {
          component: 'useVendorPaymentTerms',
          tenantId,
          termsId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Payment terms deleted successfully');
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vendors.detail(tenantId || '', vendorId), 'payment-terms'],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to delete payment terms'));
    },
  });

  // Helper to get display label
  const getTermsLabel = (terms: VendorPaymentTerms | null): string => {
    if (!terms) return 'Net 30 (Default)';
    if (terms.payment_term_type === 'custom' && terms.custom_days) {
      return `Net ${terms.custom_days}`;
    }
    return PAYMENT_TERM_LABELS[terms.payment_term_type] ?? 'Net 30';
  };

  return {
    // Query data
    paymentTerms: termsQuery.data,
    termsLabel: getTermsLabel(termsQuery.data ?? null),
    isLoading: termsQuery.isLoading,
    isError: termsQuery.isError,
    error: termsQuery.error,

    // Mutations
    upsertTerms: upsertTermsMutation.mutateAsync,
    updateTerms: updateTermsMutation.mutateAsync,
    deleteTerms: deleteTermsMutation.mutateAsync,

    // Mutation states
    isUpserting: upsertTermsMutation.isPending,
    isUpdating: updateTermsMutation.isPending,
    isDeleting: deleteTermsMutation.isPending,
  };
}

// ============================================================================
// Hook: usePayablesAging
// ============================================================================

export function usePayablesAging(vendorId?: string) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: vendorId
      ? [...queryKeys.vendors.detail(tenantId || '', vendorId), 'payables-aging']
      : [...queryKeys.vendors.payables(tenantId), 'aging'],
    queryFn: async (): Promise<PayablesAgingSummary> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      let query = (supabase as any)
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          vendor_id,
          total,
          paid_amount,
          payment_status,
          payment_due_date,
          order_date,
          created_at,
          vendors!inner (
            name
          )
        `)
        .eq('account_id', tenantId)
        .in('payment_status', ['unpaid', 'partial']);

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error } = await query.order('payment_due_date', { ascending: true });

      if (error) {
        logger.error('Failed to fetch payables aging', error, {
          component: 'usePayablesAging',
          tenantId,
          vendorId,
        });
        throw error;
      }

      // Build aging buckets
      const buckets: PayablesAgingSummary = {
        current: { label: 'Current', range: 'Not Due', minDays: -Infinity, maxDays: 0, count: 0, total: 0, pos: [] },
        days_1_30: { label: '1-30 Days', range: '1-30', minDays: 1, maxDays: 30, count: 0, total: 0, pos: [] },
        days_31_60: { label: '31-60 Days', range: '31-60', minDays: 31, maxDays: 60, count: 0, total: 0, pos: [] },
        days_61_90: { label: '61-90 Days', range: '61-90', minDays: 61, maxDays: 90, count: 0, total: 0, pos: [] },
        days_over_90: { label: '90+ Days', range: '90+', minDays: 91, maxDays: Infinity, count: 0, total: 0, pos: [] },
        total_outstanding: 0,
        total_overdue: 0,
        total_count: 0,
        overdue_count: 0,
      };

      (data ?? []).forEach((po) => {
        const vendorData = po.vendors as { name: string } | null;
        const outstanding = (po.total ?? 0) - (po.paid_amount ?? 0);
        const daysOverdue = getDaysOverdue(po.payment_due_date);
        const daysUntilDue = getDaysUntilDue(po.payment_due_date);

        const payablePO: PayablePO = {
          id: po.id,
          po_number: po.po_number,
          vendor_id: po.vendor_id,
          vendor_name: vendorData?.name ?? 'Unknown',
          total: po.total ?? 0,
          paid_amount: po.paid_amount ?? 0,
          payment_status: po.payment_status as 'unpaid' | 'partial' | 'paid',
          payment_due_date: po.payment_due_date,
          order_date: po.order_date,
          created_at: po.created_at,
          days_overdue: daysOverdue,
          days_until_due: daysUntilDue,
          outstanding_balance: outstanding,
        };

        buckets.total_outstanding += outstanding;
        buckets.total_count += 1;

        if (daysOverdue === 0) {
          buckets.current.count += 1;
          buckets.current.total += outstanding;
          buckets.current.pos.push(payablePO);
        } else if (daysOverdue <= 30) {
          buckets.days_1_30.count += 1;
          buckets.days_1_30.total += outstanding;
          buckets.days_1_30.pos.push(payablePO);
          buckets.total_overdue += outstanding;
          buckets.overdue_count += 1;
        } else if (daysOverdue <= 60) {
          buckets.days_31_60.count += 1;
          buckets.days_31_60.total += outstanding;
          buckets.days_31_60.pos.push(payablePO);
          buckets.total_overdue += outstanding;
          buckets.overdue_count += 1;
        } else if (daysOverdue <= 90) {
          buckets.days_61_90.count += 1;
          buckets.days_61_90.total += outstanding;
          buckets.days_61_90.pos.push(payablePO);
          buckets.total_overdue += outstanding;
          buckets.overdue_count += 1;
        } else {
          buckets.days_over_90.count += 1;
          buckets.days_over_90.total += outstanding;
          buckets.days_over_90.pos.push(payablePO);
          buckets.total_overdue += outstanding;
          buckets.overdue_count += 1;
        }
      });

      return buckets;
    },
    enabled: !!tenantId,
  });
}

// ============================================================================
// Hook: useUpcomingPayments
// ============================================================================

export function useUpcomingPayments(daysAhead: number = 7) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: [...queryKeys.vendors.payables(tenantId), 'upcoming', daysAhead],
    queryFn: async (): Promise<PayablePO[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);

      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          vendor_id,
          total,
          paid_amount,
          payment_status,
          payment_due_date,
          order_date,
          created_at,
          vendors!inner (
            name
          )
        `)
        .eq('account_id', tenantId)
        .in('payment_status', ['unpaid', 'partial'])
        .gte('payment_due_date', today.toISOString().split('T')[0])
        .lte('payment_due_date', futureDate.toISOString().split('T')[0])
        .order('payment_due_date', { ascending: true });

      if (error) {
        logger.error('Failed to fetch upcoming payments', error, {
          component: 'useUpcomingPayments',
          tenantId,
        });
        throw error;
      }

      return (data ?? []).map((po) => {
        const vendorData = po.vendors as { name: string } | null;
        const outstanding = (po.total ?? 0) - (po.paid_amount ?? 0);
        const daysOverdue = getDaysOverdue(po.payment_due_date);
        const daysUntilDue = getDaysUntilDue(po.payment_due_date);

        return {
          id: po.id,
          po_number: po.po_number,
          vendor_id: po.vendor_id,
          vendor_name: vendorData?.name ?? 'Unknown',
          total: po.total ?? 0,
          paid_amount: po.paid_amount ?? 0,
          payment_status: po.payment_status as 'unpaid' | 'partial' | 'paid',
          payment_due_date: po.payment_due_date,
          order_date: po.order_date,
          created_at: po.created_at,
          days_overdue: daysOverdue,
          days_until_due: daysUntilDue,
          outstanding_balance: outstanding,
        };
      });
    },
    enabled: !!tenantId,
  });
}

// ============================================================================
// Hook: useOverduePayments
// ============================================================================

export function useOverduePayments() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: [...queryKeys.vendors.payables(tenantId), 'overdue'],
    queryFn: async (): Promise<PayablePO[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          vendor_id,
          total,
          paid_amount,
          payment_status,
          payment_due_date,
          order_date,
          created_at,
          vendors!inner (
            name
          )
        `)
        .eq('account_id', tenantId)
        .in('payment_status', ['unpaid', 'partial'])
        .lt('payment_due_date', today)
        .order('payment_due_date', { ascending: true });

      if (error) {
        logger.error('Failed to fetch overdue payments', error, {
          component: 'useOverduePayments',
          tenantId,
        });
        throw error;
      }

      return (data ?? []).map((po) => {
        const vendorData = po.vendors as { name: string } | null;
        const outstanding = (po.total ?? 0) - (po.paid_amount ?? 0);
        const daysOverdue = getDaysOverdue(po.payment_due_date);
        const daysUntilDue = getDaysUntilDue(po.payment_due_date);

        return {
          id: po.id,
          po_number: po.po_number,
          vendor_id: po.vendor_id,
          vendor_name: vendorData?.name ?? 'Unknown',
          total: po.total ?? 0,
          paid_amount: po.paid_amount ?? 0,
          payment_status: po.payment_status as 'unpaid' | 'partial' | 'paid',
          payment_due_date: po.payment_due_date,
          order_date: po.order_date,
          created_at: po.created_at,
          days_overdue: daysOverdue,
          days_until_due: daysUntilDue,
          outstanding_balance: outstanding,
        };
      });
    },
    enabled: !!tenantId,
  });
}
