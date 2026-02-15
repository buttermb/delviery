/**
 * Module Health Hook
 *
 * Checks health/connectivity of each module in the system.
 * Returns status object with each module name and its status (healthy/degraded/error).
 * Used in admin header as a subtle status indicator to help debug interconnectivity issues.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

export type ModuleStatus = 'healthy' | 'degraded' | 'error' | 'unknown';

export interface ModuleHealthCheck {
  name: string;
  status: ModuleStatus;
  lastChecked: Date;
  latencyMs?: number;
  errorMessage?: string;
}

export interface ModuleHealthSummary {
  modules: Record<string, ModuleHealthCheck>;
  overallStatus: ModuleStatus;
  healthyCount: number;
  degradedCount: number;
  errorCount: number;
  totalModules: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  checkModule: (moduleName: string) => Promise<ModuleHealthCheck>;
}

type ModuleName =
  | 'products'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'deliveries'
  | 'menus';

interface ModuleCheckResult {
  name: ModuleName;
  status: ModuleStatus;
  latencyMs: number;
  errorMessage?: string;
}

const MODULE_HEALTH_QUERY_KEY = ['module-health'] as const;

/**
 * Perform a health check on a specific module by attempting a lightweight query
 */
async function checkModuleHealth(
  moduleName: ModuleName,
  tenantId: string
): Promise<ModuleCheckResult> {
  const startTime = performance.now();

  try {
    let result: { error: { message: string } | null };

    switch (moduleName) {
      case 'products':
        result = await (supabase as any)
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1);
        break;

      case 'orders':
        result = await (supabase as any)
          .from('orders')
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1);
        break;

      case 'customers':
        result = await (supabase as any)
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1);
        break;

      case 'inventory':
        // Inventory is typically checked via products table stock_quantity
        result = await (supabase as any)
          .from('products')
          .select('id, stock_quantity')
          .eq('tenant_id', tenantId)
          .limit(1);
        break;

      case 'deliveries':
        result = await (supabase as any)
          .from('deliveries')
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1);
        break;

      case 'menus':
        result = await (supabase as any)
          .from('disposable_menus')
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1);
        break;

      default:
        return {
          name: moduleName,
          status: 'unknown',
          latencyMs: 0,
          errorMessage: 'Unknown module',
        };
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (result.error) {
      // Check if it's a "table doesn't exist" error (not a real error)
      if (result.error.message?.includes('42P01')) {
        return {
          name: moduleName,
          status: 'degraded',
          latencyMs,
          errorMessage: 'Table not initialized',
        };
      }

      return {
        name: moduleName,
        status: 'error',
        latencyMs,
        errorMessage: result.error.message,
      };
    }

    // Check latency for degraded status (over 2000ms is considered degraded)
    if (latencyMs > 2000) {
      return {
        name: moduleName,
        status: 'degraded',
        latencyMs,
      };
    }

    return {
      name: moduleName,
      status: 'healthy',
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    logger.error(`Module health check failed for ${moduleName}`, err);

    return {
      name: moduleName,
      status: 'error',
      latencyMs,
      errorMessage,
    };
  }
}

/**
 * Check health of all modules
 */
async function checkAllModulesHealth(
  tenantId: string
): Promise<Record<string, ModuleHealthCheck>> {
  const moduleNames: ModuleName[] = [
    'products',
    'orders',
    'customers',
    'inventory',
    'deliveries',
    'menus',
  ];

  const results = await Promise.all(
    moduleNames.map((name) => checkModuleHealth(name, tenantId))
  );

  const now = new Date();
  const modules: Record<string, ModuleHealthCheck> = {};

  for (const result of results) {
    modules[result.name] = {
      name: result.name,
      status: result.status,
      lastChecked: now,
      latencyMs: result.latencyMs,
      errorMessage: result.errorMessage,
    };
  }

  return modules;
}

/**
 * Calculate overall status based on individual module statuses
 */
function calculateOverallStatus(
  modules: Record<string, ModuleHealthCheck>
): ModuleStatus {
  const statuses = Object.values(modules).map((m) => m.status);

  if (statuses.some((s) => s === 'error')) {
    return 'error';
  }

  if (statuses.some((s) => s === 'degraded')) {
    return 'degraded';
  }

  if (statuses.every((s) => s === 'healthy')) {
    return 'healthy';
  }

  return 'unknown';
}

/**
 * Hook to check health/connectivity of each module
 *
 * @returns ModuleHealthSummary with status of each module and overall system health
 */
export function useModuleHealth(): ModuleHealthSummary {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...MODULE_HEALTH_QUERY_KEY, tenant?.id],
    queryFn: async (): Promise<Record<string, ModuleHealthCheck>> => {
      if (!tenant?.id) {
        return {};
      }

      return checkAllModulesHealth(tenant.id);
    },
    enabled: !!tenant?.id,
    staleTime: 60000, // 1 minute - health checks shouldn't be too frequent
    refetchInterval: 300000, // Refetch every 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on every focus to avoid spamming
  });

  const modules = data ?? {};

  const summary = useMemo(() => {
    const moduleList = Object.values(modules);
    const healthyCount = moduleList.filter((m) => m.status === 'healthy').length;
    const degradedCount = moduleList.filter((m) => m.status === 'degraded').length;
    const errorCount = moduleList.filter((m) => m.status === 'error').length;

    return {
      healthyCount,
      degradedCount,
      errorCount,
      totalModules: moduleList.length,
      overallStatus: calculateOverallStatus(modules),
    };
  }, [modules]);

  const checkModule = useCallback(
    async (moduleName: string): Promise<ModuleHealthCheck> => {
      if (!tenant?.id) {
        return {
          name: moduleName,
          status: 'unknown',
          lastChecked: new Date(),
          errorMessage: 'No tenant context',
        };
      }

      const result = await checkModuleHealth(moduleName as ModuleName, tenant.id);

      // Update the cache with the new result
      queryClient.setQueryData<Record<string, ModuleHealthCheck>>(
        [...MODULE_HEALTH_QUERY_KEY, tenant.id],
        (old) => ({
          ...old,
          [moduleName]: {
            name: result.name,
            status: result.status,
            lastChecked: new Date(),
            latencyMs: result.latencyMs,
            errorMessage: result.errorMessage,
          },
        })
      );

      return {
        name: result.name,
        status: result.status,
        lastChecked: new Date(),
        latencyMs: result.latencyMs,
        errorMessage: result.errorMessage,
      };
    },
    [tenant?.id, queryClient]
  );

  return {
    modules,
    ...summary,
    isLoading,
    error: error as Error | null,
    refetch,
    checkModule,
  };
}
