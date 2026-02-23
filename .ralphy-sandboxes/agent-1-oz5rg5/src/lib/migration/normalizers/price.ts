/**
 * Cannabis Price Normalizer
 * Parses and normalizes price formats with tier detection
 */

import { formatCurrency, formatCompactCurrency } from '@/lib/formatters';

export interface PriceResult {
  amount: number;
  tier?: 'lb' | 'hp' | 'qp' | 'oz' | 'unit';
  confidence: number;
  originalText: string;
}

export interface TieredPricing {
  lb?: number;
  hp?: number;
  qp?: number;
  oz?: number;
  unit?: number;
}

// Price patterns with tier indicators
const PRICE_PATTERNS = [
  // "$X,XXX/lb" or "$X.Xk/lb"
  { regex: /\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*k?\s*(?:\/|per)\s*(?:lb|pound)/i, tier: 'lb' as const },
  // "$XXX/oz" or "$XXX/zip"
  { regex: /\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:\/|per)\s*(?:oz|ounce|zip)/i, tier: 'oz' as const },
  // "$X,XXX/qp" or "qp: $X,XXX"
  { regex: /\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:\/|per)\s*(?:qp|quarter\s*pound)/i, tier: 'qp' as const },
  { regex: /(?:qp|quarter\s*pound)\s*:?\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i, tier: 'qp' as const },
  // "$X,XXX/hp" or "hp: $X,XXX"
  { regex: /\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:\/|per)\s*(?:hp|half\s*pound)/i, tier: 'hp' as const },
  { regex: /(?:hp|half\s*pound)\s*:?\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i, tier: 'hp' as const },
  // "lb: $X,XXX" format
  { regex: /(?:lb|pound)\s*:?\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i, tier: 'lb' as const },
  // "oz: $XXX" or "zip: $XXX" format
  { regex: /(?:oz|ounce|zip)\s*:?\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i, tier: 'oz' as const },
];

// K notation (e.g., "2.2k" = 2200)
const K_NOTATION_REGEX = /\$?\s*(\d+(?:\.\d+)?)\s*k\b/i;

/**
 * Parse a single price value
 */
export function parsePrice(text: string): PriceResult | null {
  if (!text) return null;
  
  const originalText = text;
  const normalized = text.trim();
  
  // Try tier-specific patterns first
  for (const pattern of PRICE_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (match) {
      let amount = parseFloat(match[1].replace(/,/g, ''));
      
      // Check for K notation in the match
      if (/k/i.test(match[0]) && amount < 100) {
        amount *= 1000;
      }
      
      return {
        amount,
        tier: pattern.tier,
        confidence: 0.9,
        originalText,
      };
    }
  }
  
  // Try K notation without tier
  const kMatch = normalized.match(K_NOTATION_REGEX);
  if (kMatch) {
    const amount = parseFloat(kMatch[1]) * 1000;
    return {
      amount,
      tier: inferTierFromAmount(amount),
      confidence: 0.7,
      originalText,
    };
  }
  
  // Try plain number
  const plainMatch = normalized.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (plainMatch) {
    const amount = parseFloat(plainMatch[1].replace(/,/g, ''));
    return {
      amount,
      tier: inferTierFromAmount(amount),
      confidence: 0.5,
      originalText,
    };
  }
  
  return null;
}

/**
 * Infer price tier from amount (heuristic)
 */
function inferTierFromAmount(amount: number): 'lb' | 'hp' | 'qp' | 'oz' | 'unit' | undefined {
  // These are rough estimates for wholesale cannabis pricing
  if (amount >= 1000) return 'lb';
  if (amount >= 500) return 'hp';
  if (amount >= 300) return 'qp';
  if (amount >= 50) return 'oz';
  return 'unit';
}

/**
 * Parse a string that may contain multiple prices for different tiers
 */
export function parseTieredPricing(text: string): TieredPricing {
  const result: TieredPricing = {};
  
  if (!text) return result;
  
  // Split by common separators
  const segments = text.split(/[,;|\/]|\band\b/i);
  
  for (const segment of segments) {
    const priceResult = parsePrice(segment.trim());
    if (priceResult?.tier) {
      result[priceResult.tier] = priceResult.amount;
    }
  }
  
  // If we only found one price without clear tier, try to infer from context
  if (Object.keys(result).length === 0) {
    const singlePrice = parsePrice(text);
    if (singlePrice) {
      const tier = singlePrice.tier || 'unit';
      result[tier] = singlePrice.amount;
    }
  }
  
  return result;
}

/**
 * Parse pricing from multiple columns
 */
export function parsePricingFromColumns(
  columns: Record<string, unknown>
): TieredPricing {
  const result: TieredPricing = {};
  
  // Check for specific tier columns
  const tierMappings: Array<{ keys: string[]; tier: keyof TieredPricing }> = [
    { keys: ['lb', 'pound', 'perlb', 'price_lb', 'lb_price'], tier: 'lb' },
    { keys: ['hp', 'halfpound', 'half_pound', 'perhp'], tier: 'hp' },
    { keys: ['qp', 'quarterpound', 'quarter_pound', 'perqp'], tier: 'qp' },
    { keys: ['oz', 'ounce', 'zip', 'peroz', 'oz_price'], tier: 'oz' },
    { keys: ['unit', 'each', 'price', 'cost'], tier: 'unit' },
  ];
  
  for (const mapping of tierMappings) {
    for (const key of mapping.keys) {
      const normalizedKey = key.toLowerCase();
      for (const [colKey, value] of Object.entries(columns)) {
        if (colKey.toLowerCase().includes(normalizedKey) && value) {
          const priceResult = parsePrice(String(value));
          if (priceResult && !result[mapping.tier]) {
            result[mapping.tier] = priceResult.amount;
          }
        }
      }
    }
  }
  
  return result;
}

/**
 * Calculate per-unit price from bulk pricing
 */
export function calculatePerUnitPrice(pricing: TieredPricing): number | null {
  // Prefer smaller quantities for per-unit calculation
  if (pricing.unit) return pricing.unit;
  if (pricing.oz) return pricing.oz / 28; // Per gram
  if (pricing.qp) return pricing.qp / (28 * 4);
  if (pricing.hp) return pricing.hp / (28 * 8);
  if (pricing.lb) return pricing.lb / 453.6; // Per gram
  return null;
}

/**
 * Calculate price per pound from any tier
 */
export function calculatePricePerPound(pricing: TieredPricing): number | null {
  if (pricing.lb) return pricing.lb;
  if (pricing.hp) return pricing.hp * 2;
  if (pricing.qp) return pricing.qp * 4;
  if (pricing.oz) return pricing.oz * 16;
  return null;
}

/**
 * Validate pricing makes sense (e.g., bulk should be cheaper per unit)
 */
export function validatePricing(pricing: TieredPricing): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  const pricePerPound = calculatePricePerPound(pricing);
  
  // Check for unusually low or high prices
  if (pricePerPound) {
    if (pricePerPound < 500) {
      warnings.push('Price per pound is unusually low (< $500). Please verify.');
    }
    if (pricePerPound > 5000) {
      warnings.push('Price per pound is unusually high (> $5,000). Please verify.');
    }
  }
  
  // Check that bulk prices have appropriate discount
  if (pricing.lb && pricing.oz) {
    const ozEquivalent = pricing.oz * 16;
    if (pricing.lb >= ozEquivalent) {
      warnings.push('Pound price should be less than 16x ounce price (volume discount expected).');
    }
  }
  
  if (pricing.qp && pricing.oz) {
    const ozEquivalent = pricing.oz * 4;
    if (pricing.qp >= ozEquivalent) {
      warnings.push('QP price should be less than 4x ounce price (volume discount expected).');
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Format price for display
 */
export function formatPrice(amount: number): string {
  if (amount >= 1000) {
    return formatCompactCurrency(amount);
  }
  return formatCurrency(amount);
}

/**
 * Format tiered pricing for display
 */
export function formatTieredPricing(pricing: TieredPricing): string {
  const parts: string[] = [];
  
  if (pricing.lb) parts.push(`${formatPrice(pricing.lb)}/lb`);
  if (pricing.hp) parts.push(`${formatPrice(pricing.hp)}/hp`);
  if (pricing.qp) parts.push(`${formatPrice(pricing.qp)}/qp`);
  if (pricing.oz) parts.push(`${formatPrice(pricing.oz)}/oz`);
  if (pricing.unit) parts.push(`${formatPrice(pricing.unit)}/unit`);
  
  return parts.join(' | ') || 'No pricing';
}




