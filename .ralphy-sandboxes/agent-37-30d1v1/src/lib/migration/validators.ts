/**
 * Validation Schemas and Business Rule Validators
 * Zod schemas for parsed product validation
 */

import { z } from 'zod';
import type { ParsedProduct, ValidationResult, ValidationError, ValidationWarning } from '@/types/migration';

// Zod schemas for product validation
export const PricesSchema = z.object({
  lb: z.number().positive().max(10000).optional(),
  hp: z.number().positive().max(6000).optional(),
  qp: z.number().positive().max(3000).optional(),
  oz: z.number().positive().max(1000).optional(),
  unit: z.number().positive().max(500).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one price tier is required',
});

export const ParsedProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  category: z.enum(['flower', 'concentrate', 'edible', 'preroll', 'vape', 'tincture', 'topical', 'seed', 'clone', 'accessory', 'other']).optional(),
  strainType: z.enum(['indica', 'sativa', 'hybrid']).nullable().optional(),
  thcPercentage: z.number().min(0).max(100).nullable().optional(),
  cbdPercentage: z.number().min(0).max(100).nullable().optional(),
  prices: PricesSchema.optional(),
  quantityLbs: z.number().positive().optional(),
  quantityUnits: z.number().int().positive().optional(),
  lineage: z.string().max(500).optional(),
  terpenes: z.array(z.string()).optional(),
  growInfo: z.string().max(100).optional(),
  qualityTier: z.enum(['exotic', 'indoor', 'greenhouse', 'outdoor']).optional(),
  stockStatus: z.enum(['available', 'limited', 'out']).optional(),
  notes: z.string().max(1000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  rawData: z.record(z.unknown()).optional(),
});

export type ValidatedProduct = z.infer<typeof ParsedProductSchema>;

/**
 * Validate a single product
 */
export function validateProduct(product: Partial<ParsedProduct>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation
  const schemaResult = ParsedProductSchema.safeParse(product);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
        code: 'SCHEMA_VALIDATION',
      });
    }
  }

  // Business rule validation
  const businessRules = validateBusinessRules(product);
  errors.push(...businessRules.errors);
  warnings.push(...businessRules.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate business rules for a product
 */
function validateBusinessRules(product: Partial<ParsedProduct>): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields check
  if (!product.name?.trim()) {
    errors.push({
      field: 'name',
      message: 'Product name is required',
      code: 'REQUIRED_FIELD',
    });
  }

  // THC validation
  if (product.thcPercentage !== undefined && product.thcPercentage !== null) {
    if (product.thcPercentage > 35) {
      warnings.push({
        field: 'thcPercentage',
        message: `THC ${product.thcPercentage}% is unusually high. Most cannabis is under 35%. Please verify.`,
        code: 'THC_HIGH',
        suggestedValue: product.thcPercentage > 50 ? product.thcPercentage / 10 : undefined,
      });
    }
    if (product.thcPercentage < 5 && product.category === 'flower') {
      warnings.push({
        field: 'thcPercentage',
        message: `THC ${product.thcPercentage}% is very low for flower. This might be CBD flower or hemp.`,
        code: 'THC_LOW',
      });
    }
  }

  // CBD validation
  if (product.cbdPercentage !== undefined && product.cbdPercentage !== null) {
    if (product.cbdPercentage > 25) {
      warnings.push({
        field: 'cbdPercentage',
        message: `CBD ${product.cbdPercentage}% is unusually high. Please verify.`,
        code: 'CBD_HIGH',
      });
    }
  }

  // Price validation
  if (product.prices) {
    const prices = product.prices;

    // Check for pricing consistency (bulk should be cheaper per unit)
    if (prices.lb && prices.oz) {
      const lbPerOz = prices.lb / 16;
      if (lbPerOz >= prices.oz) {
        warnings.push({
          field: 'prices',
          message: 'Pound price per ounce should be less than single ounce price (volume discount expected)',
          code: 'PRICING_INCONSISTENT',
        });
      }
    }

    if (prices.qp && prices.oz) {
      const qpPerOz = prices.qp / 4;
      if (qpPerOz >= prices.oz) {
        warnings.push({
          field: 'prices',
          message: 'QP price per ounce should be less than single ounce price',
          code: 'PRICING_INCONSISTENT',
        });
      }
    }

    // Check for unusually low prices (potential quality concern)
    if (prices.lb && prices.lb < 500) {
      warnings.push({
        field: 'prices.lb',
        message: `Price $${prices.lb}/lb is unusually low. Verify quality and legality.`,
        code: 'PRICE_LOW',
      });
    }

    // Check for unusually high prices
    if (prices.lb && prices.lb > 4000) {
      warnings.push({
        field: 'prices.lb',
        message: `Price $${prices.lb}/lb is very high. Please verify.`,
        code: 'PRICE_HIGH',
      });
    }

    // Check for reasonable per-ounce pricing
    if (prices.oz && (prices.oz < 20 || prices.oz > 500)) {
      warnings.push({
        field: 'prices.oz',
        message: `Price $${prices.oz}/oz seems unusual. Please verify.`,
        code: 'PRICE_UNUSUAL',
      });
    }
  } else {
    warnings.push({
      field: 'prices',
      message: 'No pricing information provided',
      code: 'NO_PRICING',
    });
  }

  // Category-specific validation
  if (product.category === 'concentrate' && product.thcPercentage && product.thcPercentage < 50) {
    warnings.push({
      field: 'thcPercentage',
      message: 'Concentrates typically have THC > 50%. This might be flower or a different category.',
      code: 'CATEGORY_MISMATCH',
    });
  }

  // Strain type consistency
  if (product.strainType && product.category && !['flower', 'concentrate', 'preroll'].includes(product.category)) {
    warnings.push({
      field: 'strainType',
      message: `Strain type is typically not applicable to ${product.category}`,
      code: 'STRAIN_TYPE_MISMATCH',
    });
  }

  return { errors, warnings };
}

/**
 * Validate a batch of products
 */
export function validateProducts(products: Partial<ParsedProduct>[]): {
  results: Array<{ index: number; product: Partial<ParsedProduct>; validation: ValidationResult }>;
  summary: {
    total: number;
    valid: number;
    withErrors: number;
    withWarnings: number;
  };
} {
  const results = products.map((product, index) => ({
    index,
    product,
    validation: validateProduct(product),
  }));

  const summary = {
    total: products.length,
    valid: results.filter(r => r.validation.valid).length,
    withErrors: results.filter(r => r.validation.errors.length > 0).length,
    withWarnings: results.filter(r => r.validation.warnings.length > 0).length,
  };

  return { results, summary };
}

/**
 * Auto-fix common validation issues
 */
export function autoFixProduct(product: Partial<ParsedProduct>): {
  fixed: Partial<ParsedProduct>;
  changes: Array<{ field: string; original: unknown; fixed: unknown; reason: string }>;
} {
  const fixed = { ...product };
  const changes: Array<{ field: string; original: unknown; fixed: unknown; reason: string }> = [];

  // Fix THC that might be misread (e.g., 250 should be 25.0)
  if (fixed.thcPercentage && fixed.thcPercentage > 50) {
    const original = fixed.thcPercentage;
    fixed.thcPercentage = fixed.thcPercentage / 10;
    changes.push({
      field: 'thcPercentage',
      original,
      fixed: fixed.thcPercentage,
      reason: 'THC value too high, divided by 10',
    });
  }

  // Trim and clean name
  if (fixed.name) {
    const original = fixed.name;
    const cleaned = fixed.name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s#\-']/g, '');
    if (cleaned !== original) {
      fixed.name = cleaned;
      changes.push({
        field: 'name',
        original,
        fixed: cleaned,
        reason: 'Cleaned special characters and whitespace',
      });
    }
  }

  // Set default category if missing but can be inferred
  if (!fixed.category && fixed.name) {
    const lowerName = fixed.name.toLowerCase();
    if (/\b(wax|shatter|budder|resin|rosin|hash|diamonds)\b/.test(lowerName)) {
      fixed.category = 'concentrate';
      changes.push({
        field: 'category',
        original: undefined,
        fixed: 'concentrate',
        reason: 'Inferred from product name',
      });
    } else if (/\b(cart|cartridge|vape|pod|disposable)\b/.test(lowerName)) {
      fixed.category = 'vape';
      changes.push({
        field: 'category',
        original: undefined,
        fixed: 'vape',
        reason: 'Inferred from product name',
      });
    } else if (/\b(pre\s*roll|joint|blunt)\b/.test(lowerName)) {
      fixed.category = 'preroll';
      changes.push({
        field: 'category',
        original: undefined,
        fixed: 'preroll',
        reason: 'Inferred from product name',
      });
    }
  }

  // Default to flower for wholesale if no category
  if (!fixed.category) {
    fixed.category = 'flower';
    changes.push({
      field: 'category',
      original: undefined,
      fixed: 'flower',
      reason: 'Defaulted to flower (most common wholesale category)',
    });
  }

  return { fixed, changes };
}

/**
 * Calculate overall confidence score for a product
 */
export function calculateConfidenceScore(product: Partial<ParsedProduct>): number {
  let score = 0;
  let maxScore = 0;

  // Name (required, high weight)
  maxScore += 30;
  if (product.name?.trim()) score += 30;

  // Category
  maxScore += 15;
  if (product.category) score += 15;

  // Pricing (important for wholesale)
  maxScore += 25;
  if (product.prices) {
    const priceCount = Object.keys(product.prices).length;
    score += Math.min(priceCount * 8, 25);
  }

  // THC percentage
  maxScore += 10;
  if (product.thcPercentage !== undefined && product.thcPercentage !== null) {
    score += 10;
  }

  // Strain type
  maxScore += 10;
  if (product.strainType) score += 10;

  // Additional info (lineage, terpenes, grow info)
  maxScore += 10;
  if (product.lineage) score += 3;
  if (product.terpenes?.length) score += 4;
  if (product.growInfo) score += 3;

  return Math.round((score / maxScore) * 100) / 100;
}




