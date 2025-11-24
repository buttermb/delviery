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
    const prefix = getCategoryPrefix(category);
    
    // Query existing SKUs with this prefix to find the highest number
    const { data: existingProducts, error } = await supabase
      .from('products')
      .select('sku')
      .eq('tenant_id', tenantId)
      .eq('category', category)
      .like('sku', `${prefix}-%`);

    if (error) {
      logger.warn('SKU query failed, using timestamp SKU', { error, component: 'skuGenerator' });
      return generateTimestampBasedSKU(category);
    }

    // Extract numbers from existing SKUs and find the maximum
    let maxNumber = 0;
    if (existingProducts && existingProducts.length > 0) {
      existingProducts.forEach((product) => {
        if (product.sku) {
          const match = product.sku.match(new RegExp(`^${prefix}-(\\d+)`));
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        }
      });
    }

    // Generate SKU with next sequential number
    const number = String(maxNumber + 1).padStart(4, '0');
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

