import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface OptimisticLockResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  conflictDetected?: boolean;
}

type TableName = "products" | "orders" | "wholesale_orders" | "unified_orders" | "customers" | "wholesale_clients";

export const useOptimisticLock = (tableName: TableName, tenantId?: string) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateWithLock = useCallback(async (
    id: string,
    updates: Record<string, unknown>,
    expectedVersion: number
  ): Promise<OptimisticLockResult> => {
    if (!tenantId) {
      return { success: false, error: "Tenant context required" };
    }
    setIsUpdating(true);
    try {
      // Single atomic conditional update - avoids TOCTOU race condition
      const { data: updated, error } = await (supabase as any)
        .from(tableName)
        .update({ ...updates, version: expectedVersion + 1, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .eq("version", expectedVersion)
        .select()
        .maybeSingle();

      if (error) {
        logger.error("Optimistic lock update failed", error);
        return { success: false, error: error.message };
      }

      if (!updated) {
        toast.error("Record modified by another user. Please refresh.");
        return { success: false, error: "Version conflict", conflictDetected: true };
      }

      return { success: true, data: updated as Record<string, unknown> };
    } finally {
      setIsUpdating(false);
    }
  }, [tableName, tenantId]);

  const fetchWithVersion = useCallback(async (id: string) => {
    if (!tenantId) return null;
    const { data } = await (supabase as any)
      .from(tableName)
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return data as Record<string, unknown> | null;
  }, [tableName, tenantId]);

  return { updateWithLock, fetchWithVersion, isUpdating };
};
