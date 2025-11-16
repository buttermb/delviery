/**
 * Safe Supabase Query Utilities
 * Handles missing tenant_id columns gracefully to prevent 400 errors
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Check if a column exists in a table
 */
export async function columnExists(
  supabase: SupabaseClient,
  table: string,
  column: string
): Promise<boolean> {
  try {
    // Try a simple query to check if column exists
    const { error } = await supabase
      .from(table)
      .select(column)
      .limit(0);
    
    // 42703 = undefined column error
    if (error?.code === '42703') {
      return false;
    }
    
    // Other errors might mean table doesn't exist, but we'll assume column doesn't exist
    if (error) {
      logger.debug(`Column check error for ${table}.${column}`, { error, component: 'safeSupabaseQuery' });
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely add tenant_id filter to a query
 * Returns a query builder that only filters by tenant_id if the column exists
 */
export async function safeTenantFilter<T>(
  supabase: SupabaseClient,
  table: string,
  tenantId: string | undefined,
  queryBuilder: (supabase: SupabaseClient) => any
): Promise<{ data: T | null; error: any }> {
  if (!tenantId) {
    // No tenant ID, execute query without filter
    try {
      const query = queryBuilder(supabase);
      return await query;
    } catch (error) {
      logger.error(`Query failed for ${table}`, error, { component: 'safeSupabaseQuery' });
      return { data: null, error };
    }
  }

  try {
    // Check if tenant_id column exists
    const hasTenantId = await columnExists(supabase, table, 'tenant_id');
    
    if (hasTenantId) {
      // Column exists, use tenant filter
      const query = queryBuilder(supabase);
      const result = await query.eq('tenant_id', tenantId);
      return result;
    } else {
      // Column doesn't exist, execute query without tenant filter
      // This allows the app to work before migrations are run
      logger.warn(`tenant_id column not found in ${table}, querying without tenant filter`, {
        component: 'safeSupabaseQuery',
        table,
      });
      
      const query = queryBuilder(supabase);
      return await query;
    }
  } catch (error) {
    logger.error(`Safe query failed for ${table}`, error, { component: 'safeSupabaseQuery' });
    // Return empty result instead of throwing
    return { data: null, error };
  }
}

/**
 * Execute a query with automatic tenant_id filtering if column exists
 */
export async function safeQuery<T = any>(
  supabase: SupabaseClient,
  table: string,
  options: {
    select?: string;
    tenantId?: string;
    filters?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  }
): Promise<{ data: T[] | null; error: any }> {
  const { select = '*', tenantId, filters = {}, orderBy, limit } = options;

  try {
    let query = supabase.from(table).select(select);

    // Add tenant filter if column exists
    if (tenantId) {
      const hasTenantId = await columnExists(supabase, table, 'tenant_id');
      if (hasTenantId) {
        query = query.eq('tenant_id', tenantId);
      } else {
        logger.warn(`tenant_id column not found in ${table}, skipping tenant filter`, {
          component: 'safeSupabaseQuery',
          table,
        });
      }
    }

    // Add other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    // Add ordering
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending !== false });
    }

    // Add limit
    if (limit) {
      query = query.limit(limit);
    }

    const result = await query;
    return { data: result.data as T[] | null, error: result.error };
  } catch (error) {
    logger.error(`Safe query failed for ${table}`, error, { component: 'safeSupabaseQuery' });
    return { data: null, error };
  }
}

