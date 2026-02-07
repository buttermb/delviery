/**
 * Text Parser for Informal Cannabis Menus
 * Parses text formats like: "gary p - 32 - 15 packs"
 */

import { lookupStrain, type StrainInfo } from './normalizers/strain';
import type { ParsedProduct, QualityTier, CannabisCategory } from '@/types/migration';

// ==================== Abbreviation Database ====================

const STRAIN_ABBREVIATIONS: Record<string, string> = {
  // Common abbreviations
  'gary p': 'Gary Payton',
  'gp': 'Gary Payton',
  'purp punch': 'Purple Punch',
  'pp': 'Purple Punch',
  'gdp': 'Granddaddy Purple',
  'grand daddy': 'Granddaddy Purple',
  'gsc': 'Girl Scout Cookies',
  'cookies': 'Girl Scout Cookies',
  'gg': 'Gorilla Glue',
  'gg4': 'Gorilla Glue',
  'og': 'OG Kush',
  'sour d': 'Sour Diesel',
  'slh': 'Super Lemon Haze',
  'bd': 'Blue Dream',
  'icc': 'Ice Cream Cake',
  'mac': 'MAC',
  'lcg': 'Lemon Cherry Gelato',
  'dosi': 'Do-Si-Dos',
  'dosidos': 'Do-Si-Dos',
  'nl': 'Northern Lights',
  'jh': 'Jack Herer',
  'jack': 'Jack Herer',
  'bubba': 'Bubba Kush',
  'durban': 'Durban Poison',
  'dp': 'Durban Poison',
  'lpc': 'London Pound Cake',
  'london': 'London Pound Cake',
  // Add quality tier abbreviations
  'gh': '', // Will be handled separately for quality
  'deps': '',
  'indoor': '',
  'outdoor': '',
  'in': '',
  'out': '',
};

const QUALITY_ABBREVIATIONS: Record<string, QualityTier> = {
  'gh': 'greenhouse',
  'greenhouse': 'greenhouse',
  'deps': 'greenhouse', // Deps = light deprivation = greenhouse
  'light dep': 'greenhouse',
  'dep': 'greenhouse',
  'indoor': 'indoor',
  'indo': 'indoor',
  'in': 'indoor',
  'outdoor': 'outdoor',
  'out': 'outdoor',
  'sun': 'outdoor',
  'exotic': 'exotic',
  'exo': 'exotic',
  'fire': 'exotic',
  'premium': 'exotic',
  'ml': 'mixed_light',
  'mixed': 'mixed_light',
  'mixed light': 'mixed_light',
  'mixed_light': 'mixed_light',
};

// ==================== Pattern Detection ====================

interface TextLinePattern {
  name: string;
  number1?: number;
  number2?: number;
  unit?: string;
  qualityTier?: QualityTier;
  rawLine: string;
}

/**
 * Parse a single line of informal text menu
 * Handles patterns like:
 * - "gary p - 32 - 15 packs"
 * - "runtz 26 40 packs"
 * - "blue dream gh - 17 - 60"
 */
function parseTextLine(line: string): TextLinePattern | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return null;

  // Skip lines that look like headers or notes
  if (/^(name|product|strain|thc|price|qty|quantity|all tested|lmk|let me know)/i.test(trimmed)) {
    return null;
  }

  // Try different patterns
  const patterns = [
    // Pattern: name - number - number unit
    /^(.+?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(pack|packs|lb|lbs|oz|unit|units)?$/i,
    // Pattern: name number number unit
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(pack|packs|lb|lbs|oz|unit|units)?$/i,
    // Pattern: name - number (single number)
    /^(.+?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(pack|packs|lb|lbs|oz|unit|units)?$/i,
    // Pattern: name number (single number)
    /^(.+?)\s+(\d+(?:\.\d+)?)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const rawName = match[1].trim();
      const number1 = parseFloat(match[2]);
      const number2 = match[3] ? parseFloat(match[3]) : undefined;
      const unit = match[4]?.toLowerCase();

      // Extract quality tier from name
      const { cleanName, qualityTier } = extractQualityFromName(rawName);

      return {
        name: cleanName,
        number1,
        number2,
        unit,
        qualityTier,
        rawLine: trimmed,
      };
    }
  }

  // If no pattern matched, try to extract just a name
  const nameOnly = trimmed.replace(/[-–—]/g, ' ').trim();
  if (nameOnly.length >= 3 && !/^\d+$/.test(nameOnly)) {
    const { cleanName, qualityTier } = extractQualityFromName(nameOnly);
    return {
      name: cleanName,
      qualityTier,
      rawLine: trimmed,
    };
  }

  return null;
}

/**
 * Extract quality tier from product name
 */
function extractQualityFromName(name: string): { cleanName: string; qualityTier?: QualityTier } {
  const lower = name.toLowerCase();
  let qualityTier: QualityTier | undefined;
  let cleanName = name;

  // Check for quality indicators at the end
  for (const [abbrev, quality] of Object.entries(QUALITY_ABBREVIATIONS)) {
    const pattern = new RegExp(`\\s+${abbrev}$`, 'i');
    if (pattern.test(lower)) {
      qualityTier = quality;
      cleanName = name.replace(pattern, '').trim();
      break;
    }
  }

  return { cleanName, qualityTier };
}

/**
 * Expand strain abbreviation to full name
 */
function expandStrainName(name: string): { expandedName: string; strainInfo?: StrainInfo; confidence: number } {
  const lower = name.toLowerCase().trim();

  // Check abbreviations first
  const abbreviated = STRAIN_ABBREVIATIONS[lower];
  if (abbreviated) {
    const strainInfo = lookupStrain(abbreviated);
    return {
      expandedName: abbreviated,
      strainInfo: strainInfo || undefined,
      confidence: strainInfo ? 0.95 : 0.8,
    };
  }

  // Try direct strain lookup
  const strainInfo = lookupStrain(name);
  if (strainInfo) {
    return {
      expandedName: strainInfo.name,
      strainInfo,
      confidence: 0.95,
    };
  }

  // Title case the name if unknown
  const titleCased = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return {
    expandedName: titleCased,
    confidence: 0.5,
  };
}

/**
 * Determine if a number is likely THC%, abbreviated price, or full price
 * 
 * Common patterns in informal menus:
 * - "gary p - 32 - 15 packs" → 32 = $3200/lb (abbreviated), 15 = quantity
 * - "runtz - 26 - 40 packs" → 26 = $2600/lb (abbreviated), 40 = quantity
 * - THC%: typically 15-35% (but abbreviated prices overlap!)
 * 
 * Key insight: If there's a second number (quantity), the first is almost always 
 * an abbreviated price in wholesale menus (15-40 = $1500-$4000/lb)
 */
function interpretNumber(
  num: number,
  hasSecondNumber: boolean,
  _context?: { hasPacksOrUnits?: boolean }
): { type: 'price' | 'thc' | 'quantity' | 'unknown'; multiplier?: number } {
  
  // If there's a second number AND packs/units mentioned, first number is abbreviated price
  if (hasSecondNumber) {
    // Numbers 12-50 with a second number = abbreviated price (multiply by 100)
    // e.g., 32 → $3200, 18 → $1800, 26 → $2600
    if (num >= 12 && num <= 50) {
      return { type: 'price', multiplier: 100 };
    }
    // Higher numbers might be full prices already
    if (num >= 100 && num <= 5000) {
      return { type: 'price', multiplier: 1 };
    }
    return { type: 'unknown' };
  }

  // Single number - could be THC% or price
  // Full prices (no multiplier needed)
  if (num >= 500 && num <= 5000) {
    return { type: 'price', multiplier: 1 };
  }
  // Abbreviated prices
  if (num >= 12 && num <= 50) {
    return { type: 'price', multiplier: 100 };
  }
  // Very small numbers might be THC for concentrates or quantity
  if (num >= 1 && num <= 10) {
    return { type: 'quantity' };
  }
  
  return { type: 'unknown' };
}

// ==================== Quick Answers Interface ====================

export interface QuickAnswers {
  category: CannabisCategory;
  packMeaning: 'lb' | 'oz' | 'unit' | 'hp' | 'qp';
  qualityTier: QualityTier;
  priceType: 'wholesale' | 'retail';
  priceFormat: 'abbreviated' | 'full'; // 32 = $3200 vs 3200 = $3200
  retailMarkup?: number; // Percentage, e.g., 30 for 30%
  defaultPricePerLb?: number;
  defaultRetailPricePerOz?: number; // For retail storefronts
  allInStock: boolean;
  minOrderQuantity?: number;
  // Additional useful fields
  labTested: boolean;
  supplierName?: string;
  notes?: string;
}

export const DEFAULT_QUICK_ANSWERS: QuickAnswers = {
  category: 'flower',
  packMeaning: 'lb',
  qualityTier: 'indoor',
  priceType: 'wholesale',
  priceFormat: 'abbreviated', // Most informal menus use abbreviated (32 = $3200)
  retailMarkup: 30,
  allInStock: true,
  labTested: false,
};

// ==================== Main Parser ====================

export interface TextParseResult {
  products: ParsedProduct[];
  parseNotes: string[];
  totalLines: number;
  parsedLines: number;
  skippedLines: number;
  confidence: number;
}

/**
 * Parse informal text menu into products
 */
export function parseTextMenu(
  text: string,
  quickAnswers: Partial<QuickAnswers> = {}
): TextParseResult {
  const answers = { ...DEFAULT_QUICK_ANSWERS, ...quickAnswers };
  const lines = text.split('\n').filter(l => l.trim());
  const products: ParsedProduct[] = [];
  const parseNotes: string[] = [];
  let skippedLines = 0;

  // Detect if text mentions packs/units (helps with number interpretation)
  const hasPacks = /pack|packs|unit|units|lb|lbs/i.test(text);
  
  // Use price format from answers to determine multiplier
  const priceMultiplier = answers.priceFormat === 'abbreviated' ? 100 : 1;

  for (const line of lines) {
    const parsed = parseTextLine(line);
    if (!parsed) {
      skippedLines++;
      continue;
    }

    // Expand strain name
    const { expandedName, strainInfo, confidence: nameConfidence } = expandStrainName(parsed.name);

    // Interpret numbers with context
    let quantity: number | undefined;
    let detectedPrice: number | undefined;

    if (parsed.number1 !== undefined && parsed.number2 !== undefined) {
      // Two numbers: first is price, second is quantity
      // Apply user-selected price format multiplier
      if (parsed.number1 >= 10 && parsed.number1 <= 100) {
        // Looks like abbreviated price (10-100 range)
        detectedPrice = parsed.number1 * priceMultiplier;
      } else {
        // Might be full price already
        detectedPrice = parsed.number1;
      }
      quantity = parsed.number2;
    } else if (parsed.number1 !== undefined) {
      // Single number - use interpretation
      const interpretation = interpretNumber(
        parsed.number1, 
        false,
        { hasPacksOrUnits: hasPacks }
      );
      
      if (interpretation.type === 'price') {
        detectedPrice = parsed.number1 * (interpretation.multiplier || 1);
      } else if (interpretation.type === 'quantity') {
        quantity = parsed.number1;
      }
    }

    // Build prices object
    // Priority: detected price from line > default price from quick answers
    const prices: ParsedProduct['prices'] = {};
    const pricePerLb = detectedPrice || answers.defaultPricePerLb;
    
    if (pricePerLb) {
      prices.lb = pricePerLb;
      prices.hp = Math.round(pricePerLb / 2);
      prices.qp = Math.round(pricePerLb / 4);
      prices.oz = Math.round(pricePerLb / 16);
    }

    // Convert quantity based on pack meaning
    let quantityLbs: number | undefined;
    let quantityUnits: number | undefined;
    if (quantity) {
      switch (answers.packMeaning) {
        case 'lb':
          quantityLbs = quantity;
          break;
        case 'hp':
          quantityLbs = quantity * 0.5;
          break;
        case 'qp':
          quantityLbs = quantity * 0.25;
          break;
        case 'oz':
          quantityLbs = quantity / 16;
          break;
        case 'unit':
          quantityUnits = quantity;
          break;
      }
    }

    // Use quality tier from line (gh, deps) if detected, otherwise use default
    // This allows mixed quality in the same menu
    const qualityTier = parsed.qualityTier || answers.qualityTier;

    // Build product
    const product: ParsedProduct = {
      name: expandedName,
      category: answers.category,
      strainType: strainInfo?.type || null,
      thcPercentage: null, // Don't guess THC - let user fill in if needed
      prices: Object.keys(prices).length > 0 ? prices : undefined,
      quantityLbs,
      quantityUnits,
      qualityTier,
      stockStatus: answers.allInStock ? 'available' : undefined,
      confidence: detectedPrice ? Math.min(nameConfidence + 0.15, 0.95) : nameConfidence,
      rawText: parsed.rawLine,
    };

    // Add lineage if known
    if (strainInfo?.genetics) {
      product.lineage = strainInfo.genetics;
    }

    products.push(product);

    // Add parsing notes for transparency
    const notes: string[] = [];
    if (expandedName !== parsed.name) {
      notes.push(`"${parsed.name}" → "${expandedName}"`);
    }
    if (detectedPrice && parsed.number1) {
      notes.push(`Price: ${parsed.number1} → $${detectedPrice}/lb`);
    }
    if (parsed.qualityTier) {
      notes.push(`Quality: ${parsed.qualityTier}`);
    }
    if (notes.length > 0) {
      parseNotes.push(notes.join(', '));
    }
  }

  // Calculate overall confidence
  const avgConfidence = products.length > 0
    ? products.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / products.length
    : 0;

  return {
    products,
    parseNotes,
    totalLines: lines.length,
    parsedLines: products.length,
    skippedLines,
    confidence: avgConfidence,
  };
}

/**
 * Detect if text looks like an informal menu format
 */
export function isInformalTextMenu(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return false;

  // Check if multiple lines match informal patterns
  let matchCount = 0;
  for (const line of lines.slice(0, 10)) {
    if (parseTextLine(line)) {
      matchCount++;
    }
  }

  // At least 50% of lines should match
  return matchCount >= lines.length * 0.5;
}

/**
 * Analyze text to suggest quick answer defaults
 */
export function analyzeTextForDefaults(text: string): Partial<QuickAnswers> {
  const suggestions: Partial<QuickAnswers> = {};
  const lower = text.toLowerCase();

  // Detect if mentions packs/lbs/units
  if (/\bpack|\bpacks\b/i.test(lower)) {
    // Could be lbs or units, need to ask
  }
  if (/\blb|\blbs|\bpound/i.test(lower)) {
    suggestions.packMeaning = 'lb';
  }
  if (/\boz|\bounce/i.test(lower)) {
    suggestions.packMeaning = 'oz';
  }

  // Detect quality mentions
  if (/\bindoor|\bindo\b/i.test(lower)) {
    suggestions.qualityTier = 'indoor';
  }
  if (/\bgh\b|\bgreenhouse|\bdeps?\b/i.test(lower)) {
    suggestions.qualityTier = 'greenhouse';
  }
  if (/\boutdoor|\bout\b/i.test(lower)) {
    suggestions.qualityTier = 'outdoor';
  }

  // Detect category
  if (/\bflower|\bbud|\bnug/i.test(lower)) {
    suggestions.category = 'flower';
  }
  if (/\bconcentrate|\bwax|\brosin/i.test(lower)) {
    suggestions.category = 'concentrate';
  }

  // Check for price indicators
  const priceMatches = lower.match(/\$\s*(\d+)/g);
  if (priceMatches && priceMatches.length > 0) {
    const prices = priceMatches.map(p => parseInt(p.replace(/\D/g, '')));
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    if (avgPrice > 500) {
      suggestions.defaultPricePerLb = Math.round(avgPrice);
    }
  }

  return suggestions;
}

