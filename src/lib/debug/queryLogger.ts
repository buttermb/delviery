/**
 * Query Logger - Wrapper to log database queries and verify tenant isolation
 * 
 * Features:
 * - Log table name, filters, result count
 * - Warn if tenant_id filter is missing on tenant-scoped tables
 * - Track query performance
 */

import { logDBQuery, logDBQueryWarn, logRLSFailure } from './logger';

// Tables that should ALWAYS have tenant_id filter
const TENANT_SCOPED_TABLES = [
  'orders',
  'menu_orders',
  'products',
  'customers',
  'couriers',
  'deliveries',
  'wholesale_clients',
  'wholesale_orders',
  'wholesale_runners',
  'wholesale_deliveries',
  'disposable_menus',
  'inventory_alerts',
  'invoices',
  'merchants',
  'addresses',
  'loyalty_points',
  'fraud_flags',
  'age_verifications',
  'audit_logs',
  'product_movements'
];

interface QueryLogOptions {
  /** Name of the table being queried */
  table: string;
  /** Filter parameters used in the query */
  filters: Record<string, unknown>;
  /** Operation type */
  operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  /** Component/hook name for context */
  source?: string;
}

/**
 * Log a database query and verify tenant isolation
 * Call AFTER the query completes with the results
 */
export function logQuery<T>(
  options: QueryLogOptions,
  results: T[] | null,
  error?: Error | null
): T[] | null {
  const { table, filters, operation = 'SELECT', source } = options;
  const hasTenantFilter = 'tenant_id' in filters && filters.tenant_id != null;
  const needsTenantFilter = TENANT_SCOPED_TABLES.includes(table);

  // Log query details
  const logData = {
    table,
    operation,
    filterKeys: Object.keys(filters),
    hasTenantFilter,
    resultCount: results?.length ?? 0,
    source,
    timestamp: new Date().toISOString()
  };

  // Check for RLS failure
  if (error) {
    logRLSFailure(`Query failed on ${table}`, {
      ...logData,
      error: error.message,
      errorCode: (error as unknown as Record<string, unknown>).code
    });
    return results;
  }

  // Warn if tenant filter is missing on tenant-scoped table
  if (needsTenantFilter && !hasTenantFilter) {
    logDBQueryWarn(`⚠️ MISSING TENANT FILTER on ${table}`, {
      ...logData,
      warning: 'This query may leak data across tenants!'
    });
  } else {
    logDBQuery(`Query: ${operation} ${table}`, logData);
  }

  return results;
}

/**
 * Simplified helper for logging SELECT queries
 */
export function logSelectQuery<T>(
  table: string,
  filters: Record<string, unknown>,
  results: T[] | null,
  source?: string
): T[] | null {
  return logQuery({ table, filters, operation: 'SELECT', source }, results);
}

/**
 * Log a mutation (INSERT/UPDATE/DELETE) operation
 */
export function logMutation(
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  data: Record<string, unknown>,
  error?: Error | null,
  source?: string
): void {
  const hasTenantId = 'tenant_id' in data && data.tenant_id != null;
  const needsTenantId = TENANT_SCOPED_TABLES.includes(table);

  const logData = {
    table,
    operation,
    hasTenantId,
    source,
    dataKeys: Object.keys(data)
  };

  if (error) {
    logRLSFailure(`${operation} failed on ${table}`, {
      ...logData,
      error: error.message
    });
    return;
  }

  if (needsTenantId && !hasTenantId && operation === 'INSERT') {
    logDBQueryWarn(`⚠️ MISSING TENANT_ID on ${operation} ${table}`, {
      ...logData,
      warning: 'This insert may fail RLS or cause data isolation issues!'
    });
  } else {
    logDBQuery(`Mutation: ${operation} ${table}`, logData);
  }
}

/**
 * Create a wrapped query function that automatically logs
 */
export function createLoggedQuery<TResult, TFilters extends Record<string, unknown>>(
  table: string,
  source: string
) {
  return {
    logSelect: (filters: TFilters, results: TResult[] | null, error?: Error | null) => 
      logQuery({ table, filters, operation: 'SELECT', source }, results, error),
    
    logInsert: (data: Record<string, unknown>, error?: Error | null) =>
      logMutation(table, 'INSERT', data, error, source),
    
    logUpdate: (data: Record<string, unknown>, error?: Error | null) =>
      logMutation(table, 'UPDATE', data, error, source),
    
    logDelete: (data: Record<string, unknown>, error?: Error | null) =>
      logMutation(table, 'DELETE', data, error, source)
  };
}

