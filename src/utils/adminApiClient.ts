/**
 * Client for calling admin API operations through the edge function
 * Bypasses RLS by using service role on the backend
 */

import { invokeEdgeFunction } from './edgeFunctionHelper';
import { supabase } from '@/integrations/supabase/client';

export interface AdminApiOptions<T = unknown> {
  resource: 'api_keys' | 'audit_trail' | 'automation_rules' | 'custom_integrations' | 'webhooks' | 'custom_reports';
  action: 'list' | 'create' | 'update' | 'delete';
  data?: T;
  id?: string;
}

/**
 * Call admin API operations through the edge function
 */
export async function adminApiCall<T = unknown>(options: AdminApiOptions): Promise<{ data: T | null; error: Error | null }> {
  // Get Supabase session token
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    return { data: null, error: new Error('Not authenticated') };
  }

  return invokeEdgeFunction<T>({
    functionName: 'admin-api-operations',
    body: options as unknown as Record<string, unknown>,
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });
}

/**
 * List records from a resource
 */
export async function listAdminRecords<T = unknown>(resource: AdminApiOptions['resource']): Promise<{ data: T[] | null; error: Error | null }> {
  return adminApiCall<T[]>({
    resource,
    action: 'list'
  });
}

/**
 * Create a new record
 */
export async function createAdminRecord<T = unknown>(resource: AdminApiOptions['resource'], data: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }> {
  return adminApiCall<T>({
    resource,
    action: 'create',
    data
  });
}

/**
 * Update an existing record
 */
export async function updateAdminRecord<T = unknown>(resource: AdminApiOptions['resource'], id: string, data: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }> {
  return adminApiCall<T>({
    resource,
    action: 'update',
    id,
    data
  });
}

/**
 * Delete a record
 */
export async function deleteAdminRecord(resource: AdminApiOptions['resource'], id: string): Promise<{ data: unknown | null; error: Error | null }> {
  return adminApiCall({
    resource,
    action: 'delete',
    id
  });
}
