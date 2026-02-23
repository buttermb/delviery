/**
 * Customer Organization Types
 *
 * Supports B2B wholesale relationships where multiple customers
 * can belong to one organization for shared billing, group pricing,
 * and consolidated analytics.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Organization status
 */
export type OrganizationStatus = 'active' | 'inactive' | 'pending' | 'suspended';

/**
 * Organization type
 */
export type OrganizationType = 'business' | 'dispensary' | 'distributor' | 'manufacturer' | 'other';

/**
 * Customer Organization record
 */
export interface Organization {
  id: string;
  tenant_id: string;

  // Basic Info
  name: string;
  legal_name: string | null;
  organization_type: OrganizationType;
  status: OrganizationStatus;

  // Contact Info
  email: string | null;
  phone: string | null;
  website: string | null;

  // Address
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;

  // Billing
  billing_email: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  tax_id: string | null;
  payment_terms: number | null; // Days until payment due (net 30, etc.)

  // License Info (for cannabis compliance)
  license_number: string | null;
  license_type: string | null;
  license_expiration: string | null;

  // Pricing
  pricing_tier_id: string | null;
  discount_percentage: number | null;

  // Notes
  notes: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Organization with aggregated stats
 */
export interface OrganizationWithStats extends Organization {
  member_count: number;
  total_ltv: number;
  total_orders: number;
  avg_order_value: number;
  last_order_date: string | null;
}

/**
 * Organization member (customer linked to organization)
 */
export interface OrganizationMember {
  id: string;
  tenant_id: string;
  organization_id: string;
  customer_id: string;
  role: OrganizationMemberRole;
  is_primary_contact: boolean;
  can_place_orders: boolean;
  can_view_invoices: boolean;
  can_manage_members: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;

  // Joined customer data
  customer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
}

/**
 * Member role within organization
 */
export type OrganizationMemberRole = 'owner' | 'admin' | 'buyer' | 'viewer';

/**
 * Organization member role labels
 */
export const ORGANIZATION_MEMBER_ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  buyer: 'Buyer',
  viewer: 'Viewer',
};

/**
 * Organization type labels
 */
export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  business: 'Business',
  dispensary: 'Dispensary',
  distributor: 'Distributor',
  manufacturer: 'Manufacturer',
  other: 'Other',
};

/**
 * Organization status labels
 */
export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  suspended: 'Suspended',
};

// ============================================================================
// Form Types
// ============================================================================

/**
 * Form values for creating/editing an organization
 */
export interface OrganizationFormValues {
  name: string;
  legal_name?: string;
  organization_type: OrganizationType;
  status?: OrganizationStatus;

  // Contact
  email?: string;
  phone?: string;
  website?: string;

  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;

  // Billing
  billing_email?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;
  tax_id?: string;
  payment_terms?: number;

  // License
  license_number?: string;
  license_type?: string;
  license_expiration?: string;

  // Pricing
  pricing_tier_id?: string;
  discount_percentage?: number;

  // Notes
  notes?: string;
}

/**
 * Form values for adding a member to an organization
 */
export interface AddMemberFormValues {
  customer_id: string;
  role: OrganizationMemberRole;
  is_primary_contact?: boolean;
  can_place_orders?: boolean;
  can_view_invoices?: boolean;
  can_manage_members?: boolean;
}

// ============================================================================
// Query/Filter Types
// ============================================================================

/**
 * Filters for organization list queries
 */
export interface OrganizationFilters {
  search?: string;
  status?: OrganizationStatus;
  organization_type?: OrganizationType;
  has_active_orders?: boolean;
}

/**
 * Sort options for organization list
 */
export type OrganizationSortField = 'name' | 'created_at' | 'total_ltv' | 'member_count' | 'last_order_date';

export interface OrganizationSortOptions {
  field: OrganizationSortField;
  direction: 'asc' | 'desc';
}
