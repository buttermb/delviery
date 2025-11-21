/**
 * Extended Marketplace Listing Type
 * Adds properties from recent database migrations
 */

import { Database } from '@/integrations/supabase/types';

export type MarketplaceListing = Database['public']['Tables']['marketplace_listings']['Row'] & {
  lab_results?: {
    thc_percentage?: number;
    cbd_percentage?: number;
    terpenes?: string[];
    contaminants?: string[];
    batch_number?: string;
    test_date?: string;
  } | null;
  visibility?: 'public' | 'private' | 'hidden';
  tags?: string[];
  unit_type?: 'gram' | 'ounce' | 'pound' | 'unit';
  min_order_quantity?: number;
  max_order_quantity?: number;
  bulk_pricing?: Array<{
    min_quantity: number;
    max_quantity?: number;
    price: number;
    discount_percentage?: number;
  }>;
};
