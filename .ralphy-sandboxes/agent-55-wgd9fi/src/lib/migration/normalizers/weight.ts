/**
 * Cannabis Weight Normalizer
 * Converts various weight formats to standard units
 */

export interface WeightResult {
  grams: number;
  ounces: number;
  pounds: number;
  displayUnit: 'g' | 'oz' | 'lb';
  displayValue: number;
  originalText: string;
}

// Standard conversions
const GRAMS_PER_OUNCE = 28.3495;
const OUNCES_PER_POUND = 16;
const GRAMS_PER_POUND = GRAMS_PER_OUNCE * OUNCES_PER_POUND;

// Cannabis-specific weight aliases
const WEIGHT_PATTERNS: Record<string, { grams: number; unit: 'g' | 'oz' | 'lb' }> = {
  // Grams
  'g': { grams: 1, unit: 'g' },
  'gram': { grams: 1, unit: 'g' },
  'grams': { grams: 1, unit: 'g' },
  'gr': { grams: 1, unit: 'g' },
  
  // Eighths (3.5g)
  'eighth': { grams: 3.5, unit: 'g' },
  '8th': { grams: 3.5, unit: 'g' },
  '1/8': { grams: 3.5, unit: 'g' },
  '⅛': { grams: 3.5, unit: 'g' },
  
  // Quarters (7g)
  'quarter': { grams: 7, unit: 'g' },
  'q': { grams: 7, unit: 'g' },
  '1/4': { grams: 7, unit: 'g' },
  '¼': { grams: 7, unit: 'g' },
  
  // Half ounces (14g)
  'half': { grams: 14, unit: 'oz' },
  'half oz': { grams: 14, unit: 'oz' },
  'half ounce': { grams: 14, unit: 'oz' },
  '1/2': { grams: 14, unit: 'oz' },
  '½': { grams: 14, unit: 'oz' },
  
  // Ounces (28g)
  'oz': { grams: GRAMS_PER_OUNCE, unit: 'oz' },
  'ounce': { grams: GRAMS_PER_OUNCE, unit: 'oz' },
  'ounces': { grams: GRAMS_PER_OUNCE, unit: 'oz' },
  'zip': { grams: GRAMS_PER_OUNCE, unit: 'oz' },
  'zips': { grams: GRAMS_PER_OUNCE, unit: 'oz' },
  'z': { grams: GRAMS_PER_OUNCE, unit: 'oz' },
  'o': { grams: GRAMS_PER_OUNCE, unit: 'oz' },
  
  // Quarter pounds (QP = 4oz = 113g)
  'qp': { grams: GRAMS_PER_OUNCE * 4, unit: 'lb' },
  'quarter pound': { grams: GRAMS_PER_OUNCE * 4, unit: 'lb' },
  'quarterpound': { grams: GRAMS_PER_OUNCE * 4, unit: 'lb' },
  '1/4 lb': { grams: GRAMS_PER_OUNCE * 4, unit: 'lb' },
  '1/4 pound': { grams: GRAMS_PER_OUNCE * 4, unit: 'lb' },
  
  // Half pounds (HP = 8oz = 226g)
  'hp': { grams: GRAMS_PER_OUNCE * 8, unit: 'lb' },
  'half pound': { grams: GRAMS_PER_OUNCE * 8, unit: 'lb' },
  'halfpound': { grams: GRAMS_PER_OUNCE * 8, unit: 'lb' },
  '1/2 lb': { grams: GRAMS_PER_OUNCE * 8, unit: 'lb' },
  '1/2 pound': { grams: GRAMS_PER_OUNCE * 8, unit: 'lb' },
  
  // Pounds
  'lb': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'lbs': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'pound': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'pounds': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'pack': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'p': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'unit': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'elbow': { grams: GRAMS_PER_POUND, unit: 'lb' },
  'bow': { grams: GRAMS_PER_POUND, unit: 'lb' },
};

/**
 * Parse weight from text
 */
export function parseWeight(text: string): WeightResult | null {
  if (!text) return null;
  
  const originalText = text;
  const normalized = text.toLowerCase().trim();
  
  // Try to match "number unit" pattern
  const numberUnitMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (numberUnitMatch) {
    const quantity = parseFloat(numberUnitMatch[1]);
    const unit = numberUnitMatch[2].trim();
    
    const weightInfo = WEIGHT_PATTERNS[unit];
    if (weightInfo) {
      const totalGrams = quantity * weightInfo.grams;
      return createWeightResult(totalGrams, weightInfo.unit, originalText);
    }
  }
  
  // Try to match "unit number" pattern (e.g., "oz 5")
  const unitNumberMatch = normalized.match(/^(.+?)\s*(\d+(?:\.\d+)?)$/);
  if (unitNumberMatch) {
    const unit = unitNumberMatch[1].trim();
    const quantity = parseFloat(unitNumberMatch[2]);
    
    const weightInfo = WEIGHT_PATTERNS[unit];
    if (weightInfo) {
      const totalGrams = quantity * weightInfo.grams;
      return createWeightResult(totalGrams, weightInfo.unit, originalText);
    }
  }
  
  // Try direct unit match (e.g., just "qp" or "zip")
  const weightInfo = WEIGHT_PATTERNS[normalized];
  if (weightInfo) {
    return createWeightResult(weightInfo.grams, weightInfo.unit, originalText);
  }
  
  // Try to parse as plain number (assume grams if < 100, ounces if >= 100)
  const plainNumber = parseFloat(normalized);
  if (!isNaN(plainNumber)) {
    if (plainNumber < 100) {
      return createWeightResult(plainNumber, 'g', originalText);
    } else {
      // Likely ounces if >= 100
      return createWeightResult(plainNumber * GRAMS_PER_OUNCE, 'oz', originalText);
    }
  }
  
  return null;
}

/**
 * Create weight result object
 */
function createWeightResult(grams: number, displayUnit: 'g' | 'oz' | 'lb', originalText: string): WeightResult {
  const ounces = grams / GRAMS_PER_OUNCE;
  const pounds = grams / GRAMS_PER_POUND;
  
  let displayValue: number;
  switch (displayUnit) {
    case 'g':
      displayValue = grams;
      break;
    case 'oz':
      displayValue = ounces;
      break;
    case 'lb':
      displayValue = pounds;
      break;
  }
  
  return {
    grams: Math.round(grams * 100) / 100,
    ounces: Math.round(ounces * 100) / 100,
    pounds: Math.round(pounds * 1000) / 1000,
    displayUnit,
    displayValue: Math.round(displayValue * 100) / 100,
    originalText,
  };
}

/**
 * Convert weight to different unit
 */
export function convertWeight(grams: number, toUnit: 'g' | 'oz' | 'lb'): number {
  switch (toUnit) {
    case 'g':
      return grams;
    case 'oz':
      return grams / GRAMS_PER_OUNCE;
    case 'lb':
      return grams / GRAMS_PER_POUND;
  }
}

/**
 * Format weight for display
 */
export function formatWeight(grams: number, preferredUnit?: 'g' | 'oz' | 'lb'): string {
  // Auto-select unit based on size
  let unit = preferredUnit;
  if (!unit) {
    if (grams >= GRAMS_PER_POUND) {
      unit = 'lb';
    } else if (grams >= GRAMS_PER_OUNCE) {
      unit = 'oz';
    } else {
      unit = 'g';
    }
  }
  
  const value = convertWeight(grams, unit);
  const rounded = Math.round(value * 100) / 100;
  
  return `${rounded}${unit}`;
}

/**
 * Parse quantity string that may include multiple units
 * e.g., "5 lbs 3 oz" or "2 pounds"
 */
export function parseQuantityString(text: string): { lbs?: number; units?: number } | null {
  if (!text) return null;
  
  const normalized = text.toLowerCase().trim();
  let lbs = 0;
  let units = 0;
  
  // Try to match "X lbs Y oz" pattern
  const lbsOzMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\s*(?:(\d+(?:\.\d+)?)\s*(?:oz|ounces?)?)?/i);
  if (lbsOzMatch) {
    lbs = parseFloat(lbsOzMatch[1]);
    if (lbsOzMatch[2]) {
      // Convert extra ounces to partial pounds
      lbs += parseFloat(lbsOzMatch[2]) / OUNCES_PER_POUND;
    }
    return { lbs: Math.round(lbs * 1000) / 1000 };
  }
  
  // Try to match just ounces
  const ozMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounces?|zips?)/i);
  if (ozMatch) {
    const oz = parseFloat(ozMatch[1]);
    return { lbs: oz / OUNCES_PER_POUND };
  }
  
  // Try to match units (plain number)
  const unitsMatch = normalized.match(/^(\d+)(?:\s*(?:units?|pcs?|pieces?))?$/i);
  if (unitsMatch) {
    units = parseInt(unitsMatch[1], 10);
    return { units };
  }
  
  return null;
}




