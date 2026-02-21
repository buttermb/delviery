/**
 * Delivery Compliance Hook
 * Manages compliance checks for cannabis delivery including age verification,
 * ID checks, zone validation, time restrictions, and quantity limits.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import type {
  DeliveryComplianceCheck,
  ComplianceCheckType,
  ComplianceCheckStatus,
  CreateComplianceCheckInput,
  VerifyComplianceCheckInput,
  OverrideComplianceCheckInput,
  CanCompleteDeliveryResult,
  ComplianceAuditLogEntry,
  AgeVerificationData,
  IdOnFileData,
  LicensedZoneData,
  TimeRestrictionData,
  QuantityLimitData,
  CustomerStatusData,
  ComplianceSettings,
} from '@/types/delivery-compliance';
import { DEFAULT_COMPLIANCE_SETTINGS } from '@/types/delivery-compliance';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';

const COMPLIANCE_QUERY_KEY = 'delivery-compliance';

/**
 * Hook for managing delivery compliance checks
 */
export function useDeliveryCompliance(orderId?: string, deliveryId?: string) {
  const { tenantId, userId } = useTenantContext();
  const queryClient = useQueryClient();

  // Fetch compliance checks for an order/delivery
  const {
    data: complianceChecks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [COMPLIANCE_QUERY_KEY, tenantId, orderId, deliveryId],
    queryFn: async () => {
      if (!tenantId || !orderId) return [];

      let query = (supabase as any)
        .from('delivery_compliance_checks')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (deliveryId) {
        query = (query as any).eq('delivery_id', deliveryId);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01') {
          logger.debug('delivery_compliance_checks table does not exist yet', {
            component: 'useDeliveryCompliance',
          });
          return [];
        }
        logger.error('Failed to fetch compliance checks', error, {
          component: 'useDeliveryCompliance',
        });
        throw error;
      }

      return (data || []) as DeliveryComplianceCheck[];
    },
    enabled: !!tenantId && !!orderId,
    staleTime: 30000,
  });

  // Check if delivery can be completed
  const canCompleteQuery = useQuery({
    queryKey: [COMPLIANCE_QUERY_KEY, 'can-complete', tenantId, orderId],
    queryFn: async (): Promise<CanCompleteDeliveryResult> => {
      if (!tenantId || !orderId) {
        return { can_complete: false, blocking_checks: [], all_passed: false };
      }

      const { data, error } = await (supabase as any).rpc('can_complete_delivery', {
        p_tenant_id: tenantId,
        p_order_id: orderId,
      });

      if (error) {
        if (error.code === '42883') {
          // Function doesn't exist yet
          logger.debug('can_complete_delivery function does not exist yet', {
            component: 'useDeliveryCompliance',
          });
          return { can_complete: true, blocking_checks: [], all_passed: true };
        }
        logger.error('Failed to check if delivery can be completed', error, {
          component: 'useDeliveryCompliance',
        });
        throw error;
      }

      if (data && (data as any).length > 0) {
        return (data as any)[0] as CanCompleteDeliveryResult;
      }

      return { can_complete: true, blocking_checks: [], all_passed: true };
    },
    enabled: !!tenantId && !!orderId,
    staleTime: 10000,
  });

  // Create compliance check mutation
  const createCheckMutation = useMutation({
    mutationFn: async (input: CreateComplianceCheckInput) => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await (supabase as any)
        .from('delivery_compliance_checks')
        .insert({
          tenant_id: tenantId,
          delivery_id: input.delivery_id || deliveryId,
          order_id: input.order_id,
          customer_id: input.customer_id,
          courier_id: input.courier_id || userId,
          check_type: input.check_type,
          status: 'pending',
          check_data: input.check_data || {},
          blocks_delivery: input.blocks_delivery ?? true,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create compliance check', error, {
          component: 'useDeliveryCompliance',
        });
        throw error;
      }

      return data as DeliveryComplianceCheck;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [COMPLIANCE_QUERY_KEY, tenantId, orderId],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to create compliance check'));
    },
  });

  // Verify compliance check mutation
  const verifyCheckMutation = useMutation({
    mutationFn: async (input: VerifyComplianceCheckInput) => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await (supabase as any)
        .from('delivery_compliance_checks')
        .update({
          status: input.status,
          verification_method: input.verification_method,
          verification_notes: input.verification_notes,
          verified_by: userId,
          verified_at: new Date().toISOString(),
          failure_reason: input.failure_reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.check_id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to verify compliance check', error, {
          component: 'useDeliveryCompliance',
        });
        throw error;
      }

      return data as DeliveryComplianceCheck;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [COMPLIANCE_QUERY_KEY, tenantId, orderId],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to verify compliance check'));
    },
  });

  // Override compliance check mutation
  const overrideCheckMutation = useMutation({
    mutationFn: async (input: OverrideComplianceCheckInput) => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await (supabase as any)
        .from('delivery_compliance_checks')
        .update({
          status: 'override' as ComplianceCheckStatus,
          override_reason: input.override_reason,
          overridden_by: userId,
          overridden_at: new Date().toISOString(),
          blocks_delivery: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.check_id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to override compliance check', error, {
          component: 'useDeliveryCompliance',
        });
        throw error;
      }

      logger.info('Compliance check overridden', {
        component: 'useDeliveryCompliance',
        checkId: input.check_id,
        reason: input.override_reason,
      });

      return data as DeliveryComplianceCheck;
    },
    onSuccess: () => {
      toast.success('Compliance check overridden');
      queryClient.invalidateQueries({
        queryKey: [COMPLIANCE_QUERY_KEY, tenantId, orderId],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to override compliance check'));
    },
  });

  // Batch create all compliance checks for an order
  const initializeComplianceChecksMutation = useMutation({
    mutationFn: async (params: {
      orderId: string;
      deliveryId?: string;
      customerId?: string;
      customerAge?: number;
      customerDob?: string;
      hasIdOnFile?: boolean;
      idExpiry?: string;
      deliveryLat?: number;
      deliveryLng?: number;
      zoneId?: string;
      zoneName?: string;
      productQuantities?: Record<string, number>;
      totalThcMg?: number;
      totalWeightG?: number;
      settings?: ComplianceSettings;
    }) => {
      if (!tenantId) throw new Error('No tenant context');

      const settings = params.settings || DEFAULT_COMPLIANCE_SETTINGS;
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      const dayOfWeek = format(now, 'EEEE');

      const checks: CreateComplianceCheckInput[] = [];

      // Age verification check
      const ageData: AgeVerificationData = {
        customer_age: params.customerAge,
        minimum_age: settings.minimum_age,
        customer_dob: params.customerDob,
      };
      checks.push({
        order_id: params.orderId,
        delivery_id: params.deliveryId,
        customer_id: params.customerId,
        check_type: 'age_verification',
        check_data: ageData,
        blocks_delivery: true,
      });

      // ID on file check
      if (settings.require_id_on_file) {
        const idData: IdOnFileData = {
          has_id_on_file: params.hasIdOnFile ?? false,
          id_expiry: params.idExpiry,
        };
        checks.push({
          order_id: params.orderId,
          delivery_id: params.deliveryId,
          customer_id: params.customerId,
          check_type: 'id_on_file',
          check_data: idData,
          blocks_delivery: true,
        });
      }

      // Licensed zone check
      if (settings.enforce_delivery_zones) {
        const zoneData: LicensedZoneData = {
          zone_id: params.zoneId,
          zone_name: params.zoneName,
          customer_lat: params.deliveryLat,
          customer_lng: params.deliveryLng,
          is_in_licensed_zone: !!params.zoneId,
        };
        checks.push({
          order_id: params.orderId,
          delivery_id: params.deliveryId,
          customer_id: params.customerId,
          check_type: 'licensed_zone',
          check_data: zoneData,
          blocks_delivery: true,
        });
      }

      // Time restriction check
      const timeData: TimeRestrictionData = {
        delivery_time: currentTime,
        allowed_start: settings.delivery_start_time,
        allowed_end: settings.delivery_end_time,
        day_of_week: dayOfWeek,
        is_within_hours:
          currentTime >= settings.delivery_start_time &&
          currentTime <= settings.delivery_end_time,
      };
      checks.push({
        order_id: params.orderId,
        delivery_id: params.deliveryId,
        customer_id: params.customerId,
        check_type: 'time_restriction',
        check_data: timeData,
        blocks_delivery: true,
      });

      // Quantity limit check
      const quantityData: QuantityLimitData = {
        product_quantities: params.productQuantities,
        total_thc_mg: params.totalThcMg,
        max_allowed_mg: settings.max_thc_mg_per_order,
        total_weight_g: params.totalWeightG,
        max_allowed_weight_g: settings.max_weight_g_per_order,
        exceeds_limit:
          (params.totalThcMg ?? 0) > settings.max_thc_mg_per_order ||
          (params.totalWeightG ?? 0) > settings.max_weight_g_per_order,
      };
      checks.push({
        order_id: params.orderId,
        delivery_id: params.deliveryId,
        customer_id: params.customerId,
        check_type: 'quantity_limit',
        check_data: quantityData,
        blocks_delivery: true,
      });

      // Customer status check
      if (settings.require_customer_verification) {
        const customerData: CustomerStatusData = {
          customer_status: 'active',
          is_active: true,
          is_verified: !!params.customerId,
          has_valid_account: !!params.customerId,
        };
        checks.push({
          order_id: params.orderId,
          delivery_id: params.deliveryId,
          customer_id: params.customerId,
          check_type: 'customer_status',
          check_data: customerData,
          blocks_delivery: false,
        });
      }

      // Insert all checks
      const { data, error } = await (supabase as any)
        .from('delivery_compliance_checks')
        .insert(
          checks.map((check) => ({
            tenant_id: tenantId,
            delivery_id: check.delivery_id,
            order_id: check.order_id,
            customer_id: check.customer_id,
            courier_id: userId,
            check_type: check.check_type,
            status: 'pending' as ComplianceCheckStatus,
            check_data: check.check_data || {},
            blocks_delivery: check.blocks_delivery ?? true,
          }))
        )
        .select();

      if (error) {
        logger.error('Failed to initialize compliance checks', error, {
          component: 'useDeliveryCompliance',
        });
        throw error;
      }

      logger.info('Compliance checks initialized', {
        component: 'useDeliveryCompliance',
        orderId: params.orderId,
        checkCount: checks.length,
      });

      return (data || []) as DeliveryComplianceCheck[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [COMPLIANCE_QUERY_KEY, tenantId, orderId],
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to initialize compliance checks'));
    },
  });

  // Auto-verify checks that can be verified by the system
  const autoVerifySystemChecks = useCallback(async () => {
    if (!tenantId || complianceChecks.length === 0) return;

    const pendingChecks = complianceChecks.filter(
      (check) => check.status === 'pending'
    );

    for (const check of pendingChecks) {
      let shouldPass = false;
      let failureReason: string | undefined;

      switch (check.check_type) {
        case 'age_verification': {
          const data = check.check_data as AgeVerificationData;
          if (data.customer_age && data.minimum_age) {
            shouldPass = data.customer_age >= data.minimum_age;
            if (!shouldPass) {
              failureReason = `Customer age (${data.customer_age}) is below minimum required age (${data.minimum_age})`;
            }
          } else {
            failureReason = 'Customer age not verified';
          }
          break;
        }
        case 'id_on_file': {
          const data = check.check_data as IdOnFileData;
          shouldPass = data.has_id_on_file;
          if (!shouldPass) {
            failureReason = 'Customer does not have a valid ID on file';
          }
          break;
        }
        case 'licensed_zone': {
          const data = check.check_data as LicensedZoneData;
          shouldPass = data.is_in_licensed_zone;
          if (!shouldPass) {
            failureReason = 'Delivery address is outside licensed delivery zones';
          }
          break;
        }
        case 'time_restriction': {
          const data = check.check_data as TimeRestrictionData;
          shouldPass = data.is_within_hours;
          if (!shouldPass) {
            failureReason = `Delivery time (${data.delivery_time}) is outside allowed hours (${data.allowed_start} - ${data.allowed_end})`;
          }
          break;
        }
        case 'quantity_limit': {
          const data = check.check_data as QuantityLimitData;
          shouldPass = !data.exceeds_limit;
          if (!shouldPass) {
            failureReason = `Order exceeds legal quantity limits (THC: ${data.total_thc_mg}mg / ${data.max_allowed_mg}mg, Weight: ${data.total_weight_g}g / ${data.max_allowed_weight_g}g)`;
          }
          break;
        }
        case 'customer_status': {
          const data = check.check_data as CustomerStatusData;
          shouldPass = data.is_active && data.has_valid_account;
          if (!shouldPass) {
            failureReason = 'Customer account is not active or verified';
          }
          break;
        }
      }

      await verifyCheckMutation.mutateAsync({
        check_id: check.id,
        status: shouldPass ? 'passed' : 'failed',
        verification_method: 'system',
        failure_reason: failureReason,
      });
    }
  }, [tenantId, complianceChecks, verifyCheckMutation]);

  // Computed values
  const passedChecks = useMemo(
    () => complianceChecks.filter((c) => c.status === 'passed' || c.status === 'override'),
    [complianceChecks]
  );

  const failedChecks = useMemo(
    () => complianceChecks.filter((c) => c.status === 'failed'),
    [complianceChecks]
  );

  const pendingChecks = useMemo(
    () => complianceChecks.filter((c) => c.status === 'pending'),
    [complianceChecks]
  );

  const blockingChecks = useMemo(
    () =>
      complianceChecks.filter(
        (c) => c.blocks_delivery && c.status !== 'passed' && c.status !== 'override' && c.status !== 'skipped'
      ),
    [complianceChecks]
  );

  const allChecksPassed = useMemo(
    () =>
      complianceChecks.length > 0 &&
      complianceChecks.every(
        (c) => c.status === 'passed' || c.status === 'override' || c.status === 'skipped'
      ),
    [complianceChecks]
  );

  const canCompleteDelivery = useMemo(
    () => canCompleteQuery.data?.can_complete ?? false,
    [canCompleteQuery.data]
  );

  return {
    // Data
    complianceChecks,
    passedChecks,
    failedChecks,
    pendingChecks,
    blockingChecks,

    // Status
    isLoading,
    error,
    refetch,
    allChecksPassed,
    canCompleteDelivery,

    // Actions
    createCheck: createCheckMutation.mutateAsync,
    isCreating: createCheckMutation.isPending,

    verifyCheck: verifyCheckMutation.mutateAsync,
    isVerifying: verifyCheckMutation.isPending,

    overrideCheck: overrideCheckMutation.mutateAsync,
    isOverriding: overrideCheckMutation.isPending,

    initializeChecks: initializeComplianceChecksMutation.mutateAsync,
    isInitializing: initializeComplianceChecksMutation.isPending,

    autoVerifySystemChecks,
  };
}

/**
 * Hook for fetching compliance audit logs
 */
export function useComplianceAuditLog(orderId?: string, deliveryId?: string) {
  const { tenantId } = useTenantContext();

  return useQuery({
    queryKey: [COMPLIANCE_QUERY_KEY, 'audit-log', tenantId, orderId, deliveryId],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = (supabase as any)
        .from('delivery_compliance_audit_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (orderId) {
        query = (query as any).eq('order_id', orderId);
      }
      if (deliveryId) {
        query = (query as any).eq('delivery_id', deliveryId);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01') {
          logger.debug('delivery_compliance_audit_log table does not exist yet', {
            component: 'useComplianceAuditLog',
          });
          return [];
        }
        logger.error('Failed to fetch compliance audit log', error, {
          component: 'useComplianceAuditLog',
        });
        throw error;
      }

      return (data || []) as ComplianceAuditLogEntry[];
    },
    enabled: !!tenantId && (!!orderId || !!deliveryId),
    staleTime: 30000,
  });
}

export default useDeliveryCompliance;
