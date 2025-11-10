/**
 * Tenant-Aware Query Utilities
 * 
 * These utilities ensure all database queries are properly scoped to the current tenant.
 * Use these helpers instead of direct Supabase queries to prevent data leaks.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Get tenant-scoped query builder
 * 
 * @example
 * const { data } = await tenantQuery(supabase, 'products')
 *   .select('*')
 *   .eq('status', 'active');
 */
export function tenantQuery<T = unknown>(
  supabase: SupabaseClient<T>,
  table: string,
  tenantId: string
) {
  if (!tenantId) {
    logger.error("tenantQuery called without tenantId", new Error("Missing tenantId"), {
      component: "tenantQueries",
      table,
    });
    throw new Error("tenantId is required for tenant-scoped queries");
  }

  return supabase.from(table).select("*").eq("tenant_id", tenantId);
}

/**
 * Get tenant-scoped insert builder
 */
export function tenantInsert<T = unknown>(
  supabase: SupabaseClient<T>,
  table: string,
  tenantId: string
) {
  if (!tenantId) {
    logger.error("tenantInsert called without tenantId", new Error("Missing tenantId"), {
      component: "tenantQueries",
      table,
    });
    throw new Error("tenantId is required for tenant-scoped inserts");
  }

  return supabase.from(table).insert({ tenant_id: tenantId } as Record<string, unknown>);
}

/**
 * Get tenant-scoped update builder
 */
export function tenantUpdate<T = unknown>(
  supabase: SupabaseClient<T>,
  table: string,
  tenantId: string
) {
  if (!tenantId) {
    logger.error("tenantUpdate called without tenantId", new Error("Missing tenantId"), {
      component: "tenantQueries",
      table,
    });
    throw new Error("tenantId is required for tenant-scoped updates");
  }

  return supabase.from(table).update({} as Record<string, unknown>).eq("tenant_id", tenantId);
}

/**
 * Get tenant-scoped delete builder
 */
export function tenantDelete<T = unknown>(
  supabase: SupabaseClient<T>,
  table: string,
  tenantId: string
) {
  if (!tenantId) {
    logger.error("tenantDelete called without tenantId", new Error("Missing tenantId"), {
      component: "tenantQueries",
      table,
    });
    throw new Error("tenantId is required for tenant-scoped deletes");
  }

  return supabase.from(table).delete().eq("tenant_id", tenantId);
}

/**
 * Validate tenant_id matches user's tenant
 * Use this in Edge Functions to prevent cross-tenant access
 */
export async function validateTenantAccess<T = unknown>(
  supabase: SupabaseClient<T>,
  userId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      logger.error("Error validating tenant access", error, {
        component: "tenantQueries",
        userId,
        tenantId,
      });
      return false;
    }

    return !!data;
  } catch (error) {
    logger.error("Exception validating tenant access", error as Error, {
      component: "tenantQueries",
      userId,
      tenantId,
    });
    return false;
  }
}

/**
 * Get user's tenant IDs
 */
export async function getUserTenantIds<T = unknown>(
  supabase: SupabaseClient<T>,
  userId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      logger.error("Error getting user tenant IDs", error, {
        component: "tenantQueries",
        userId,
      });
      return [];
    }

    return data?.map((row) => row.tenant_id) || [];
  } catch (error) {
    logger.error("Exception getting user tenant IDs", error as Error, {
      component: "tenantQueries",
      userId,
    });
    return [];
  }
}

/**
 * Type guard to ensure object has tenant_id
 */
export function hasTenantId<T extends { tenant_id?: string }>(
  obj: T
): obj is T & { tenant_id: string } {
  return typeof obj.tenant_id === "string" && obj.tenant_id.length > 0;
}

/**
 * Assert tenant_id exists (throws if missing)
 */
export function assertTenantId<T extends { tenant_id?: string }>(
  obj: T,
  context?: string
): asserts obj is T & { tenant_id: string } {
  if (!hasTenantId(obj)) {
    const error = new Error(
      `Missing tenant_id${context ? ` in ${context}` : ""}`
    );
    logger.error("Assertion failed: missing tenant_id", error, {
      component: "tenantQueries",
      context,
    });
    throw error;
  }
}

