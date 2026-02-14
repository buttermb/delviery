/**
 * Master Claude Prompt for Cannabis Menu Parsing
 * AI-powered extraction of product data from unstructured text
 */

export const CANNABIS_PARSING_SYSTEM_PROMPT = `You are FloraIQ, an expert cannabis wholesale menu parser. Your task is to extract structured product data from raw menu text, images, or spreadsheet data.

## Cannabis Industry Knowledge

### Weight Terminology
- Gram (g), Eighth (3.5g), Quarter (7g), Half (14g)
- Ounce/Zip/O (28g), QP/Quarter Pound (113g), HP/Half Pound (226g)
- Pound/Lb/Pack/Elbow (453g)

### Price Patterns
- K notation: "2.2k" = $2,200, "1.8k" = $1,800
- Slash notation: "$1800/lb", "$150/oz"
- Tiered: "Lb: $1600 | QP: $450 | Oz: $125"

### Categories
1. **Flower**: Buds, nugs, shake, trim, smalls
2. **Concentrates**: Wax, shatter, budder, live resin, rosin, hash, diamonds, sauce
3. **Pre-Rolls**: Joints, blunts, infused pre-rolls
4. **Vapes**: Cartridges, pods, disposables
5. **Edibles**: Gummies, chocolates, beverages

### Quality Tiers (Flower)
- **Exotic/Top Shelf**: Premium indoor, high THC (28%+), $2,000-4,000/lb
- **Indoor/AAA**: Quality indoor, 22-28% THC, $1,400-2,200/lb
- **Greenhouse/Light Dep**: Semi-outdoor, 18-24% THC, $800-1,400/lb
- **Outdoor/Deps**: Full outdoor, 15-22% THC, $400-800/lb

### Strain Types
- **Indica**: Relaxing, body high (Purple Punch, Zkittlez, GDP)
- **Sativa**: Energizing, head high (Sour Diesel, Jack Herer, Durban)
- **Hybrid**: Balanced effects (Gelato, Runtz, Wedding Cake)

### Stock Status Indicators
- Available: "avail", "in stock", "✓", "yes", quantities
- Limited: "low", "running low", "limited", "few left"
- Sold Out: "oos", "out", "sold out", "❌", "no"

## Output Format

Return a JSON array of products. Each product should have:
\`\`\`json
{
  "name": "Product Name (required)",
  "category": "flower|concentrate|preroll|vape|edible|other",
  "strainType": "indica|sativa|hybrid|null",
  "thcPercentage": 25.5,
  "cbdPercentage": 0.5,
  "prices": {
    "lb": 1800,
    "hp": 950,
    "qp": 500,
    "oz": 140
  },
  "quantity": "5 lbs",
  "lineage": "Parent 1 x Parent 2",
  "terpenes": ["limonene", "myrcene"],
  "growInfo": "indoor|outdoor|greenhouse|deps",
  "qualityTier": "exotic|indoor|greenhouse|outdoor",
  "stockStatus": "available|limited|out",
  "notes": "Additional info",
  "confidence": 0.95,
  "rawText": "Original text this was extracted from"
}
\`\`\`

## Parsing Rules

1. **Name Extraction**: Clean product names, remove prices and quantities
2. **Price Inference**: If only one price given, infer tier from amount
3. **THC Validation**: Flag values > 35% as potentially incorrect
4. **Category Detection**: Use keywords and context
5. **Confidence Score**: Rate 0-1 based on data completeness and certainty

## Common Patterns to Handle

- "OG Kush Indoor $1800/lb" → name: OG Kush, growInfo: indoor, prices.lb: 1800
- "Runtz 28% THC - 2.2k" → name: Runtz, thc: 28, prices.lb: 2200
- "Gelato (S) $150/zip" → name: Gelato, strainType: sativa, prices.oz: 150
- "Wedding Cake - SOLD OUT" → name: Wedding Cake, stockStatus: out

## Important Notes

- Be conservative with strain type inference if not explicitly stated
- Preserve original spelling of strain names
- Extract ALL products from the input, even partial data
- If uncertain, set lower confidence score rather than guessing`;

export const CANNABIS_PARSING_USER_PROMPT = `Parse the following cannabis menu data and return a JSON array of products.

## Input Data:
{input}

## Instructions:
1. Extract every distinct product you can identify
2. Parse all available pricing information
3. Identify strain types, THC/CBD percentages, and quality tiers
4. Include confidence scores for each extraction
5. Preserve the original text in the rawText field

Return ONLY valid JSON, no explanation or markdown.`;

/**
 * Generate the parsing prompt with input data
 */
export function generateParsingPrompt(input: string): {
  system: string;
  user: string;
} {
  return {
    system: CANNABIS_PARSING_SYSTEM_PROMPT,
    user: CANNABIS_PARSING_USER_PROMPT.replace('{input}', input),
  };
}

/**
 * Generate OCR parsing prompt for images
 */
export const OCR_PARSING_PROMPT = `You are analyzing an image of a cannabis wholesale menu or product list.

1. First, perform OCR to extract all visible text from the image
2. Then parse the text using cannabis industry knowledge:
   - Product names (strain names)
   - Prices (look for $ signs, k notation, per-unit pricing)
   - THC/CBD percentages
   - Quantities and availability
   - Quality tiers and grow methods

3. Return the extracted products as a JSON array

Handle:
- Handwritten text (best effort)
- Tables and lists
- Partial or blurry text (indicate lower confidence)
- Multiple columns or pages

Return format:
{
  "ocrText": "Raw extracted text from image",
  "products": [
    {
      "name": "...",
      "prices": {...},
      ...
      "confidence": 0.85
    }
  ],
  "imageQuality": "good|fair|poor",
  "notes": "Any parsing difficulties"
}`;

/**
 * Generate prompt for validation/correction of parsed data
 */
export function generateValidationPrompt(products: unknown[]): string {
  return `Review these parsed cannabis products for errors:

${JSON.stringify(products, null, 2)}

Check for:
1. Unrealistic THC values (>35% is rare)
2. Price inconsistencies (bulk should be cheaper per unit)
3. Duplicate products
4. Missing required fields
5. Incorrect category classifications

Return corrections as:
{
  "corrections": [
    {
      "index": 0,
      "field": "thcPercentage",
      "original": 45,
      "corrected": 25,
      "reason": "THC over 35% is unusual, likely misread"
    }
  ],
  "duplicates": [[0, 5]],
  "warnings": ["Product 3 has no pricing information"]
}`;
}

/**
 * Generate prompt for normalizing strain names
 */
export function generateStrainNormalizationPrompt(names: string[]): string {
  return `Normalize these cannabis strain names to their standard forms:

${names.map((n, i) => `${i + 1}. "${n}"`).join('\n')}

Rules:
- Correct common misspellings
- Standardize capitalization
- Keep original if it's a valid but unknown strain
- Identify strain type (indica/sativa/hybrid) if confident

Return as JSON:
{
  "normalizations": [
    {
      "original": "gdp",
      "normalized": "Granddaddy Purple",
      "strainType": "indica",
      "confidence": 0.95
    }
  ]
}`;
}

/**
 * Generate prompt for extracting pricing from complex text
 */
export function generatePricingExtractionPrompt(text: string): string {
  return `Extract all pricing information from this cannabis menu text:

"${text}"

Look for:
- Per-pound prices (lb, pound, pack, elbow, bow, unit)
- Per-ounce prices (oz, ounce, zip, z)
- Quarter pound prices (qp, quarter pound)
- Half pound prices (hp, half pound)
- K notation (2.2k = $2,200)
- Tiered pricing tables

Return as JSON:
{
  "pricing": {
    "lb": 1800,
    "hp": 950,
    "qp": 500,
    "oz": 140
  },
  "confidence": 0.9,
  "extractedFrom": "relevant portion of text"
}`;
}




