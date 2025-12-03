// @ts-nocheck
/**
 * Duplicate Detection with Fuzzy Matching
 * Uses Fuse.js for finding similar products
 */

import Fuse from 'fuse.js';
import type { ParsedProduct } from '@/types/migration';

export interface DuplicateMatch {
  index1: number;
  index2: number;
  similarity: number;
  matchedFields: string[];
  suggestedAction: 'merge' | 'review' | 'keep_both';
}

export interface DeduplicationResult {
  duplicates: DuplicateMatch[];
  uniqueProducts: Partial<ParsedProduct>[];
  mergedProducts: Partial<ParsedProduct>[];
  summary: {
    total: number;
    duplicatesFound: number;
    afterDedup: number;
  };
}

// Fuse.js options for fuzzy matching
const FUSE_OPTIONS: Fuse.IFuseOptions<Partial<ParsedProduct>> = {
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'category', weight: 0.15 },
    { name: 'strainType', weight: 0.1 },
    { name: 'lineage', weight: 0.1 },
    { name: 'growInfo', weight: 0.05 },
  ],
  threshold: 0.3, // Lower = more strict
  includeScore: true,
  ignoreLocation: true,
  useExtendedSearch: true,
};

/**
 * Normalize name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // Levenshtein distance normalized
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;

  // Check for containment
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return shorter.length / longer.length;
  }

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= shorter.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= longer.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      if (shorter[i - 1] === longer[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[shorter.length][longer.length];
  return 1 - distance / longer.length;
}

/**
 * Calculate overall similarity between two products
 */
function calculateProductSimilarity(
  product1: Partial<ParsedProduct>,
  product2: Partial<ParsedProduct>
): { similarity: number; matchedFields: string[] } {
  const matchedFields: string[] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  // Name comparison (highest weight)
  if (product1.name && product2.name) {
    const nameSim = stringSimilarity(product1.name, product2.name);
    weightedScore += nameSim * 0.5;
    totalWeight += 0.5;
    if (nameSim > 0.7) matchedFields.push('name');
  }

  // Category match
  if (product1.category && product2.category) {
    const catMatch = product1.category === product2.category ? 1 : 0;
    weightedScore += catMatch * 0.15;
    totalWeight += 0.15;
    if (catMatch) matchedFields.push('category');
  }

  // Strain type match
  if (product1.strainType && product2.strainType) {
    const strainMatch = product1.strainType === product2.strainType ? 1 : 0;
    weightedScore += strainMatch * 0.1;
    totalWeight += 0.1;
    if (strainMatch) matchedFields.push('strainType');
  }

  // THC percentage similarity (within 5% range)
  if (product1.thcPercentage != null && product2.thcPercentage != null) {
    const thcDiff = Math.abs(product1.thcPercentage - product2.thcPercentage);
    const thcSim = thcDiff <= 5 ? 1 - (thcDiff / 10) : 0;
    weightedScore += thcSim * 0.1;
    totalWeight += 0.1;
    if (thcSim > 0.5) matchedFields.push('thcPercentage');
  }

  // Price similarity (within 20% range)
  if (product1.prices?.lb && product2.prices?.lb) {
    const priceDiff = Math.abs(product1.prices.lb - product2.prices.lb);
    const avgPrice = (product1.prices.lb + product2.prices.lb) / 2;
    const priceSim = priceDiff / avgPrice <= 0.2 ? 1 - (priceDiff / avgPrice) : 0;
    weightedScore += priceSim * 0.1;
    totalWeight += 0.1;
    if (priceSim > 0.5) matchedFields.push('prices');
  }

  // Grow info match
  if (product1.growInfo && product2.growInfo) {
    const growMatch = product1.growInfo.toLowerCase() === product2.growInfo.toLowerCase() ? 1 : 0;
    weightedScore += growMatch * 0.05;
    totalWeight += 0.05;
    if (growMatch) matchedFields.push('growInfo');
  }

  const similarity = totalWeight > 0 ? weightedScore / totalWeight : 0;

  return { similarity, matchedFields };
}

/**
 * Find duplicate products in a list
 */
export function findDuplicates(
  products: Partial<ParsedProduct>[],
  threshold: number = 0.7
): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];
  const checked = new Set<string>();

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const key = `${i}-${j}`;
      if (checked.has(key)) continue;
      checked.add(key);

      const { similarity, matchedFields } = calculateProductSimilarity(
        products[i],
        products[j]
      );

      if (similarity >= threshold) {
        duplicates.push({
          index1: i,
          index2: j,
          similarity,
          matchedFields,
          suggestedAction: similarity >= 0.9 ? 'merge' : 
                           similarity >= 0.8 ? 'review' : 'keep_both',
        });
      }
    }
  }

  // Sort by similarity (highest first)
  return duplicates.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Find duplicates using Fuse.js for faster fuzzy matching
 */
export function findDuplicatesFuzzy(
  products: Partial<ParsedProduct>[],
  threshold: number = 0.7
): DuplicateMatch[] {
  if (products.length < 2) return [];

  const fuse = new Fuse(products, FUSE_OPTIONS);
  const duplicates: DuplicateMatch[] = [];
  const checkedPairs = new Set<string>();

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (!product.name) continue;

    const results = fuse.search(product.name);

    for (const result of results) {
      const j = products.indexOf(result.item);
      if (i === j) continue;

      const pairKey = [Math.min(i, j), Math.max(i, j)].join('-');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Calculate detailed similarity
      const { similarity, matchedFields } = calculateProductSimilarity(
        products[i],
        products[j]
      );

      if (similarity >= threshold) {
        duplicates.push({
          index1: Math.min(i, j),
          index2: Math.max(i, j),
          similarity,
          matchedFields,
          suggestedAction: similarity >= 0.9 ? 'merge' :
                           similarity >= 0.8 ? 'review' : 'keep_both',
        });
      }
    }
  }

  // Remove duplicates and sort
  const uniqueDuplicates = Array.from(
    new Map(duplicates.map(d => [`${d.index1}-${d.index2}`, d])).values()
  );

  return uniqueDuplicates.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Merge two products into one
 */
export function mergeProducts(
  product1: Partial<ParsedProduct>,
  product2: Partial<ParsedProduct>,
  preferFirst: boolean = true
): Partial<ParsedProduct> {
  const primary = preferFirst ? product1 : product2;
  const secondary = preferFirst ? product2 : product1;

  const merged: Partial<ParsedProduct> = {
    // Use primary values, fall back to secondary
    name: primary.name || secondary.name,
    category: primary.category || secondary.category,
    strainType: primary.strainType || secondary.strainType,
    thcPercentage: primary.thcPercentage ?? secondary.thcPercentage,
    cbdPercentage: primary.cbdPercentage ?? secondary.cbdPercentage,
    lineage: primary.lineage || secondary.lineage,
    growInfo: primary.growInfo || secondary.growInfo,
    qualityTier: primary.qualityTier || secondary.qualityTier,
    stockStatus: primary.stockStatus || secondary.stockStatus,
    notes: [primary.notes, secondary.notes].filter(Boolean).join(' | ') || undefined,
  };

  // Merge terpenes (unique values)
  const allTerpenes = [...(primary.terpenes || []), ...(secondary.terpenes || [])];
  if (allTerpenes.length > 0) {
    merged.terpenes = [...new Set(allTerpenes)];
  }

  // Merge prices (prefer more complete)
  if (primary.prices || secondary.prices) {
    merged.prices = {
      ...(secondary.prices || {}),
      ...(primary.prices || {}),
    };
  }

  // Merge quantities (prefer higher)
  if (primary.quantityLbs || secondary.quantityLbs) {
    merged.quantityLbs = Math.max(primary.quantityLbs || 0, secondary.quantityLbs || 0) || undefined;
  }
  if (primary.quantityUnits || secondary.quantityUnits) {
    merged.quantityUnits = Math.max(primary.quantityUnits || 0, secondary.quantityUnits || 0) || undefined;
  }

  // Average confidence
  if (primary.confidence || secondary.confidence) {
    merged.confidence = ((primary.confidence || 0.5) + (secondary.confidence || 0.5)) / 2;
  }

  return merged;
}

/**
 * Deduplicate a list of products
 */
export function deduplicateProducts(
  products: Partial<ParsedProduct>[],
  options: {
    threshold?: number;
    autoMerge?: boolean;
    useFuzzy?: boolean;
  } = {}
): DeduplicationResult {
  const { threshold = 0.7, autoMerge = false, useFuzzy = true } = options;

  const duplicates = useFuzzy
    ? findDuplicatesFuzzy(products, threshold)
    : findDuplicates(products, threshold);

  if (!autoMerge || duplicates.length === 0) {
    return {
      duplicates,
      uniqueProducts: products,
      mergedProducts: [],
      summary: {
        total: products.length,
        duplicatesFound: duplicates.length,
        afterDedup: products.length,
      },
    };
  }

  // Auto-merge high-confidence duplicates
  const toMerge = duplicates.filter(d => d.suggestedAction === 'merge');
  const mergedIndices = new Set<number>();
  const mergedProducts: Partial<ParsedProduct>[] = [];

  for (const dup of toMerge) {
    if (mergedIndices.has(dup.index1) || mergedIndices.has(dup.index2)) continue;

    mergedProducts.push(mergeProducts(products[dup.index1], products[dup.index2]));
    mergedIndices.add(dup.index1);
    mergedIndices.add(dup.index2);
  }

  const uniqueProducts = products.filter((_, i) => !mergedIndices.has(i));
  const finalProducts = [...uniqueProducts, ...mergedProducts];

  return {
    duplicates,
    uniqueProducts: finalProducts,
    mergedProducts,
    summary: {
      total: products.length,
      duplicatesFound: duplicates.length,
      afterDedup: finalProducts.length,
    },
  };
}

/**
 * Check if a product exists in existing inventory
 */
export function findExistingProduct(
  newProduct: Partial<ParsedProduct>,
  existingProducts: Array<{ id: string; product_name: string; category?: string }>
): { id: string; similarity: number } | null {
  if (!newProduct.name) return null;

  let bestMatch: { id: string; similarity: number } | null = null;

  for (const existing of existingProducts) {
    const similarity = stringSimilarity(newProduct.name, existing.product_name);
    
    // Check category match for bonus
    const categoryBonus = newProduct.category === existing.category ? 0.1 : 0;
    const totalSimilarity = Math.min(similarity + categoryBonus, 1);

    if (totalSimilarity > 0.8 && (!bestMatch || totalSimilarity > bestMatch.similarity)) {
      bestMatch = { id: existing.id, similarity: totalSimilarity };
    }
  }

  return bestMatch;
}




