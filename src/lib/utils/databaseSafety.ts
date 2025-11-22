import { logger } from '@/lib/logger';
/**
 * Database Safety Utilities
 * Provides safe access to potentially missing database columns
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Check if a column exists in a table
 * Returns true if column exists, false otherwise
 */
export async function columnExists(
  table: string,
  column: string
): Promise<boolean> {
  try {
    // Try to select the column - if it doesn't exist, Supabase will return an error
    const { error } = await supabase
      .from(table as any)
      .select(column)
      .limit(0);
    
    // Error code 42703 means "undefined column"
    if (error && error.code === "42703") {
      return false;
    }
    
    // Any other error might mean table doesn't exist, but we'll assume column doesn't exist
    if (error) {
      logger.warn(`Error checking column ${column} in ${table}`, error instanceof Error ? error : new Error(String(error)), { table, column, component: 'databaseSafety' });
      return false;
    }
    
    return true;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.warn(`Exception checking column ${column} in ${table}`, errorObj, { table, column, component: 'databaseSafety' });
    return false;
  }
}

/**
 * Check if a table exists
 */
export async function tableExists(table: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table as any).select("*").limit(0);
    // If we can query it, it exists (even if error is something else)
    return error === null || error.code !== "42P01"; // 42P01 = table does not exist
  } catch {
    return false;
  }
}

/**
 * Safe select that handles missing columns gracefully
 */
export async function safeSelect<T>(
  table: string,
  columns: string[],
  filters?: Record<string, any>
): Promise<T | null> {
  try {
    // Filter out columns that don't exist
    const existingColumns = await Promise.all(
      columns.map((col) => columnExists(table, col))
    );
    
    const validColumns = columns.filter((_, i) => existingColumns[i]);
    
    if (validColumns.length === 0) {
      return null;
    }
    
    let query = supabase.from(table as any).select(validColumns.join(", "));
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error) {
      // If it's a column error, return null (column doesn't exist)
      if (error.code === "42703") {
        return null;
      }
      throw error;
    }
    
    return data as T;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.warn(`Error in safeSelect for ${table}`, errorObj, { table, component: 'databaseSafety' });
    return null;
  }
}

/**
 * Safe update that only updates existing columns
 */
export async function safeUpdate(
  table: string,
  id: string,
  updates: Record<string, any>
): Promise<{ success: boolean; error?: any }> {
  try {
    // Check which columns exist
    const columnChecks = await Promise.all(
      Object.keys(updates).map((col) => columnExists(table, col))
    );
    
    const validUpdates: Record<string, any> = {};
    Object.keys(updates).forEach((col, i) => {
      if (columnChecks[i]) {
        validUpdates[col] = updates[col];
      }
    });
    
    if (Object.keys(validUpdates).length === 0) {
      return { success: true }; // Nothing to update, but that's okay
    }
    
    const { error } = await supabase
      .from(table as any)
      .update(validUpdates)
      .eq("id", id);
    
    if (error) {
      // If column doesn't exist error, ignore it
      if (error.code === "42703") {
        return { success: true };
      }
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.warn(`Error in safeUpdate for ${table}`, errorObj, { table, component: 'databaseSafety' });
    return { success: false, error: errorObj };
  }
}

