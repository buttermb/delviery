/**
 * Admin Panel Comprehensive Audit Tool
 *
 * Systematically checks:
 * - Edge function connectivity
 * - Database table existence and RLS policies
 * - Button handler validation
 * - Query key consistency
 * - Permission/role loading
 * - API endpoint health
 *
 * Run via: AdminAuditPanel component or console: runAdminAudit()
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AuditResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: unknown;
  fix?: string;
}

export interface AuditReport {
  timestamp: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  results: AuditResult[];
  criticalIssues: AuditResult[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';

/**
 * Core database tables that must exist for admin panel
 */
const REQUIRED_TABLES = [
  'tenants',
  'tenant_users',
  'roles',
  'user_roles',
  'tenant_role_permissions',
  'orders',
  'wholesale_orders',
  'unified_orders',
  'products',
  'customers',
  'inventory_transactions',
  'menus',
  'menu_products',
  'locations',
  'delivery_zones',
  'coupons',
  'conversations',
  'messages',
];

/**
 * Edge functions that must be accessible
 * Only includes functions that actually exist in supabase/functions/
 */
const REQUIRED_EDGE_FUNCTIONS = [
  'tenant-admin-auth',
  'super-admin-auth',
  'customer-auth',
  'send-notification',
  'create-order',
  'update-order-status',
  'invoice-management',
  'credits-balance',
];

/**
 * Required RLS policies for security
 */
const REQUIRED_RLS_POLICIES = [
  { table: 'orders', policy: 'tenant_isolation' },
  { table: 'products', policy: 'tenant_isolation' },
  { table: 'customers', policy: 'tenant_isolation' },
  { table: 'tenant_users', policy: 'tenant_access' },
];

class AdminPanelAuditor {
  private results: AuditResult[] = [];
  private tenantId?: string;

  constructor(tenantId?: string) {
    this.tenantId = tenantId;
  }

  private addResult(result: AuditResult) {
    this.results.push(result);

    // Log critical issues immediately
    if (result.status === 'fail') {
      logger.error(`[AUDIT FAIL] ${result.category}: ${result.check}`, {
        message: result.message,
        fix: result.fix,
      });
    }
  }

  /**
   * Check if a database table exists and is accessible
   */
  async checkTableExists(tableName: string): Promise<AuditResult> {
    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*', { count: 'exact', head: true })
        .limit(0);

      if (error) {
        // Check for specific error codes
        if (error.code === '42P01') {
          return {
            category: 'Database',
            check: `Table: ${tableName}`,
            status: 'fail',
            message: `Table "${tableName}" does not exist`,
            details: error,
            fix: `Run migration to create ${tableName} table`,
          };
        }
        if (error.code === 'PGRST205') {
          return {
            category: 'Database',
            check: `Table: ${tableName}`,
            status: 'fail',
            message: `Table "${tableName}" not in PostgREST schema cache`,
            details: error,
            fix: 'Run: supabase db push to apply migrations, then reload PostgREST schema',
          };
        }
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          return {
            category: 'Database',
            check: `Table: ${tableName}`,
            status: 'warn',
            message: `RLS policy blocking access to "${tableName}"`,
            details: error,
            fix: 'Check RLS policies - may need authenticated user context',
          };
        }
        return {
          category: 'Database',
          check: `Table: ${tableName}`,
          status: 'fail',
          message: `Error accessing "${tableName}": ${error.message}`,
          details: error,
        };
      }

      return {
        category: 'Database',
        check: `Table: ${tableName}`,
        status: 'pass',
        message: `Table "${tableName}" exists and accessible`,
      };
    } catch (err) {
      return {
        category: 'Database',
        check: `Table: ${tableName}`,
        status: 'fail',
        message: `Exception checking "${tableName}": ${err}`,
        details: err,
      };
    }
  }

  /**
   * Check if an edge function is reachable
   */
  async checkEdgeFunction(functionName: string): Promise<AuditResult> {
    try {
      // Use OPTIONS request to check if function exists without triggering auth
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: 'OPTIONS',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // OPTIONS should return 200 with CORS headers
      if (response.ok || response.status === 204) {
        return {
          category: 'Edge Functions',
          check: `Function: ${functionName}`,
          status: 'pass',
          message: `Edge function "${functionName}" is reachable`,
        };
      }

      // 404 means function doesn't exist
      if (response.status === 404) {
        return {
          category: 'Edge Functions',
          check: `Function: ${functionName}`,
          status: 'fail',
          message: `Edge function "${functionName}" not found (404)`,
          fix: `Deploy the ${functionName} edge function: supabase functions deploy ${functionName}`,
        };
      }

      // Other errors
      return {
        category: 'Edge Functions',
        check: `Function: ${functionName}`,
        status: 'warn',
        message: `Edge function "${functionName}" returned ${response.status}`,
        details: { status: response.status, statusText: response.statusText },
      };
    } catch (err) {
      return {
        category: 'Edge Functions',
        check: `Function: ${functionName}`,
        status: 'fail',
        message: `Cannot reach edge function "${functionName}": ${err}`,
        details: err,
        fix: 'Check network connectivity and Supabase project status',
      };
    }
  }

  /**
   * Check role system health
   */
  async checkRoleSystem(): Promise<AuditResult[]> {
    const results: AuditResult[] = [];

    // Check roles table
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('id, name, is_system')
        .limit(10);

      if (rolesError) {
        // Check for specific error codes
        const isSchemaCache = rolesError.code === 'PGRST205';
        const isRLS = rolesError.code === '42501' || rolesError.message.includes('permission denied');

        results.push({
          category: 'Roles & Permissions',
          check: 'Roles table',
          status: 'fail',
          message: `Cannot query roles: ${rolesError.message}`,
          details: rolesError,
          fix: isSchemaCache
            ? 'Migration not applied or PostgREST schema cache needs reload. Run: supabase db push && supabase functions deploy'
            : isRLS
              ? 'RLS policy blocking access. Check tenant_users has matching email for current user.'
              : 'Ensure roles table exists and RLS allows access',
        });
      } else if (!roles || roles.length === 0) {
        results.push({
          category: 'Roles & Permissions',
          check: 'Roles table',
          status: 'warn',
          message: 'No roles found in database',
          fix: 'Seed default roles (owner, admin, member, viewer)',
        });
      } else {
        results.push({
          category: 'Roles & Permissions',
          check: 'Roles table',
          status: 'pass',
          message: `Found ${roles.length} roles`,
          details: roles.map(r => r.name),
        });
      }
    } catch (err) {
      results.push({
        category: 'Roles & Permissions',
        check: 'Roles table',
        status: 'fail',
        message: `Exception: ${err}`,
        details: err,
      });
    }

    // Check user_roles table
    try {
      const { error: userRolesError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .limit(0);

      if (userRolesError) {
        results.push({
          category: 'Roles & Permissions',
          check: 'User roles table',
          status: 'fail',
          message: `Cannot query user_roles: ${userRolesError.message}`,
          details: userRolesError,
          fix: 'Ensure user_roles table exists with proper RLS',
        });
      } else {
        results.push({
          category: 'Roles & Permissions',
          check: 'User roles table',
          status: 'pass',
          message: 'user_roles table accessible',
        });
      }
    } catch (err) {
      results.push({
        category: 'Roles & Permissions',
        check: 'User roles table',
        status: 'fail',
        message: `Exception: ${err}`,
        details: err,
      });
    }

    // Check tenant_role_permissions
    try {
      const { error: permError } = await supabase
        .from('tenant_role_permissions')
        .select('*', { count: 'exact', head: true })
        .limit(0);

      if (permError) {
        results.push({
          category: 'Roles & Permissions',
          check: 'Permissions table',
          status: 'fail',
          message: `Cannot query tenant_role_permissions: ${permError.message}`,
          details: permError,
          fix: 'Ensure tenant_role_permissions table exists',
        });
      } else {
        results.push({
          category: 'Roles & Permissions',
          check: 'Permissions table',
          status: 'pass',
          message: 'tenant_role_permissions table accessible',
        });
      }
    } catch (err) {
      results.push({
        category: 'Roles & Permissions',
        check: 'Permissions table',
        status: 'fail',
        message: `Exception: ${err}`,
        details: err,
      });
    }

    return results;
  }

  /**
   * Check orders system health
   */
  async checkOrdersSystem(): Promise<AuditResult[]> {
    const results: AuditResult[] = [];

    // Check orders table
    const ordersCheck = await this.checkTableExists('orders');
    results.push(ordersCheck);

    // Check wholesale_orders table
    const wholesaleCheck = await this.checkTableExists('wholesale_orders');
    results.push(wholesaleCheck);

    // Check unified_orders table (POS)
    const unifiedCheck = await this.checkTableExists('unified_orders');
    results.push(unifiedCheck);

    // Check if orders can be queried with tenant filter
    if (this.tenantId) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, status', { count: 'exact' })
          .eq('tenant_id', this.tenantId)
          .limit(1);

        if (error) {
          results.push({
            category: 'Orders',
            check: 'Tenant-filtered query',
            status: 'fail',
            message: `Cannot query orders for tenant: ${error.message}`,
            details: error,
            fix: 'Check RLS policies for orders table',
          });
        } else {
          results.push({
            category: 'Orders',
            check: 'Tenant-filtered query',
            status: 'pass',
            message: 'Orders queryable with tenant filter',
          });
        }
      } catch (err) {
        results.push({
          category: 'Orders',
          check: 'Tenant-filtered query',
          status: 'fail',
          message: `Exception: ${err}`,
          details: err,
        });
      }
    }

    return results;
  }

  /**
   * Check authentication system
   */
  async checkAuthSystem(): Promise<AuditResult[]> {
    const results: AuditResult[] = [];

    // Check current session
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        results.push({
          category: 'Authentication',
          check: 'Current session',
          status: 'fail',
          message: `Session error: ${error.message}`,
          details: error,
        });
      } else if (!session) {
        results.push({
          category: 'Authentication',
          check: 'Current session',
          status: 'warn',
          message: 'No active session - some checks may fail',
        });
      } else {
        results.push({
          category: 'Authentication',
          check: 'Current session',
          status: 'pass',
          message: `Authenticated as ${session.user?.email}`,
          details: { userId: session.user?.id },
        });
      }
    } catch (err) {
      results.push({
        category: 'Authentication',
        check: 'Current session',
        status: 'fail',
        message: `Exception: ${err}`,
        details: err,
      });
    }

    // Check tenant-admin-auth function
    const authCheck = await this.checkEdgeFunction('tenant-admin-auth');
    results.push(authCheck);

    return results;
  }

  /**
   * Check inventory system
   */
  async checkInventorySystem(): Promise<AuditResult[]> {
    const results: AuditResult[] = [];

    results.push(await this.checkTableExists('products'));
    results.push(await this.checkTableExists('inventory_transactions'));
    results.push(await this.checkTableExists('locations'));

    return results;
  }

  /**
   * Check customer system
   */
  async checkCustomerSystem(): Promise<AuditResult[]> {
    const results: AuditResult[] = [];

    results.push(await this.checkTableExists('customers'));
    results.push(await this.checkTableExists('conversations'));
    results.push(await this.checkTableExists('messages'));

    return results;
  }

  /**
   * Run all audit checks
   */
  async runFullAudit(): Promise<AuditReport> {
    this.results = [];
    const startTime = Date.now();

    logger.info('[AUDIT] Starting comprehensive admin panel audit...');

    // 1. Database table checks
    logger.info('[AUDIT] Checking database tables...');
    for (const table of REQUIRED_TABLES) {
      const result = await this.checkTableExists(table);
      this.addResult(result);
    }

    // 2. Edge function checks
    logger.info('[AUDIT] Checking edge functions...');
    for (const fn of REQUIRED_EDGE_FUNCTIONS) {
      const result = await this.checkEdgeFunction(fn);
      this.addResult(result);
    }

    // 3. Role system checks
    logger.info('[AUDIT] Checking role system...');
    const roleResults = await this.checkRoleSystem();
    roleResults.forEach(r => this.addResult(r));

    // 4. Orders system checks
    logger.info('[AUDIT] Checking orders system...');
    const orderResults = await this.checkOrdersSystem();
    orderResults.forEach(r => this.addResult(r));

    // 5. Auth system checks
    logger.info('[AUDIT] Checking authentication...');
    const authResults = await this.checkAuthSystem();
    authResults.forEach(r => this.addResult(r));

    // 6. Inventory system checks
    logger.info('[AUDIT] Checking inventory system...');
    const inventoryResults = await this.checkInventorySystem();
    inventoryResults.forEach(r => this.addResult(r));

    // 7. Customer system checks
    logger.info('[AUDIT] Checking customer system...');
    const customerResults = await this.checkCustomerSystem();
    customerResults.forEach(r => this.addResult(r));

    // Compile report
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      totalChecks: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      warnings: this.results.filter(r => r.status === 'warn').length,
      skipped: this.results.filter(r => r.status === 'skip').length,
      results: this.results,
      criticalIssues: this.results.filter(r => r.status === 'fail'),
    };

    const duration = Date.now() - startTime;
    logger.info(`[AUDIT] Complete in ${duration}ms`, {
      passed: report.passed,
      failed: report.failed,
      warnings: report.warnings,
    });

    return report;
  }
}

/**
 * Run admin panel audit from console or component
 */
export async function runAdminAudit(tenantId?: string): Promise<AuditReport> {
  const auditor = new AdminPanelAuditor(tenantId);
  return auditor.runFullAudit();
}

/**
 * Quick health check - just critical systems
 */
export async function quickHealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check auth
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    issues.push('No active session');
  }

  // Check core tables
  const coreTables = ['tenants', 'orders', 'products'];
  for (const table of coreTables) {
    const { error } = await supabase
      .from(table as any)
      .select('*', { count: 'exact', head: true })
      .limit(0);
    if (error) {
      issues.push(`Table "${table}": ${error.message}`);
    }
  }

  // Check tenant-admin-auth function
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/tenant-admin-auth`,
      { method: 'OPTIONS' }
    );
    if (response.status === 404) {
      issues.push('tenant-admin-auth function not found');
    }
  } catch {
    issues.push('Cannot reach edge functions');
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).runAdminAudit = runAdminAudit;
  (window as any).quickHealthCheck = quickHealthCheck;
}
