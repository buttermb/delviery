/**
 * Excel/CSV Parser for Menu Migration
 * Parses spreadsheet data with header detection and column mapping
 */

import * as XLSX from 'xlsx';
import type { 
  ParsedRow, 
  ColumnMapping, 
  HeaderDetectionResult,
  ParsedProduct 
} from '@/types/migration';
import { detectDelimiter } from './format-detector';

// Common header variations for cannabis menu columns
const HEADER_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  name: [
    /^(product[_\s]?)?name$/i,
    /^strain[_\s]?(name)?$/i,
    /^item$/i,
    /^title$/i,
    /^description$/i,
  ],
  category: [
    /^category$/i,
    /^type$/i,
    /^product[_\s]?type$/i,
    /^class$/i,
  ],
  strainType: [
    /^strain[_\s]?type$/i,
    /^indica[_/]sativa$/i,
    /^genetics$/i,
    /^effect$/i,
  ],
  thc: [
    /^thc$/i,
    /^thc[_\s]?%$/i,
    /^thc[_\s]?percent(age)?$/i,
    /^potency$/i,
  ],
  cbd: [
    /^cbd$/i,
    /^cbd[_\s]?%$/i,
    /^cbd[_\s]?percent(age)?$/i,
  ],
  price: [
    /^price$/i,
    /^cost$/i,
    /^unit[_\s]?price$/i,
    /^\$$/i,
  ],
  pricePerLb: [
    /^(price[_\s]?)?(per[_\s]?)?lb$/i,
    /^pound$/i,
    /^lb[_\s]?price$/i,
  ],
  pricePerOz: [
    /^(price[_\s]?)?(per[_\s]?)?oz$/i,
    /^ounce$/i,
    /^oz[_\s]?price$/i,
    /^zip$/i,
  ],
  pricePerQp: [
    /^(price[_\s]?)?(per[_\s]?)?qp$/i,
    /^quarter[_\s]?pound$/i,
  ],
  quantity: [
    /^quantity$/i,
    /^qty$/i,
    /^stock$/i,
    /^available$/i,
    /^units$/i,
  ],
  weight: [
    /^weight$/i,
    /^size$/i,
    /^amount$/i,
  ],
  lineage: [
    /^lineage$/i,
    /^parent(s)?$/i,
    /^cross$/i,
    /^genetics$/i,
  ],
  terpenes: [
    /^terpenes?$/i,
    /^terps?$/i,
    /^flavor$/i,
    /^profile$/i,
  ],
  growInfo: [
    /^grow[_\s]?(info|type)?$/i,
    /^cultivation$/i,
    /^source$/i,
    /^indoor[_/]outdoor$/i,
  ],
  notes: [
    /^notes?$/i,
    /^comments?$/i,
    /^description$/i,
    /^details?$/i,
  ],
};

/**
 * Parse Excel/CSV data from ArrayBuffer
 * Returns headers and rows in a consistent format
 */
export function parseExcelFile(
  buffer: ArrayBuffer,
  _format: 'excel' | 'csv'
): { headers: string[]; rows: Record<string, unknown>[] } {
  const workbook = XLSX.read(buffer, { 
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
  
  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with headers
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    blankrows: false,
  });
  
  if (rawData.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // Extract headers from first row's keys
  const headers = Object.keys(rawData[0]);
  
  return { headers, rows: rawData };
}

/**
 * Parse Excel file from File object (async version)
 */
export async function parseExcelFileAsync(file: File): Promise<{
  sheets: string[];
  data: Record<string, unknown[][]>;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  const sheets = workbook.SheetNames;
  const data: Record<string, unknown[][]> = {};
  
  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    data[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }
  
  return { sheets, data };
}

/**
 * Parse CSV content to raw data
 */
export function parseCSVContent(content: string, delimiter?: string): unknown[][] {
  const actualDelimiter = delimiter || detectDelimiter(content);
  const lines = content.trim().split('\n');
  
  return lines.map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === actualDelimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  });
}

/**
 * Detect headers in raw data
 */
export function detectHeaders(data: unknown[][]): HeaderDetectionResult {
  if (data.length === 0) {
    return { hasHeaders: false, headerRow: -1, headers: [], confidence: 0 };
  }

  // Check first few rows for header-like content
  const candidateRows = data.slice(0, 5);
  let bestRow = 0;
  let bestScore = 0;

  for (let rowIndex = 0; rowIndex < candidateRows.length; rowIndex++) {
    const row = candidateRows[rowIndex];
    let score = 0;
    let matchedColumns = 0;

    for (const cell of row) {
      const cellStr = String(cell || '').toLowerCase().trim();
      
      // Check if cell matches any known header pattern
      for (const patterns of Object.values(HEADER_PATTERNS)) {
        if (patterns.some(pattern => pattern.test(cellStr))) {
          score += 10;
          matchedColumns++;
          break;
        }
      }

      // Headers are usually text, not numbers
      if (cellStr && isNaN(Number(cellStr)) && !cellStr.startsWith('$')) {
        score += 1;
      }

      // Headers usually don't have very long values
      if (cellStr.length > 0 && cellStr.length < 30) {
        score += 0.5;
      }
    }

    // Bonus for having multiple recognized headers
    if (matchedColumns >= 2) {
      score += matchedColumns * 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIndex;
    }
  }

  const headerRow = candidateRows[bestRow];
  const headers = (headerRow as unknown[]).map(cell => String(cell || '').trim());
  const confidence = Math.min(bestScore / (headers.length * 10), 1);

  return {
    hasHeaders: confidence > 0.3,
    headerRow: confidence > 0.3 ? bestRow : -1,
    headers: confidence > 0.3 ? headers : [],
    confidence,
  };
}

/**
 * Auto-detect column mapping based on headers
 */
export function autoMapColumns(headers: string[]): ColumnMappingItem[] {
  const mappings: ColumnMappingItem[] = [];

  // Map from internal field names to TargetField values
  const fieldToTarget: Record<string, TargetField> = {
    name: 'name',
    category: 'category',
    strainType: 'strainType',
    thc: 'thcPercentage',
    cbd: 'cbdPercentage',
    pricePerLb: 'pricePound',
    pricePerOz: 'priceOz',
    pricePerQp: 'priceQp',
    price: 'priceUnit',
    quantity: 'quantity',
    growInfo: 'quality',
    lineage: 'lineage',
    notes: 'notes',
  };

  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();
    let targetField: TargetField = 'ignore';
    let confidence = 0.5;

    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(normalizedHeader)) {
          targetField = fieldToTarget[field] || 'ignore';
          confidence = 1 - (i * 0.1); // Earlier patterns = higher confidence
          break;
        }
      }
      if (targetField !== 'ignore') break;
    }

    mappings.push({
      sourceHeader: header,
      targetField,
      confidence,
    });
  });

  return mappings;
}

/**
 * Auto-detect column mapping based on headers (returns index-based mapping)
 */
export function autoMapColumnsLegacy(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();

    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(normalizedHeader))) {
        // Don't overwrite if already mapped (first match wins)
        if (!(field in mapping)) {
          mapping[field as keyof ColumnMapping] = index;
        }
        break;
      }
    }
  });

  return mapping;
}

/**
 * Parse rows using column mapping
 */
export function parseRowsWithMapping(
  data: unknown[][],
  mapping: ColumnMapping,
  startRow: number = 0
): ParsedRow[] {
  const rows: ParsedRow[] = [];

  for (let i = startRow; i < data.length; i++) {
    const rawRow = data[i];
    if (!rawRow || rawRow.every(cell => !cell)) continue; // Skip empty rows

    const row: ParsedRow = {
      rowIndex: i,
      raw: rawRow.reduce<Record<string, unknown>>((acc, cell, idx) => {
        acc[`col_${idx}`] = cell;
        return acc;
      }, {}),
      parsed: {},
      errors: [],
      warnings: [],
    };

    // Extract values using mapping
    for (const [field, colIndex] of Object.entries(mapping)) {
      if (colIndex !== undefined && colIndex < rawRow.length) {
        row.parsed[field] = rawRow[colIndex];
      }
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Convert parsed rows to product format
 */
export function rowsToProducts(rows: ParsedRow[]): Partial<ParsedProduct>[] {
  return rows.map(row => {
    const product: Partial<ParsedProduct> = {
      name: String(row.parsed.name || '').trim(),
      category: (String(row.parsed.category || '').trim() || undefined) as ParsedProduct['category'],
      strainType: parseStrainType(row.parsed.strainType),
      thcPercentage: parsePercentage(row.parsed.thc),
      cbdPercentage: parsePercentage(row.parsed.cbd),
      lineage: String(row.parsed.lineage || '').trim() || undefined,
      terpenes: parseTerpenes(row.parsed.terpenes),
      growInfo: String(row.parsed.growInfo || '').trim() || undefined,
      notes: String(row.parsed.notes || '').trim() || undefined,
      rawData: row.raw,
    };

    // Parse pricing
    const prices: ParsedProduct['prices'] = {};
    if (row.parsed.pricePerLb) {
      prices.lb = parsePrice(row.parsed.pricePerLb);
    }
    if (row.parsed.pricePerOz) {
      prices.oz = parsePrice(row.parsed.pricePerOz);
    }
    if (row.parsed.pricePerQp) {
      prices.qp = parsePrice(row.parsed.pricePerQp);
    }
    if (row.parsed.price) {
      // Try to determine which tier this price belongs to
      const price = parsePrice(row.parsed.price);
      if (price && !prices.lb && !prices.oz) {
        prices.unit = price;
      }
    }
    if (Object.keys(prices).length > 0) {
      product.prices = prices;
    }

    // Parse quantity
    if (row.parsed.quantity) {
      const qty = parseQuantity(row.parsed.quantity);
      if (qty) {
        product.quantityLbs = qty.lbs;
        product.quantityUnits = qty.units;
      }
    }

    return product;
  });
}

/**
 * Parse strain type from various formats
 */
function parseStrainType(value: unknown): 'indica' | 'sativa' | 'hybrid' | undefined {
  if (!value) return;
  
  const str = String(value).toLowerCase().trim();
  
  if (/indica/i.test(str)) return 'indica';
  if (/sativa/i.test(str)) return 'sativa';
  if (/hybrid/i.test(str)) return 'hybrid';
  if (/^i$/i.test(str)) return 'indica';
  if (/^s$/i.test(str)) return 'sativa';
  if (/^h$/i.test(str)) return 'hybrid';
  
  return;
}

/**
 * Parse percentage value
 */
function parsePercentage(value: unknown): number | undefined {
  if (!value) return;
  
  const str = String(value).replace(/[%\s]/g, '');
  const num = parseFloat(str);
  
  if (isNaN(num)) return;
  if (num > 100) return; // Invalid percentage
  
  return num;
}

/**
 * Parse price value
 */
function parsePrice(value: unknown): number | undefined {
  if (!value) return;
  
  let str = String(value).trim();
  
  // Handle "k" notation (e.g., "2.2k" = 2200)
  if (/k$/i.test(str)) {
    const num = parseFloat(str.replace(/[k$,\s]/gi, ''));
    return isNaN(num) ? undefined : num * 1000;
  }
  
  // Remove currency symbols and commas
  str = str.replace(/[$,\s]/g, '');
  const num = parseFloat(str);
  
  return isNaN(num) ? undefined : num;
}

/**
 * Parse quantity value
 */
function parseQuantity(value: unknown): { lbs?: number; units?: number } | undefined {
  if (!value) return;
  
  const str = String(value).toLowerCase().trim();
  
  // Try to parse "X lbs" or "X lb"
  const lbMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/i);
  if (lbMatch) {
    return { lbs: parseFloat(lbMatch[1]) };
  }
  
  // Try to parse plain number as units
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return { units: Math.floor(num) };
  }
  
  return;
}

/**
 * Parse terpenes list
 */
function parseTerpenes(value: unknown): string[] | undefined {
  if (!value) return;
  
  const str = String(value).trim();
  if (!str) return;
  
  // Split by common delimiters
  const terpenes = str
    .split(/[,;|/]/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
  
  return terpenes.length > 0 ? terpenes : undefined;
}

/**
 * Get suggested column mappings with confidence
 */
export function getSuggestedMappings(headers: string[]): Array<{
  field: keyof ColumnMapping;
  columnIndex: number;
  header: string;
  confidence: number;
}> {
  const suggestions: Array<{
    field: keyof ColumnMapping;
    columnIndex: number;
    header: string;
    confidence: number;
  }> = [];

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();

    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(normalizedHeader)) {
          suggestions.push({
            field: field as keyof ColumnMapping,
            columnIndex: index,
            header,
            confidence: 1 - (i * 0.1), // Earlier patterns = higher confidence
          });
          break;
        }
      }
    }
  });

  // Sort by confidence and remove duplicates (keep highest confidence per field)
  const fieldMap = new Map<string, typeof suggestions[0]>();
  suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .forEach(suggestion => {
      if (!fieldMap.has(suggestion.field as string)) {
        fieldMap.set(suggestion.field as string, suggestion);
      }
    });

  return Array.from(fieldMap.values());
}

import type { TargetField, ColumnMappingItem } from '@/types/migration';

/**
 * Transform mapped Excel/CSV data to ParsedProduct array
 * This is the client-side alternative to AI parsing for structured data
 */
export function transformMappedDataToProducts(
  headers: string[],
  rows: Record<string, unknown>[],
  mappings: ColumnMappingItem[]
): ParsedProduct[] {
  const products: ParsedProduct[] = [];

  // Build mapping lookup: sourceHeader -> targetField
  const mappingLookup = new Map<string, TargetField>();
  mappings.forEach(m => {
    if (m.targetField !== 'ignore') {
      mappingLookup.set(m.sourceHeader, m.targetField);
    }
  });

  // Transform each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Extract values based on mappings
    let name = '';
    let category = '';
    let strainType: 'indica' | 'sativa' | 'hybrid' | undefined;
    let thcPercentage: number | undefined;
    let cbdPercentage: number | undefined;
    let quality: string | undefined;
    let lineage: string | undefined;
    let notes: string | undefined;
    const prices: Record<string, number> = {};
    let quantity: number | undefined;
    let quantityUnit: 'lbs' | 'units' | undefined;

    // Process each header based on its mapping
    for (const header of headers) {
      const targetField = mappingLookup.get(header);
      if (!targetField) continue;

      const value = row[header];
      if (value === null || value === undefined || value === '') continue;

      switch (targetField) {
        case 'name':
          name = String(value).trim();
          break;
        case 'category':
          category = String(value).trim().toLowerCase();
          break;
        case 'strainType':
          strainType = parseStrainType(value);
          break;
        case 'thcPercentage':
          thcPercentage = parsePercentage(value);
          break;
        case 'cbdPercentage':
          cbdPercentage = parsePercentage(value);
          break;
        case 'pricePound': {
          const priceLb = parsePrice(value);
          if (priceLb) prices.lb = priceLb;
          break;
        }
        case 'priceQp': {
          const priceQp = parsePrice(value);
          if (priceQp) prices.qp = priceQp;
          break;
        }
        case 'priceOz': {
          const priceOz = parsePrice(value);
          if (priceOz) prices.oz = priceOz;
          break;
        }
        case 'priceUnit': {
          const priceUnit = parsePrice(value);
          if (priceUnit) prices.unit = priceUnit;
          break;
        }
        case 'quantity': {
          const qty = parseQuantity(value);
          if (qty?.lbs) {
            quantity = qty.lbs;
            quantityUnit = 'lbs';
          } else if (qty?.units) {
            quantity = qty.units;
            quantityUnit = 'units';
          }
          break;
        }
        case 'quality':
          quality = String(value).trim();
          break;
        case 'lineage':
          lineage = String(value).trim();
          break;
        case 'notes':
          notes = String(value).trim();
          break;
      }
    }

    // Skip rows without a name
    if (!name) continue;

    // Create product matching ParsedProduct interface
    const product: ParsedProduct = {
      name,
      category: (category || detectCategoryFromName(name)) as ParsedProduct['category'],
      strainType,
      thcPercentage,
      cbdPercentage,
      prices: Object.keys(prices).length > 0 ? prices : undefined,
      quantityLbs: quantityUnit === 'lbs' ? quantity : undefined,
      quantityUnits: quantityUnit === 'units' ? quantity : undefined,
      qualityTier: quality as ParsedProduct['qualityTier'],
      lineage,
      notes,
      confidence: calculateRowConfidence(row, mappings),
      rawData: row,
    };

    products.push(product);
  }

  return products;
}

/**
 * Detect category from product name
 */
function detectCategoryFromName(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (/wax|shatter|batter|budder|crumble|rosin|diamonds?|sauce|live\s*resin/i.test(lowerName)) {
    return 'concentrate';
  }
  if (/cart(ridge)?|vape|pen|distillate/i.test(lowerName)) {
    return 'vape';
  }
  if (/edible|gumm(y|ies)|chocolate|brownie|cookie|candy/i.test(lowerName)) {
    return 'edible';
  }
  if (/preroll|pre-roll|joint|blunt/i.test(lowerName)) {
    return 'preroll';
  }
  if (/tincture|oil|rso|capsule/i.test(lowerName)) {
    return 'tincture';
  }
  if (/topical|balm|lotion|cream/i.test(lowerName)) {
    return 'topical';
  }
  
  // Default to flower for cannabis menus
  return 'flower';
}

/**
 * Calculate confidence score for a row based on mapped fields
 */
function calculateRowConfidence(
  row: Record<string, unknown>,
  mappings: ColumnMappingItem[]
): number {
  let totalConfidence = 0;
  let fieldCount = 0;

  for (const mapping of mappings) {
    if (mapping.targetField === 'ignore') continue;
    
    const value = row[mapping.sourceHeader];
    if (value !== null && value !== undefined && value !== '') {
      totalConfidence += mapping.confidence;
      fieldCount++;
    }
  }

  return fieldCount > 0 ? totalConfidence / fieldCount : 0.5;
}

