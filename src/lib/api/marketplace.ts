// @ts-nocheck
import { logger } from '@/lib/logger';
/**
 * Marketplace API Functions
 * Helper functions for marketplace listings (used in forum product posts)
 */

import { supabase } from '@/integrations/supabase/client';

export interface MarketplaceListing {
  id: string;
  product_name: string;
  base_price: number;
  images: string[];
  description: string | null;
  product_type: string | null;
  strain_type: string | null;
  marketplace_profiles?: {
    id: string;
    business_name: string;
    verified_badge: boolean;
  };
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
        strain_type,
        marketplace_profiles!inner (
          id,
          business_name,
          verified_badge
        )
      `)
      .eq('status', 'active')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch marketplace listings', error, { component: 'marketplaceApi', action: 'getActiveMarketplaceListings' });
      throw error;
    }

    return (data || []) as MarketplaceListing[];
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
        strain_type,
        marketplace_profiles (
          id,
          business_name,
          verified_badge
        )
      `)
      .eq('id', listingId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch marketplace listing', error, { component: 'marketplaceApi', action: 'getMarketplaceListingById', listingId });
      throw error;
    }

    return data as MarketplaceListing | null;
  } catch (error) {
    logger.error('Error in getMarketplaceListingById', error, { component: 'marketplaceApi', listingId });
    throw error;
  }
}

