/**
 * Cannabis Category Normalizer
 * Classifies products into standard categories
 */

export type CannabisCategory = 
  | 'flower'
  | 'concentrate'
  | 'edible'
  | 'preroll'
  | 'vape'
  | 'tincture'
  | 'topical'
  | 'seed'
  | 'clone'
  | 'accessory'
  | 'other';

export interface CategoryResult {
  category: CannabisCategory;
  confidence: number;
  originalText: string;
  subcategory?: string;
}

// Category patterns with priority (first match wins within category)
const CATEGORY_PATTERNS: Record<CannabisCategory, Array<{ regex: RegExp; subcategory?: string; confidence: number }>> = {
  flower: [
    { regex: /\bflower\b/i, confidence: 0.95 },
    { regex: /\bbud(s)?\b/i, confidence: 0.9 },
    { regex: /\bnug(s)?\b/i, confidence: 0.9 },
    { regex: /\b(indoor|outdoor|greenhouse|deps?|light\s*dep)\b/i, confidence: 0.8 },
    { regex: /\b(exotic|top\s*shelf|premium|smalls?|mids?|larf)\b/i, confidence: 0.7 },
    { regex: /\b(shake|trim)\b/i, subcategory: 'trim', confidence: 0.85 },
  ],
  concentrate: [
    { regex: /\bconcentrate(s)?\b/i, confidence: 0.95 },
    { regex: /\bextract(s)?\b/i, confidence: 0.9 },
    { regex: /\b(wax|shatter|budder|badder|crumble|sugar|sauce)\b/i, confidence: 0.95 },
    { regex: /\b(live\s*resin|cured\s*resin)\b/i, subcategory: 'resin', confidence: 0.95 },
    { regex: /\b(rosin|hash\s*rosin|live\s*rosin)\b/i, subcategory: 'rosin', confidence: 0.95 },
    { regex: /\b(diamonds?|thca?\s*diamonds?)\b/i, subcategory: 'diamonds', confidence: 0.95 },
    { regex: /\b(hash|hashish|bubble\s*hash|ice\s*hash)\b/i, subcategory: 'hash', confidence: 0.95 },
    { regex: /\bdabs?\b/i, confidence: 0.8 },
    { regex: /\bdistillate\b/i, subcategory: 'distillate', confidence: 0.95 },
    { regex: /\b(rso|rick\s*simpson)\b/i, subcategory: 'rso', confidence: 0.95 },
    { regex: /\bkief\b/i, subcategory: 'kief', confidence: 0.95 },
  ],
  edible: [
    { regex: /\bedible(s)?\b/i, confidence: 0.95 },
    { regex: /\b(gumm(y|ies)|chew(s)?)\b/i, subcategory: 'gummies', confidence: 0.95 },
    { regex: /\b(chocolate|brownie|cookie|candy)\b/i, subcategory: 'chocolate', confidence: 0.9 },
    { regex: /\b(drink|beverage|soda|tea|coffee)\b/i, subcategory: 'beverage', confidence: 0.9 },
    { regex: /\b(capsule|pill|tablet)\b/i, subcategory: 'capsule', confidence: 0.9 },
    { regex: /\b(mg|milligram)\b/i, confidence: 0.6 }, // Often indicates edible
  ],
  preroll: [
    { regex: /\bpre\s*roll(s|ed)?\b/i, confidence: 0.95 },
    { regex: /\bjoint(s)?\b/i, confidence: 0.9 },
    { regex: /\bblunt(s)?\b/i, subcategory: 'blunt', confidence: 0.9 },
    { regex: /\binfused\s*(pre\s*)?roll\b/i, subcategory: 'infused', confidence: 0.95 },
    { regex: /\b(cone|doob(ie)?)\b/i, confidence: 0.8 },
  ],
  vape: [
    { regex: /\bvape(s)?\b/i, confidence: 0.95 },
    { regex: /\bcartridge(s)?\b/i, subcategory: 'cartridge', confidence: 0.95 },
    { regex: /\bcart(s)?\b/i, subcategory: 'cartridge', confidence: 0.9 },
    { regex: /\bpod(s)?\b/i, subcategory: 'pod', confidence: 0.85 },
    { regex: /\bdisposable(s)?\b/i, subcategory: 'disposable', confidence: 0.85 },
    { regex: /\b(510|battery)\b/i, confidence: 0.7 },
    { regex: /\b(pax|stiiizy|plug\s*play|raw\s*garden)\b/i, confidence: 0.9 },
  ],
  tincture: [
    { regex: /\btincture(s)?\b/i, confidence: 0.95 },
    { regex: /\bdrop(s)?\b/i, confidence: 0.7 },
    { regex: /\bsublingual\b/i, confidence: 0.9 },
    { regex: /\boil\b/i, confidence: 0.6 }, // Could be many things
  ],
  topical: [
    { regex: /\btopical(s)?\b/i, confidence: 0.95 },
    { regex: /\b(cream|lotion|balm|salve)\b/i, confidence: 0.9 },
    { regex: /\b(patch(es)?|transdermal)\b/i, subcategory: 'patch', confidence: 0.95 },
    { regex: /\b(bath\s*bomb|soap)\b/i, subcategory: 'bath', confidence: 0.9 },
  ],
  seed: [
    { regex: /\bseed(s)?\b/i, confidence: 0.9 },
    { regex: /\b(feminized|fem|auto|autoflower)\b/i, confidence: 0.85 },
    { regex: /\bgenetics\b/i, confidence: 0.7 },
  ],
  clone: [
    { regex: /\bclone(s)?\b/i, confidence: 0.95 },
    { regex: /\b(cutting|starter|plant)\b/i, confidence: 0.7 },
  ],
  accessory: [
    { regex: /\baccessor(y|ies)\b/i, confidence: 0.95 },
    { regex: /\b(pipe|bong|rig|grinder|tray|paper)\b/i, confidence: 0.9 },
    { regex: /\b(lighter|torch|dabber|tool)\b/i, confidence: 0.85 },
  ],
  other: [
    { regex: /./, confidence: 0.3 }, // Catch-all
  ],
};

/**
 * Detect category from text
 */
export function detectCategory(text: string): CategoryResult {
  if (!text) {
    return { category: 'other', confidence: 0, originalText: '' };
  }

  const originalText = text;
  const normalized = text.toLowerCase().trim();

  let bestMatch: CategoryResult = { 
    category: 'other', 
    confidence: 0, 
    originalText 
  };

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.regex.test(normalized)) {
        if (pattern.confidence > bestMatch.confidence) {
          bestMatch = {
            category: category as CannabisCategory,
            confidence: pattern.confidence,
            originalText,
            subcategory: pattern.subcategory,
          };
        }
        break; // First match in category wins
      }
    }
  }

  return bestMatch;
}

/**
 * Detect category from product name (more aggressive matching)
 */
export function detectCategoryFromName(name: string): CategoryResult | null {
  if (!name) return null;

  // Some product names directly indicate category
  const namePatterns: Array<{ regex: RegExp; category: CannabisCategory; subcategory?: string }> = [
    // Concentrate indicators in name
    { regex: /\b(badder|batter|budder|wax|shatter|sugar|sauce|diamonds?)\b/i, category: 'concentrate' },
    { regex: /\b(live|cured)\s*(resin|rosin)\b/i, category: 'concentrate' },
    { regex: /\bhash\b/i, category: 'concentrate', subcategory: 'hash' },
    
    // Preroll indicators
    { regex: /\bpre\s*roll\b/i, category: 'preroll' },
    { regex: /\binfused\s*joint\b/i, category: 'preroll', subcategory: 'infused' },
    
    // Vape indicators
    { regex: /\bcart(ridge)?\b/i, category: 'vape', subcategory: 'cartridge' },
    { regex: /\bdisposable\b/i, category: 'vape', subcategory: 'disposable' },
    
    // Edible indicators
    { regex: /\b(\d+\s*mg)\b/i, category: 'edible' },
    { regex: /\bgumm(y|ies)\b/i, category: 'edible', subcategory: 'gummies' },
  ];

  for (const pattern of namePatterns) {
    if (pattern.regex.test(name)) {
      return {
        category: pattern.category,
        confidence: 0.85,
        originalText: name,
        subcategory: pattern.subcategory,
      };
    }
  }

  return null;
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: CannabisCategory): string {
  const displayNames: Record<CannabisCategory, string> = {
    flower: 'Flower',
    concentrate: 'Concentrates',
    edible: 'Edibles',
    preroll: 'Pre-Rolls',
    vape: 'Vapes',
    tincture: 'Tinctures',
    topical: 'Topicals',
    seed: 'Seeds',
    clone: 'Clones',
    accessory: 'Accessories',
    other: 'Other',
  };
  return displayNames[category];
}

/**
 * Get all standard categories
 */
export function getStandardCategories(): CannabisCategory[] {
  return [
    'flower',
    'concentrate',
    'edible',
    'preroll',
    'vape',
    'tincture',
    'topical',
    'seed',
    'clone',
    'accessory',
    'other',
  ];
}

/**
 * Check if a category is wholesale-focused
 */
export function isWholesaleCategory(category: CannabisCategory): boolean {
  return ['flower', 'concentrate', 'preroll', 'edible', 'vape'].includes(category);
}




