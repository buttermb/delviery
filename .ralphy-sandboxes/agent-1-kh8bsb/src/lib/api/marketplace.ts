import { logger } from '@/lib/logger';
/**
 * Marketplace API Functions
 * Helper functions for marketplace listings (used in forum product posts)
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Marketplace profile data returned from joins
 */
interface MarketplaceProfileData {
  id: string;
  business_name: string | null;
  verified_badge?: boolean | null;
}

/**
 * Public interface for marketplace listing data
 */
export interface MarketplaceListing {
  id: string;
  product_name: string;
  base_price: number;
  images: string[] | null;
  description: string | null;
  product_type: string | null;
  strain_name: string | null;
  marketplace_profiles?: MarketplaceProfileData | null;
}

/**
 * Get active marketplace listings for product post selection
 */
export async function getActiveMarketplaceListings(limit = 50): Promise<MarketplaceListing[]> {
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select(`
        id,
        product_name,
        base_price,
        images,
        description,
        product_type,
        strain_name,
        marketplace_profiles (
          id,
          business_name
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch marketplace listings', error, { component: 'marketplaceApi', action: 'getActiveMarketplaceListings' });
      throw error;
    }

    return (data || []) as unknown as MarketplaceListing[];
  } catch (error) {
    logger.error('Error in getActiveMarketplaceListings', error, { component: 'marketplaceApi' });
    throw error;
  }
}

/**
 * Get a single marketplace listing by ID
 */
export async function getMarketplaceListingById(listingId: string): Promise<MarketplaceListing | null> {
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select(`
        id,
        product_name,
        base_price,
        images,
        description,
        product_type,
        strain_name,
        marketplace_profiles (
          id,
          business_name
        )
      `)
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch marketplace listing', error, { component: 'marketplaceApi', action: 'getMarketplaceListingById', listingId });
      throw error;
    }

    return data as unknown as MarketplaceListing | null;
  } catch (error) {
    logger.error('Error in getMarketplaceListingById', error, { component: 'marketplaceApi', listingId });
    throw error;
  }
}

