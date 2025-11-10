/**
 * SKU Auto-Generation Utilities
 * Handles automatic SKU generation with category prefixes
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface CategoryPrefix {
  [key: string]: string;
}

// Category to prefix mapping
export const CATEGORY_PREFIXES: CategoryPrefix = {
  flower: 'FLOW',
  vapes: 'VAPE',
  edibles: 'EDIB',
  concentrates: 'CONC',
};

/**
 * Get prefix for a category
 */
export function getCategoryPrefix(category: string): string {
  const normalizedCategory = category.toLowerCase();
  return CATEGORY_PREFIXES[normalizedCategory] || 'PRD';
}

/**
 * Generate SKU for a product using database function
 */
export async function generateProductSKU(
  category: string,
  tenantId: string
): Promise<string> {
  try {
    // Get count of products in this category for this tenant
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('category', category);

    if (error) {
      logger.error('Failed to count products for SKU generation', error, {
        component: 'skuGenerator',
        category,
        tenantId,
      });
      throw error;
    }

    // Generate SKU with category prefix and sequential number
    const prefix = getCategoryPrefix(category);
    const number = String((count || 0) + 1).padStart(4, '0');
    return `${prefix}-${number}`;
  } catch (error) {
    logger.error('SKU generation error', error, {
      component: 'skuGenerator',
    });
    // Fallback: timestamp-based SKU
    const prefix = getCategoryPrefix(category);
    const timestamp = Date.now().toString().slice(-8);
    return `${prefix}-${timestamp}`;
  }
}

/**
 * Validate SKU format
 */
export function validateSKU(sku: string): boolean {
  // Format: PREFIX-#### (e.g., FLOW-0093)
  const skuPattern = /^[A-Z]{2,4}-\d{4,}$/;
  return skuPattern.test(sku);
}

