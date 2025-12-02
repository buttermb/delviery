/**
 * Tenant Query Utilities
 * 
 * Provides tenant-aware query helpers that automatically enforce tenant isolation.
 * These utilities ensure all database operations respect multi-tenancy boundaries.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Tenant-aware SELECT query helper
 * Automatically adds tenant_id filter to queries
 */
export function tenantQuery<T = any>(
  table: string,
  tenantId: string,
  select: string = '*'
) {
  if (!tenantId) {
    logger.error('tenantQuery: missing tenant ID', { table });
    throw new Error('Tenant ID required for query');
  }

  return supabase
    .from(table)
    .select(select)
    .eq('tenant_id', tenantId);
}

/**
 * Tenant-aware INSERT helper
 * Automatically adds tenant_id to insert data
 */
export async function tenantInsert<T = any>(
  table: string,
  tenantId: string,
  data: Record<string, any> | Record<string, any>[]
) {
  if (!tenantId) {
    logger.error('tenantInsert: missing tenant ID', { table });
    throw new Error('Tenant ID required for insert');
  }

  const insertData = Array.isArray(data)
    ? data.map(item => ({ ...item, tenant_id: tenantId }))
    : { ...data, tenant_id: tenantId };

  return supabase
    .from(table)
    .insert(insertData)
    .select();
}

/**
 * Tenant-aware UPDATE helper
 * Ensures updates only affect records in the tenant's scope
 */
export async function tenantUpdate<T = any>(
  table: string,
  tenantId: string,
  id: string,
  data: Record<string, any>
) {
  if (!tenantId) {
    logger.error('tenantUpdate: missing tenant ID', { table, id });
    throw new Error('Tenant ID required for update');
  }

  return supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select();
}

/**
 * Tenant-aware DELETE helper
 * Ensures deletes only affect records in the tenant's scope
 */
export async function tenantDelete(
  table: string,
  tenantId: string,
  id: string
) {
  if (!tenantId) {
    logger.error('tenantDelete: missing tenant ID', { table, id });
    throw new Error('Tenant ID required for delete');
  }

  return supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
}

/**
 * Validate tenant access for Edge Functions
 * Throws error if user doesn't have access to tenant
 */
export async function validateTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_users')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    logger.error('validateTenantAccess: query failed', { userId, tenantId, error });
    throw new Error('Failed to validate tenant access');
  }

  return !!data;
}

/**
 * Get all tenant IDs for a user
 */
export async function getUserTenantIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    logger.error('getUserTenantIds: query failed', { userId, error });
    return [];
  }

  return data.map(row => row.tenant_id);
}

/**
 * Type guard to check if value is a valid tenant ID
 */
export function hasTenantId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Assert tenant ID is valid, throw if not
 */
export function assertTenantId(tenantId: unknown): asserts tenantId is string {
  if (!hasTenantId(tenantId)) {
    throw new Error('Invalid tenant ID');
  }
}
