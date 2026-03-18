/**
 * useCustomerCompliance Hook
 *
 * Manages customer compliance verification for cannabis businesses.
 * Checks age verification, ID on file, purchase limits, and delivery zone validation.
 * Compliance requirements are configurable per tenant's jurisdiction.
 */

import { useQuery } from '@tanstack/react-query';
import { differenceInYears, parseISO, isAfter } from 'date-fns';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';

// ============================================================================
// Types
// ============================================================================

export type ComplianceCheckType =
  | 'age_verified'
  | 'id_on_file'
  | 'purchase_limits'
  | 'delivery_zone'
  | 'medical_card';

export type ComplianceStatus = 'passed' | 'failed' | 'pending' | 'not_required';

export interface ComplianceCheck {
  type: ComplianceCheckType;
  status: ComplianceStatus;
  label: string;
  description: string;
  details?: string;
  isRequired: boolean;
  lastVerified?: string | null;
  expiresAt?: string | null;
}

export interface ComplianceRequirements {
  requireAgeVerification: boolean;
  minimumAge: number;
  requireIdOnFile: boolean;
  requireMedicalCard: boolean;
  enforcePurchaseLimits: boolean;
  dailyPurchaseLimit?: number;
  monthlyPurchaseLimit?: number;
  enforceDeliveryZone: boolean;
  blockOrdersIfNonCompliant: boolean;
}

export interface CustomerComplianceData {
  customerId: string;
  checks: ComplianceCheck[];
  isFullyCompliant: boolean;
  canPlaceOrders: boolean;
  failedChecks: ComplianceCheck[];
  pendingChecks: ComplianceCheck[];
  requirements: ComplianceRequirements;
}

export interface UseCustomerComplianceReturn {
  compliance: CustomerComplianceData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isCompliantForOrdering: boolean;
}

// ============================================================================
// Default Requirements (can be overridden by tenant settings)
// ============================================================================

const DEFAULT_REQUIREMENTS: ComplianceRequirements = {
  requireAgeVerification: true,
  minimumAge: 21,
  requireIdOnFile: true,
  requireMedicalCard: false,
  enforcePurchaseLimits: true,
  dailyPurchaseLimit: undefined, // No limit by default
  monthlyPurchaseLimit: undefined,
  enforceDeliveryZone: true,
  blockOrdersIfNonCompliant: true,
};

// ============================================================================
// Query Keys
// ============================================================================

const complianceKeys = {
  all: ['customer-compliance'] as const,
  customer: (tenantId: string, customerId: string) =>
    [...complianceKeys.all, tenantId, customerId] as const,
};

// ============================================================================
// Data Fetching
// ============================================================================

interface CustomerData {
  id: string;
  date_of_birth: string | null;
  customer_type: string | null;
  medical_card_number: string | null;
  medical_card_expiration: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  monthly_allotment_limit: number | null;
  total_spent: number | null;
}

interface AgeVerification {
  id: string;
  verified: boolean | null;
  id_type: string | null;
  id_front_url: string | null;
  date_of_birth: string | null;
  created_at: string | null;
}

interface TenantSettings {
  compliance_requirements?: Partial<ComplianceRequirements>;
}

interface OrderTotalResult {
  total_amount: number | null;
}

async function fetchCustomerComplianceData(
  tenantId: string,
  customerId: string
): Promise<CustomerComplianceData> {
  // Fetch customer data
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select(`
      id,
      date_of_birth,
      customer_type,
      medical_card_number,
      medical_card_expiration,
      address,
      city,
      state,
      zip_code,
      monthly_allotment_limit,
      total_spent
    `)
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (customerError) {
    logger.error('Failed to fetch customer for compliance check', customerError, {
      tenantId,
      customerId,
      component: 'useCustomerCompliance',
    });
    throw customerError;
  }

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Fetch age verification data if customer has auth user
  const { data: ageVerification } = await supabase
    .from('age_verifications')
    .select('id, verified, id_type, id_front_url, date_of_birth, created_at')
    .eq('user_id', customerId)
    .maybeSingle();

  // Fetch tenant compliance settings
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('metadata')
    .eq('id', tenantId)
    .maybeSingle();

  const tenantSettings = (tenantData?.metadata as TenantSettings | null) ?? null;
  const requirements: ComplianceRequirements = {
    ...DEFAULT_REQUIREMENTS,
    ...(tenantSettings?.compliance_requirements || {}),
  };

  // Fetch recent orders for purchase limit check
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('customer_id', customerId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const monthlySpent = (recentOrders ?? []).reduce(
    (sum: number, order: OrderTotalResult) => sum + (order.total_amount ?? 0),
    0
  );

  // Fetch delivery zones for the tenant
  const { data: storefrontSettings } = await supabase
    .from('storefront_settings')
    .select('delivery_zones')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  // Build compliance checks
  const checks = buildComplianceChecks(
    customer as CustomerData,
    ageVerification as AgeVerification | null,
    requirements,
    monthlySpent,
    storefrontSettings?.delivery_zones
  );

  const failedChecks = checks.filter(
    (c) => c.isRequired && c.status === 'failed'
  );
  const pendingChecks = checks.filter(
    (c) => c.isRequired && c.status === 'pending'
  );
  const isFullyCompliant = failedChecks.length === 0 && pendingChecks.length === 0;
  const canPlaceOrders = requirements.blockOrdersIfNonCompliant
    ? isFullyCompliant
    : true;

  return {
    customerId,
    checks,
    isFullyCompliant,
    canPlaceOrders,
    failedChecks,
    pendingChecks,
    requirements,
  };
}

// ============================================================================
// Compliance Check Building
// ============================================================================

function buildComplianceChecks(
  customer: CustomerData,
  ageVerification: AgeVerification | null,
  requirements: ComplianceRequirements,
  monthlySpent: number,
  deliveryZones: unknown
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  const now = new Date();

  // 1. Age Verification Check
  const ageCheck = buildAgeCheck(customer, ageVerification, requirements, now);
  checks.push(ageCheck);

  // 2. ID On File Check
  const idCheck = buildIdCheck(ageVerification, requirements);
  checks.push(idCheck);

  // 3. Medical Card Check (only for medical customers)
  if (customer.customer_type === 'medical' || requirements.requireMedicalCard) {
    const medicalCheck = buildMedicalCardCheck(customer, requirements, now);
    checks.push(medicalCheck);
  }

  // 4. Purchase Limits Check
  const purchaseLimitCheck = buildPurchaseLimitCheck(
    customer,
    monthlySpent,
    requirements
  );
  checks.push(purchaseLimitCheck);

  // 5. Delivery Zone Check
  const zoneCheck = buildDeliveryZoneCheck(customer, deliveryZones, requirements);
  checks.push(zoneCheck);

  return checks;
}

function buildAgeCheck(
  customer: CustomerData,
  ageVerification: AgeVerification | null,
  requirements: ComplianceRequirements,
  now: Date
): ComplianceCheck {
  const isRequired = requirements.requireAgeVerification;
  const minimumAge = requirements.minimumAge;

  // Check if age verification exists
  if (ageVerification?.verified) {
    return {
      type: 'age_verified',
      status: 'passed',
      label: 'Age Verified',
      description: `Customer has been verified as ${minimumAge}+`,
      details: `Verified via ${ageVerification.id_type || 'ID'}`,
      isRequired,
      lastVerified: ageVerification.created_at,
    };
  }

  // Check from date of birth
  if (customer.date_of_birth) {
    const dob = parseISO(customer.date_of_birth);
    const age = differenceInYears(now, dob);

    if (age >= minimumAge) {
      return {
        type: 'age_verified',
        status: 'passed',
        label: 'Age Verified',
        description: `Customer is ${age} years old`,
        details: `DOB: ${customer.date_of_birth}`,
        isRequired,
      };
    } else {
      return {
        type: 'age_verified',
        status: 'failed',
        label: 'Age Verification Failed',
        description: `Customer is ${age} years old (minimum: ${minimumAge})`,
        isRequired,
      };
    }
  }

  return {
    type: 'age_verified',
    status: isRequired ? 'pending' : 'not_required',
    label: 'Age Not Verified',
    description: `No date of birth on file. Minimum age: ${minimumAge}`,
    isRequired,
  };
}

function buildIdCheck(
  ageVerification: AgeVerification | null,
  requirements: ComplianceRequirements
): ComplianceCheck {
  const isRequired = requirements.requireIdOnFile;

  if (ageVerification?.id_front_url) {
    return {
      type: 'id_on_file',
      status: 'passed',
      label: 'ID On File',
      description: 'Government-issued ID has been uploaded',
      details: ageVerification.id_type || 'ID document',
      isRequired,
      lastVerified: ageVerification.created_at,
    };
  }

  return {
    type: 'id_on_file',
    status: isRequired ? 'failed' : 'not_required',
    label: 'No ID On File',
    description: 'No government-issued ID has been uploaded',
    isRequired,
  };
}

function buildMedicalCardCheck(
  customer: CustomerData,
  requirements: ComplianceRequirements,
  now: Date
): ComplianceCheck {
  const isRequired = requirements.requireMedicalCard || customer.customer_type === 'medical';

  if (!customer.medical_card_number) {
    return {
      type: 'medical_card',
      status: isRequired ? 'failed' : 'not_required',
      label: 'No Medical Card',
      description: 'Medical card information not on file',
      isRequired,
    };
  }

  // Check expiration
  if (customer.medical_card_expiration) {
    const expiration = parseISO(customer.medical_card_expiration);
    if (isAfter(now, expiration)) {
      return {
        type: 'medical_card',
        status: 'failed',
        label: 'Medical Card Expired',
        description: `Medical card expired on ${customer.medical_card_expiration}`,
        details: `Card #: ${customer.medical_card_number}`,
        isRequired,
        expiresAt: customer.medical_card_expiration,
      };
    }
  }

  return {
    type: 'medical_card',
    status: 'passed',
    label: 'Medical Card Valid',
    description: 'Active medical card on file',
    details: `Card #: ${customer.medical_card_number}`,
    isRequired,
    expiresAt: customer.medical_card_expiration,
  };
}

function buildPurchaseLimitCheck(
  customer: CustomerData,
  monthlySpent: number,
  requirements: ComplianceRequirements
): ComplianceCheck {
  const isRequired = requirements.enforcePurchaseLimits;
  const monthlyLimit = requirements.monthlyPurchaseLimit || customer.monthly_allotment_limit;

  if (!monthlyLimit) {
    return {
      type: 'purchase_limits',
      status: 'passed',
      label: 'No Purchase Limit',
      description: 'No monthly purchase limit configured',
      isRequired: false,
    };
  }

  const remaining = monthlyLimit - monthlySpent;
  const percentUsed = Math.round((monthlySpent / monthlyLimit) * 100);

  if (remaining <= 0) {
    return {
      type: 'purchase_limits',
      status: 'failed',
      label: 'Purchase Limit Exceeded',
      description: `Monthly limit of ${formatCurrency(monthlyLimit)} has been reached`,
      details: `Spent this month: ${formatCurrency(monthlySpent)}`,
      isRequired,
    };
  }

  if (percentUsed >= 80) {
    return {
      type: 'purchase_limits',
      status: 'pending',
      label: 'Near Purchase Limit',
      description: `${percentUsed}% of monthly limit used`,
      details: `${formatCurrency(remaining)} remaining of ${formatCurrency(monthlyLimit)}`,
      isRequired,
    };
  }

  return {
    type: 'purchase_limits',
    status: 'passed',
    label: 'Within Purchase Limits',
    description: `${formatCurrency(remaining)} remaining this month`,
    details: `${percentUsed}% of ${formatCurrency(monthlyLimit)} limit used`,
    isRequired,
  };
}

function buildDeliveryZoneCheck(
  customer: CustomerData,
  deliveryZones: unknown,
  requirements: ComplianceRequirements
): ComplianceCheck {
  const isRequired = requirements.enforceDeliveryZone;

  // If no delivery zones configured, pass by default
  if (!deliveryZones || !Array.isArray(deliveryZones) || deliveryZones.length === 0) {
    return {
      type: 'delivery_zone',
      status: 'passed',
      label: 'Delivery Zone',
      description: 'No delivery zone restrictions configured',
      isRequired: false,
    };
  }

  // If customer has no address, mark as pending
  if (!customer.address && !customer.zip_code) {
    return {
      type: 'delivery_zone',
      status: isRequired ? 'pending' : 'not_required',
      label: 'Address Required',
      description: 'No delivery address on file for zone validation',
      isRequired,
    };
  }

  // Simple zip code check against delivery zones
  const customerZip = customer.zip_code;
  if (customerZip) {
    const zoneZips = deliveryZones.flatMap((zone: { zip_codes?: string[] }) =>
      zone.zip_codes ?? []
    );

    if (zoneZips.length > 0 && !zoneZips.includes(customerZip)) {
      return {
        type: 'delivery_zone',
        status: 'failed',
        label: 'Outside Delivery Zone',
        description: `ZIP code ${customerZip} is not in delivery area`,
        isRequired,
      };
    }
  }

  return {
    type: 'delivery_zone',
    status: 'passed',
    label: 'In Delivery Zone',
    description: customer.address
      ? `${customer.city ?? ''}, ${customer.state ?? ''} ${customer.zip_code ?? ''}`
      : 'Address validated',
    isRequired,
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCustomerCompliance(
  customerId: string | undefined
): UseCustomerComplianceReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    data: compliance,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: complianceKeys.customer(tenantId ?? '', customerId ?? ''),
    queryFn: () => fetchCustomerComplianceData(tenantId!, customerId!),
    enabled: !!tenantId && !!customerId,
    staleTime: 60000, // 1 minute
  });

  return {
    compliance: compliance || null,
    isLoading,
    error: error as Error | null,
    refetch,
    isCompliantForOrdering: compliance?.canPlaceOrders ?? false,
  };
}

// ============================================================================
// Export Utility Functions
// ============================================================================

export { DEFAULT_REQUIREMENTS as defaultComplianceRequirements };
