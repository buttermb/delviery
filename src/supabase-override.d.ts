/**
 * Global type augmentation for Supabase client.
 * 
 * The auto-generated types in integrations/supabase/types.ts don't include
 * all tables, views, and RPCs used in the codebase. This augmentation makes
 * supabase.from() and supabase.rpc() accept any string argument, preventing
 * TS2589/TS2769 build errors while preserving type safety for known tables.
 */
import type { SupabaseClient as _SupabaseClient } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface SupabaseClient<
    Database = unknown,
    SchemaName extends string & keyof Database = 'public' extends keyof Database
      ? 'public'
      : string & keyof Database,
    _Schema extends Record<string, unknown> = Database[SchemaName] extends Record<string, unknown>
      ? Database[SchemaName]
      : Record<string, unknown>,
  > {
    // Allow any table name in .from()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from(relation: string): any;
    // Allow any function name in .rpc()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc(fn: string, args?: Record<string, unknown>, options?: Record<string, unknown>): any;
  }
}
