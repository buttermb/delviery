import { logger } from '@/lib/logger';
/**
 * SKU Auto-Generation Utilities
 * Handles automatic SKU generation with category prefixes
 */

import { supabase } from '@/integrations/supabase/client';

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
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('category', category);

    if (error) {
      logger.warn('Product count failed, using timestamp SKU', { error, component: 'skuGenerator' });
      return generateTimestampBasedSKU(category);
    }

    // Generate SKU with category prefix and sequential number
    const prefix = getCategoryPrefix(category);
    const number = String((count || 0) + 1).padStart(4, '0');
    return `${prefix}-${number}`;
  } catch (error) {
    logger.error('SKU generation error', error, {
      component: 'skuGenerator',
    });
    return generateTimestampBasedSKU(category);
  }
}

/**
 * Generate timestamp-based SKU as fallback
 */
function generateTimestampBasedSKU(category: string): string {
  const prefix = getCategoryPrefix(category);
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Validate SKU format
 */
export function validateSKU(sku: string): boolean {
  // Format: PREFIX-#### (e.g., FLOW-0093)
  const skuPattern = /^[A-Z]{2,4}-\d{4,}$/;
  return skuPattern.test(sku);
}

