import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OptimisticLockResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  conflictDetected?: boolean;
}

type TableName = "products" | "orders" | "wholesale_orders" | "unified_orders" | "customers" | "wholesale_clients";

export const useOptimisticLock = (tableName: TableName) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateWithLock = useCallback(async (
    id: string,
    updates: Record<string, unknown>,
    expectedVersion: number
  ): Promise<OptimisticLockResult> => {
    setIsUpdating(true);
    try {
      const { data: current } = await supabase
        .from(tableName)
        .select("version")
        .eq("id", id)
        .single();

      const currentVersion = (current as { version?: number })?.version || 1;

      if (currentVersion !== expectedVersion) {
        toast.error("Record modified by another user. Please refresh.");
        return { success: false, error: "Version conflict", conflictDetected: true };
      }

      const { data: updated, error } = await supabase
        .from(tableName)
        .update({ ...updates, version: currentVersion + 1, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("version", expectedVersion)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data: updated as Record<string, unknown> };
    } finally {
      setIsUpdating(false);
    }
  }, [tableName]);

  const fetchWithVersion = useCallback(async (id: string) => {
    const { data } = await supabase.from(tableName).select("*").eq("id", id).single();
    return data as Record<string, unknown> | null;
  }, [tableName]);

  return { updateWithLock, fetchWithVersion, isUpdating };
};
