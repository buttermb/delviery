/**
 * Delivery Compliance Types
 * Type definitions for cannabis delivery compliance checks
 */

/**
 * Types of compliance checks for cannabis delivery
 */
export type ComplianceCheckType =
  | 'age_verification'
  | 'id_on_file'
  | 'licensed_zone'
  | 'time_restriction'
  | 'quantity_limit'
  | 'customer_status';

/**
 * Status of a compliance check
 */
export type ComplianceCheckStatus =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'override';

/**
 * Verification method used
 */
export type VerificationMethod = 'manual' | 'system' | 'override';

/**
 * Actor type for audit logging
 */
export type ComplianceActorType = 'system' | 'courier' | 'admin';

/**
 * Check-specific data structures
 */
export interface AgeVerificationData {
  customer_age?: number;
  minimum_age: number;
  customer_dob?: string;
  id_type?: string;
  id_expiry?: string;
  id_number_last4?: string;
}

export interface IdOnFileData {
  has_id_on_file: boolean;
  id_type?: string;
  id_verified_at?: string;
  id_expiry?: string;
}

export interface LicensedZoneData {
  zone_id?: string;
  zone_name?: string;
  customer_lat?: number;
  customer_lng?: number;
  is_in_licensed_zone: boolean;
  nearest_zone_distance_km?: number;
}

export interface TimeRestrictionData {
  delivery_time: string;
  allowed_start: string;
  allowed_end: string;
  day_of_week: string;
  is_within_hours: boolean;
}

export interface QuantityLimitData {
  product_quantities?: Record<string, number>;
  total_thc_mg?: number;
  max_allowed_mg?: number;
  total_weight_g?: number;
  max_allowed_weight_g?: number;
  exceeds_limit: boolean;
}

export interface CustomerStatusData {
  customer_status: string;
  is_active: boolean;
  is_verified: boolean;
  has_valid_account: boolean;
}

/**
 * Union type for all check data
 */
export type ComplianceCheckData =
  | AgeVerificationData
  | IdOnFileData
  | LicensedZoneData
  | TimeRestrictionData
  | QuantityLimitData
  | CustomerStatusData;

/**
 * Delivery compliance check record
 */
export interface DeliveryComplianceCheck {
  id: string;
  tenant_id: string;
  delivery_id: string | null;
  order_id: string;
  customer_id: string | null;
  courier_id: string | null;

  check_type: ComplianceCheckType;
  status: ComplianceCheckStatus;

  verified_by: string | null;
  verified_at: string | null;
  verification_method: VerificationMethod | null;
  verification_notes: string | null;

  check_data: ComplianceCheckData;

  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;

  failure_reason: string | null;
  blocks_delivery: boolean;

  created_at: string;
  updated_at: string;
}

/**
 * Compliance audit log entry
 */
export interface ComplianceAuditLogEntry {
  id: string;
  tenant_id: string;
  compliance_check_id: string | null;
  delivery_id: string | null;
  order_id: string | null;
  action: string;
  actor_id: string | null;
  actor_type: ComplianceActorType | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * Form data for creating compliance checks
 */
export interface CreateComplianceCheckInput {
  delivery_id?: string;
  order_id: string;
  customer_id?: string;
  courier_id?: string;
  check_type: ComplianceCheckType;
  check_data?: ComplianceCheckData;
  blocks_delivery?: boolean;
}

/**
 * Form data for verifying a compliance check
 */
export interface VerifyComplianceCheckInput {
  check_id: string;
  status: ComplianceCheckStatus;
  verification_method: VerificationMethod;
  verification_notes?: string;
  failure_reason?: string;
}

/**
 * Form data for overriding a failed compliance check
 */
export interface OverrideComplianceCheckInput {
  check_id: string;
  override_reason: string;
}

/**
 * Result of can_complete_delivery RPC
 */
export interface CanCompleteDeliveryResult {
  can_complete: boolean;
  blocking_checks: Array<{
    id: string;
    check_type: ComplianceCheckType;
    status: ComplianceCheckStatus;
    failure_reason: string | null;
  }>;
  all_passed: boolean;
}

/**
 * Compliance check metadata for display
 */
export interface ComplianceCheckMeta {
  type: ComplianceCheckType;
  label: string;
  description: string;
  icon: string;
  blocksDelivery: boolean;
}

/**
 * Compliance check configuration metadata
 */
export const COMPLIANCE_CHECK_META: Record<ComplianceCheckType, ComplianceCheckMeta> = {
  age_verification: {
    type: 'age_verification',
    label: 'Age Verification',
    description: 'Verify customer is 21+ years old',
    icon: 'User',
    blocksDelivery: true,
  },
  id_on_file: {
    type: 'id_on_file',
    label: 'ID on File',
    description: 'Customer has valid ID document on file',
    icon: 'CreditCard',
    blocksDelivery: true,
  },
  licensed_zone: {
    type: 'licensed_zone',
    label: 'Licensed Delivery Zone',
    description: 'Delivery address is within licensed zone',
    icon: 'MapPin',
    blocksDelivery: true,
  },
  time_restriction: {
    type: 'time_restriction',
    label: 'Delivery Hours',
    description: 'Delivery is within allowed hours',
    icon: 'Clock',
    blocksDelivery: true,
  },
  quantity_limit: {
    type: 'quantity_limit',
    label: 'Quantity Limits',
    description: 'Order is within legal quantity limits',
    icon: 'Package',
    blocksDelivery: true,
  },
  customer_status: {
    type: 'customer_status',
    label: 'Customer Status',
    description: 'Customer account is active and verified',
    icon: 'UserCheck',
    blocksDelivery: false,
  },
};

/**
 * Compliance settings for tenant
 */
export interface ComplianceSettings {
  minimum_age: number;
  require_id_on_file: boolean;
  enforce_delivery_zones: boolean;
  delivery_start_time: string;
  delivery_end_time: string;
  max_thc_mg_per_order: number;
  max_weight_g_per_order: number;
  require_customer_verification: boolean;
  allow_compliance_override: boolean;
  override_requires_admin: boolean;
}

/**
 * Default compliance settings
 */
export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettings = {
  minimum_age: 21,
  require_id_on_file: true,
  enforce_delivery_zones: true,
  delivery_start_time: '09:00',
  delivery_end_time: '21:00',
  max_thc_mg_per_order: 2800, // California daily limit
  max_weight_g_per_order: 28, // 1 oz
  require_customer_verification: true,
  allow_compliance_override: true,
  override_requires_admin: true,
};
