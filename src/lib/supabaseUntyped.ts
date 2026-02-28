/**
 * Untyped Supabase Client Helper
 *
 * For tables/RPCs not yet in auto-generated types (e.g. referral_codes,
 * promo_codes, menu_security_events, marketplace_*, custom_domains, etc.)
 *
 * Usage:  import { untypedClient } from '@/lib/supabaseUntyped';
 *         const { data } = await untypedClient.from('referral_codes').select('*');
 */
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cast once here so every consumer avoids `as any`
export const untypedClient = supabase as unknown as SupabaseClient;
