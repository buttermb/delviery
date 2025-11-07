/**
 * Client for calling admin API operations through the edge function
 * Bypasses RLS by using service role on the backend
 */

import { invokeEdgeFunction } from './edgeFunctionHelper';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export interface AdminApiOptions<T = any> {
  resource: 'api_keys' | 'audit_trail' | 'automation_rules' | 'custom_integrations' | 'webhooks' | 'custom_reports';
  action: 'list' | 'create' | 'update' | 'delete';
  data?: T;
  id?: string;
}

/**
 * Call admin API operations through the edge function
 */
export async function adminApiCall<T = any>(options: AdminApiOptions): Promise<{ data: T | null; error: Error | null }> {
  const token = localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
  
  if (!token) {
    return { data: null, error: new Error('Not authenticated') };
  }

  return invokeEdgeFunction<T>({
    functionName: 'admin-api-operations',
    body: options,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

/**
 * List records from a resource
 */
export async function listAdminRecords<T = any>(resource: AdminApiOptions['resource']): Promise<{ data: T[] | null; error: Error | null }> {
  return adminApiCall<T[]>({
    resource,
    action: 'list'
  });
}

/**
 * Create a new record
 */
export async function createAdminRecord<T = any>(resource: AdminApiOptions['resource'], data: any): Promise<{ data: T | null; error: Error | null }> {
  return adminApiCall<T>({
    resource,
    action: 'create',
    data
  });
}

/**
 * Update an existing record
 */
export async function updateAdminRecord<T = any>(resource: AdminApiOptions['resource'], id: string, data: any): Promise<{ data: T | null; error: Error | null }> {
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
export async function deleteAdminRecord(resource: AdminApiOptions['resource'], id: string): Promise<{ data: any | null; error: Error | null }> {
  return adminApiCall({
    resource,
    action: 'delete',
    id
  });
}
