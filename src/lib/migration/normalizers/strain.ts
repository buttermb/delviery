/**
 * Cannabis Strain Normalizer
 * Strain database and genetics lookup
 */

export type StrainType = 'indica' | 'sativa' | 'hybrid';

export interface StrainInfo {
  name: string;
  type: StrainType;
  genetics?: string;
  lineage?: string[];
  aliases?: string[];
  thcRange?: [number, number];
  cbdRange?: [number, number];
  terpenes?: string[];
  effects?: string[];
}

// Common strain database (abbreviated - would be much larger in production)
const STRAIN_DATABASE: StrainInfo[] = [
  // Indica-dominant
  { name: 'OG Kush', type: 'indica', genetics: 'Hindu Kush x Chemdawg', aliases: ['og', 'ocean grown'], terpenes: ['myrcene', 'limonene', 'caryophyllene'] },
  { name: 'Granddaddy Purple', type: 'indica', genetics: 'Purple Urkle x Big Bud', aliases: ['gdp', 'grand daddy purp'], terpenes: ['myrcene', 'pinene'] },
  { name: 'Northern Lights', type: 'indica', aliases: ['nl', 'northern light'], terpenes: ['myrcene', 'caryophyllene'] },
  { name: 'Bubba Kush', type: 'indica', aliases: ['bubba'], terpenes: ['caryophyllene', 'limonene'] },
  { name: 'Purple Punch', type: 'indica', genetics: 'Larry OG x Granddaddy Purple', terpenes: ['limonene', 'caryophyllene', 'pinene'] },
  { name: 'Ice Cream Cake', type: 'indica', genetics: 'Wedding Cake x Gelato #33', aliases: ['icc'], terpenes: ['limonene', 'caryophyllene', 'linalool'] },
  { name: 'Zkittlez', type: 'indica', genetics: 'Grape Ape x Grapefruit', aliases: ['skittlez', 'skittles', 'zkittles'], terpenes: ['linalool', 'caryophyllene'] },
  
  // Sativa-dominant
  { name: 'Sour Diesel', type: 'sativa', genetics: 'Chemdawg 91 x Super Skunk', aliases: ['sour d', 'sour'], terpenes: ['caryophyllene', 'myrcene', 'limonene'] },
  { name: 'Jack Herer', type: 'sativa', genetics: 'Haze x (Northern Lights x Shiva Skunk)', aliases: ['jack', 'jh'], terpenes: ['terpinolene', 'pinene', 'caryophyllene'] },
  { name: 'Green Crack', type: 'sativa', aliases: ['green crush', 'mango crack'], terpenes: ['myrcene', 'caryophyllene', 'pinene'] },
  { name: 'Durban Poison', type: 'sativa', aliases: ['durban', 'dp'], terpenes: ['terpinolene', 'myrcene'] },
  { name: 'Super Lemon Haze', type: 'sativa', genetics: 'Lemon Skunk x Super Silver Haze', aliases: ['slh'], terpenes: ['limonene', 'caryophyllene', 'terpinolene'] },
  { name: 'Tangie', type: 'sativa', genetics: 'California Orange x Skunk', terpenes: ['limonene', 'myrcene'] },
  
  // Hybrid
  { name: 'Blue Dream', type: 'hybrid', genetics: 'Blueberry x Haze', aliases: ['bd'], terpenes: ['myrcene', 'pinene', 'caryophyllene'] },
  { name: 'Girl Scout Cookies', type: 'hybrid', genetics: 'OG Kush x Durban Poison', aliases: ['gsc', 'cookies'], terpenes: ['caryophyllene', 'limonene', 'humulene'] },
  { name: 'Gelato', type: 'hybrid', genetics: 'Sunset Sherbet x Thin Mint Cookies', aliases: ['larry bird'], terpenes: ['limonene', 'caryophyllene', 'myrcene'] },
  { name: 'Wedding Cake', type: 'hybrid', genetics: 'Triangle Kush x Animal Mints', aliases: ['pink cookies'], terpenes: ['limonene', 'caryophyllene', 'humulene'] },
  { name: 'Runtz', type: 'hybrid', genetics: 'Zkittlez x Gelato', aliases: ['runts'], terpenes: ['limonene', 'caryophyllene', 'linalool'] },
  { name: 'Gary Payton', type: 'hybrid', genetics: 'The Y x Snowman', terpenes: ['caryophyllene', 'limonene', 'linalool'] },
  { name: 'Apple Fritter', type: 'hybrid', genetics: 'Sour Apple x Animal Cookies', terpenes: ['limonene', 'caryophyllene', 'pinene'] },
  { name: 'Biscotti', type: 'hybrid', genetics: 'Gelato #25 x South Florida OG', terpenes: ['limonene', 'caryophyllene', 'myrcene'] },
  { name: 'Cereal Milk', type: 'hybrid', genetics: 'Y Life x Snowman', terpenes: ['limonene', 'caryophyllene', 'linalool'] },
  { name: 'White Runtz', type: 'hybrid', genetics: 'Zkittlez x Gelato', terpenes: ['limonene', 'caryophyllene'] },
  { name: 'Pink Runtz', type: 'hybrid', genetics: 'Zkittlez x Gelato', terpenes: ['limonene', 'caryophyllene', 'linalool'] },
  { name: 'Gorilla Glue', type: 'hybrid', genetics: 'Chem Sister x Sour Dubb x Chocolate Diesel', aliases: ['gg4', 'gg', 'original glue'], terpenes: ['caryophyllene', 'limonene', 'myrcene'] },
  { name: 'Mimosa', type: 'hybrid', genetics: 'Clementine x Purple Punch', terpenes: ['limonene', 'myrcene', 'pinene'] },
  { name: 'Do-Si-Dos', type: 'hybrid', genetics: 'Girl Scout Cookies x Face Off OG', aliases: ['dosidos', 'dosi'], terpenes: ['limonene', 'caryophyllene', 'linalool'] },
  { name: 'MAC', type: 'hybrid', genetics: 'Alien Cookies x Colombian x Starfighter', aliases: ['miracle alien cookies'], terpenes: ['limonene', 'caryophyllene', 'pinene'] },
  { name: 'Lemon Cherry Gelato', type: 'hybrid', genetics: 'Sunset Sherbet x GSC', aliases: ['lcg'], terpenes: ['limonene', 'caryophyllene', 'linalool'] },
];

// Strain type patterns
const STRAIN_TYPE_PATTERNS: Record<StrainType, RegExp[]> = {
  indica: [
    /\b(indica|ind|in)\b/i,
    /\b100%?\s*i(ndica)?\b/i,
    /\bindica\s*dom(inant)?\b/i,
  ],
  sativa: [
    /\b(sativa|sat|sa)\b/i,
    /\b100%?\s*s(ativa)?\b/i,
    /\bsativa\s*dom(inant)?\b/i,
  ],
  hybrid: [
    /\b(hybrid|hyb)\b/i,
    /\b50\s*\/\s*50\b/i,
    /\bbalanced?\b/i,
  ],
};

/**
 * Look up strain in database
 */
export function lookupStrain(name: string): StrainInfo | null {
  if (!name) return null;
  
  const normalized = name.toLowerCase().trim();
  
  // Direct name match
  let match = STRAIN_DATABASE.find(s => 
    s.name.toLowerCase() === normalized
  );
  if (match) return match;
  
  // Alias match
  match = STRAIN_DATABASE.find(s => 
    s.aliases?.some(a => a.toLowerCase() === normalized)
  );
  if (match) return match;
  
  // Partial match (strain name contained in input)
  match = STRAIN_DATABASE.find(s => 
    normalized.includes(s.name.toLowerCase()) ||
    s.aliases?.some(a => normalized.includes(a.toLowerCase()))
  );
  if (match) return match;
  
  // Fuzzy match (input contained in strain name)
  if (normalized.length >= 3) {
    match = STRAIN_DATABASE.find(s => 
      s.name.toLowerCase().includes(normalized) ||
      s.aliases?.some(a => a.toLowerCase().includes(normalized))
    );
    if (match) return match;
  }
  
  return null;
}

/**
 * Detect strain type from text
 */
export function detectStrainType(text: string): StrainType | null {
  if (!text) return null;
  
  const normalized = text.toLowerCase().trim();
  
  // Check explicit type patterns
  for (const [type, patterns] of Object.entries(STRAIN_TYPE_PATTERNS)) {
    if (patterns.some(p => p.test(normalized))) {
      return type as StrainType;
    }
  }
  
  // Check if it's a known strain
  const strainInfo = lookupStrain(normalized);
  if (strainInfo) {
    return strainInfo.type;
  }
  
  return null;
}

/**
 * Parse strain information from text
 */
export function parseStrainInfo(text: string): {
  name: string;
  type?: StrainType;
  knownStrain?: StrainInfo;
  confidence: number;
} {
  if (!text) {
    return { name: '', confidence: 0 };
  }
  
  const originalName = text.trim();
  
  // Try to look up the strain
  const knownStrain = lookupStrain(originalName);
  if (knownStrain) {
    return {
      name: knownStrain.name,
      type: knownStrain.type,
      knownStrain,
      confidence: 0.95,
    };
  }
  
  // Try to detect type from name
  const detectedType = detectStrainType(originalName);
  if (detectedType) {
    // Remove type indicator from name
    const cleanName = originalName
      .replace(/\b(indica|sativa|hybrid|ind|sat|hyb)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      name: cleanName || originalName,
      type: detectedType,
      confidence: 0.7,
    };
  }
  
  // Return as-is with low confidence
  return {
    name: originalName,
    confidence: 0.5,
  };
}

/**
 * Extract strain name from product name
 * e.g., "Blue Dream Indoor" -> "Blue Dream"
 */
export function extractStrainFromProductName(productName: string): string | null {
  if (!productName) return null;
  
  // Common suffixes to remove
  const suffixes = [
    /\s+(indoor|outdoor|greenhouse|deps?|light\s*dep)$/i,
    /\s+(smalls?|popcorn|mids?|larf)$/i,
    /\s+(premium|exotic|top\s*shelf|a+|aaa+)$/i,
    /\s+(\d+g|\d+oz|\d+lb)$/i,
    /\s+(live\s*resin|cured\s*resin|budder|wax|shatter)$/i,
  ];
  
  let name = productName.trim();
  
  for (const suffix of suffixes) {
    name = name.replace(suffix, '');
  }
  
  // Try to match against known strains
  const strainInfo = lookupStrain(name);
  if (strainInfo) {
    return strainInfo.name;
  }
  
  return name || null;
}

/**
 * Get suggested strains based on partial input
 */
export function suggestStrains(input: string, limit: number = 5): StrainInfo[] {
  if (!input || input.length < 2) return [];
  
  const normalized = input.toLowerCase().trim();
  
  return STRAIN_DATABASE
    .filter(s => 
      s.name.toLowerCase().includes(normalized) ||
      s.aliases?.some(a => a.toLowerCase().includes(normalized))
    )
    .slice(0, limit);
}

/**
 * Get all strains of a specific type
 */
export function getStrainsByType(type: StrainType): StrainInfo[] {
  return STRAIN_DATABASE.filter(s => s.type === type);
}

/**
 * Get common terpenes for a strain type
 */
export function getTypicalTerpenes(type: StrainType): string[] {
  const strains = getStrainsByType(type);
  const terpeneCount: Record<string, number> = {};
  
  for (const strain of strains) {
    for (const terpene of strain.terpenes ?? []) {
      terpeneCount[terpene] = (terpeneCount[terpene] ?? 0) + 1;
    }
  }
  
  return Object.entries(terpeneCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([terpene]) => terpene);
}




