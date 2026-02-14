/**
 * Feature Availability Utility
 * Checks if features are available based on table existence
 * Used to conditionally show/hide navigation items
 */

import { supabase } from '@/integrations/supabase/client';


/** PostgreSQL error with code property */
interface PostgresError {
  code: string;
  message?: string;
}

/** Type guard to check if an error is a PostgreSQL error */
function isPostgresError(error: unknown): error is PostgresError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as PostgresError).code === 'string'
  );
}

// Cache for table existence checks
const tableExistenceCache = new Map<string, boolean>();

/**
 * Check if a table exists in the database
 * Uses caching to avoid repeated queries
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  // Check cache first
  if (tableExistenceCache.has(tableName)) {
    return tableExistenceCache.get(tableName)!;
  }

  try {
    // Try to query the table (with limit 0 to minimize data transfer)
    // Cast to TableName since we're checking tables that may or may not exist in the schema
    const { error } = await (supabase as any)
      .from(tableName)
      .select('id')
      .limit(0);

    // If error code is 42P01, table doesn't exist
    const exists = !error || error.code !== '42P01';

    // Cache the result
    tableExistenceCache.set(tableName, exists);

    return exists;
  } catch (error: unknown) {
    // If we get a 42P01 error, table doesn't exist
    if (isPostgresError(error) && error.code === '42P01') {
      tableExistenceCache.set(tableName, false);
      return false;
    }
    // For other errors, assume table exists (to avoid hiding working features)
    tableExistenceCache.set(tableName, true);
    return true;
  }
}

/**
 * Check if multiple tables exist
 * Returns true only if ALL tables exist
 */
export async function checkAllTablesExist(tableNames: string[]): Promise<boolean> {
  const checks = await Promise.all(
    tableNames.map(name => checkTableExists(name))
  );
  return checks.every(exists => exists);
}

/**
 * Feature availability mapping
 * Maps navigation items to their required tables
 */
export const featureTableRequirements: Record<string, string[]> = {
  '/admin/catalog/categories': ['categories'],
  '/admin/locations/warehouses': ['warehouses'],
  '/admin/operations/receiving': ['receiving_records'],
  '/admin/catalog/batches': ['inventory_batches'],
};

/**
 * Check if a feature is available based on its table requirements
 */
export async function isFeatureAvailable(href: string): Promise<boolean> {
  const requiredTables = featureTableRequirements[href];
  
  // If no requirements specified, assume feature is available
  if (!requiredTables || requiredTables.length === 0) {
    return true;
  }

  return await checkAllTablesExist(requiredTables);
}

/**
 * Clear the table existence cache
 * Useful when migrations are applied
 */
export function clearTableExistenceCache(): void {
  tableExistenceCache.clear();
}
