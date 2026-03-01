/**
 * Untyped Supabase client for tables/RPCs not in generated types.
 * 
 * Usage: Import `db` instead of `supabase` when accessing tables
 * that aren't in the auto-generated types file.
 * 
 * Example:
 *   import { db } from '@/lib/supabaseUntyped';
 *   const { data } = await db.from('my_untyped_table').select('*');
 */
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;
