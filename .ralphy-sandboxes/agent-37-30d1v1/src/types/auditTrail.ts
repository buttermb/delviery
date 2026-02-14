/**
 * Audit Trail Types
 * Types for the audit_trail table which tracks all changes to critical tables.
 */

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditActorType = 'super_admin' | 'tenant_admin' | 'system';

export interface AuditTrailEntry {
  id: string;
  actor_id: string | null;
  actor_type: AuditActorType | null;
  action: AuditAction;
  resource_type: string | null;
  resource_id: string | null;
  tenant_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditTrailFilters {
  action?: AuditAction | 'all';
  resourceType?: string | 'all';
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
