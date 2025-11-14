/**
 * Safe Marketplace Query Utilities
 * Temporary helper to handle marketplace table queries until types.ts regenerates
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Safely query marketplace tables with proper type casting
 * This is a temporary solution until types.ts includes marketplace tables
 */
export function safeMarketplaceQuery(supabase: SupabaseClient, table: string) {
  return (supabase as any).from(table);
}
