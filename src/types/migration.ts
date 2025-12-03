/**
 * FloraIQ Menu Migration System Types
 * Types for AI-powered cannabis wholesale menu parsing and import
 */

// ==================== Input Types ====================

export type InputFormat = 'excel' | 'csv' | 'text' | 'image' | 'pdf' | 'unknown';

export interface RawInput {
  format: InputFormat;
  filename?: string;
  content: string | ArrayBuffer;
  mimeType?: string;
  size?: number;
}

// ==================== Confidence Scoring ====================

export interface ConfidenceField<T> {
  value: T;
  raw: string | null;
  confidence: number;
  inferred?: boolean;
}

// ==================== Parsed Product Schema ====================

export type CannabisCategory = 
  | 'flower'
  | 'concentrate'
  | 'edible'
  | 'vape'
  | 'preroll'
  | 'topical'
  | 'tincture'
  | 'accessory'
  | 'other';

export type StrainType = 'sativa' | 'indica' | 'hybrid' | 'cbd' | 'unknown';

export type QualityTier = 'exotic' | 'indoor' | 'greenhouse' | 'outdoor' | 'mixed_light' | 'unknown';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'coming_soon' | 'unknown';

export type WeightUnit = 'g' | 'oz' | 'qp' | 'hp' | 'lb' | 'unit' | 'pack';

export interface PricingTier {
  min_quantity: number;
  max_quantity: number | null;
  price: number;
  raw: string | null;
  confidence: number;
}

export interface AvailableWeight {
  unit: WeightUnit;
  quantity: number;
  raw: string | null;
  inferred?: boolean;
}

/**
 * AI-parsed product with confidence fields.
 * This is the output format from Claude AI parsing before normalization.
 */
export interface AIParsedProduct {
  id: string; // Temporary UUID
  confidence_overall: number;
  
  // Required fields
  name: ConfidenceField<string>;
  category: ConfidenceField<CannabisCategory>;
  
  // Optional cannabis-specific fields
  subcategory?: ConfidenceField<string>;
  strain_type?: ConfidenceField<StrainType>;
  thc_percentage?: ConfidenceField<number>;
  cbd_percentage?: ConfidenceField<number>;
  quality_tier?: ConfidenceField<QualityTier>;
  
  // Pricing
  pricing: {
    unit: WeightUnit;
    tiers: PricingTier[];
  };
  
  // Availability
  available_weights?: AvailableWeight[];
  stock_status?: ConfidenceField<StockStatus>;
  
  // Additional info
  lineage?: ConfidenceField<string>;
  terpenes?: ConfidenceField<string[]>;
  effects?: ConfidenceField<string[]>;
  notes?: ConfidenceField<string>;
  
  // Raw data reference
  _raw_row?: Record<string, unknown>;
  _source_row_number?: number;
}

// ==================== Validation Types ====================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
  suggestion?: string;
  raw_value?: string;
}

/**
 * Validation result from validators.ts
 * Uses the simple validation error/warning types
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ==================== AI Column Mapping ====================

export interface AIColumnMapping {
  source_column: string;
  target_field: keyof AIParsedProduct | 'ignore';
  transform?: string; // Function name for transformation
  confidence: number;
}

export interface DetectedColumns {
  mappings: AIColumnMapping[];
  unmapped_columns: string[];
  headers: string[];
  sample_data: Record<string, string>[];
}

// ==================== Import Session Types ====================

export type ImportStatus = 
  | 'pending'
  | 'processing'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type ImportItemStatus = 
  | 'pending'
  | 'parsed'
  | 'validated'
  | 'imported'
  | 'skipped'
  | 'failed';

export interface ImportSession {
  id: string;
  tenant_id: string;
  
  // Input details
  filename?: string;
  input_format: InputFormat;
  raw_data?: string;
  
  // Column mapping
  column_mapping?: DetectedColumns;
  
  // Progress
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  skipped_rows: number;
  
  // Status
  status: ImportStatus;
  error_log: ImportError[];
  
  // Metadata
  parsing_metadata?: ParsingMetadata;
  
  // Timestamps
  started_at: string;
  completed_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportItem {
  id: string;
  import_id: string;
  
  row_number: number;
  raw_data: Record<string, unknown>;
  parsed_data?: ParsedProduct;
  
  status: ImportItemStatus;
  product_id?: string; // Reference to created product
  
  confidence_score?: number;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  
  created_at: string;
}

export interface ImportError {
  row_number?: number;
  message: string;
  code: string;
  timestamp: string;
}

export interface ParsingMetadata {
  detected_format: InputFormat;
  detected_delimiter?: string;
  encoding?: string;
  total_lines?: number;
  header_row?: number;
  data_start_row?: number;
  ai_model_used?: string;
  parsing_duration_ms?: number;
}

// ==================== Duplicate Detection ====================

export interface DuplicateMatch {
  existing_product_id: string;
  existing_product_name: string;
  similarity_score: number;
  matched_fields: string[];
  recommendation: 'skip' | 'update' | 'create_new';
}

export interface DuplicateCheckResult {
  is_duplicate: boolean;
  matches: DuplicateMatch[];
}

// ==================== AI Parsing Types ====================

export interface AIParseRequest {
  input_text: string;
  format_hint?: InputFormat;
  column_mapping?: DetectedColumns;
  context?: {
    known_strains?: string[];
    price_expectations?: { min: number; max: number };
    typical_categories?: CannabisCategory[];
  };
}

export interface AIParseResponse {
  products: ParsedProduct[];
  parsing_notes?: string[];
  confidence_summary: {
    overall: number;
    by_field: Record<string, number>;
  };
  processing_time_ms: number;
}

// ==================== Wizard Step Types ====================

export type MigrationStep = 
  | 'upload'
  | 'parsing'
  | 'questions'
  | 'mapping'
  | 'preview'
  | 'importing'
  | 'complete';

export interface MigrationState {
  currentStep: MigrationStep;
  rawInput?: RawInput;
  detectedColumns?: DetectedColumns;
  parsedProducts: ParsedProduct[];
  validationResults: ValidationResult[];
  importSession?: ImportSession;
  error?: string;
  isLoading: boolean;
}

// ==================== Component Props Types ====================

export interface EditableCellProps {
  value: unknown;
  confidence: number;
  onChange: (newValue: unknown) => void;
  fieldType: 'text' | 'number' | 'select' | 'percentage';
  options?: { value: string; label: string }[];
}

export interface ConfidenceIndicatorProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// ==================== Cannabis Weight Conversion ====================

export const WEIGHT_CONVERSIONS: Record<WeightUnit, number> = {
  g: 1,
  oz: 28,
  qp: 112, // Quarter pound
  hp: 224, // Half pound
  lb: 448,
  unit: 1,
  pack: 1,
};

export const WEIGHT_ALIASES: Record<string, WeightUnit> = {
  gram: 'g',
  grams: 'g',
  ounce: 'oz',
  ounces: 'oz',
  zip: 'oz',
  zips: 'oz',
  z: 'oz',
  quarter: 'qp',
  qp: 'qp',
  'quarter pound': 'qp',
  half: 'hp',
  hp: 'hp',
  'half pound': 'hp',
  pound: 'lb',
  pounds: 'lb',
  lb: 'lb',
  lbs: 'lb',
  elbow: 'lb',
  elbows: 'lb',
  unit: 'unit',
  units: 'unit',
  each: 'unit',
  pack: 'pack',
  packs: 'pack',
};

// ==================== Category Detection ====================

export const CATEGORY_KEYWORDS: Record<CannabisCategory, string[]> = {
  flower: ['flower', 'bud', 'buds', 'nug', 'nugs', 'cannabis', 'weed', 'indoor', 'outdoor', 'greenhouse'],
  concentrate: ['concentrate', 'wax', 'shatter', 'rosin', 'resin', 'hash', 'diamonds', 'sauce', 'badder', 'budder', 'crumble', 'live', 'cured'],
  edible: ['edible', 'gummy', 'gummies', 'chocolate', 'brownie', 'cookie', 'candy', 'drink', 'beverage'],
  vape: ['vape', 'cart', 'cartridge', 'pod', 'disposable', 'pen', '510'],
  preroll: ['preroll', 'pre-roll', 'joint', 'blunt', 'infused', 'cone'],
  topical: ['topical', 'lotion', 'cream', 'balm', 'salve', 'patch', 'transdermal'],
  tincture: ['tincture', 'oil', 'drops', 'sublingual', 'rso', 'feco'],
  accessory: ['accessory', 'pipe', 'bong', 'grinder', 'tray', 'paper', 'wrap'],
  other: [],
};

// ==================== Quality Tier Detection ====================

export const QUALITY_KEYWORDS: Record<QualityTier, string[]> = {
  exotic: ['exotic', 'exo', 'premium', 'top shelf', 'fire', 'gas', 'zaza', 'loud'],
  indoor: ['indoor', 'indo', 'in'],
  greenhouse: ['greenhouse', 'gh', 'light dep', 'mixed light', 'deps'],
  outdoor: ['outdoor', 'out', 'sun grown', 'full sun'],
  mixed_light: ['mixed', 'mixed light', 'ml'],
  unknown: [],
};

// ==================== Stock Status Detection ====================

export const STOCK_INDICATORS: Record<StockStatus, string[]> = {
  in_stock: ['✅', 'available', 'in stock', 'ready', 'yes', '✔', '☑'],
  low_stock: ['⚠️', 'low', 'limited', 'few left', 'running low'],
  out_of_stock: ['❌', 'sold out', 'oos', 'out', 'gone', 'no', '✖', 'sold', 'na', 'n/a'],
  coming_soon: ['🔜', 'coming', 'soon', 'eta', 'incoming', 'pending'],
  unknown: [],
};

// ==================== Simple Validation Types (for validators) ====================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestedValue?: unknown;
}

// ==================== Import Service Types ====================

export interface ImportResult {
  success: boolean;
  productName?: string;
  productId?: string;
  error?: string;
  skipped?: boolean;
  updated?: boolean;
  // Batch import results
  totalProcessed?: number;
  successfulImports?: number;
  failedImports?: number;
  skippedDuplicates?: number;
  errors?: Array<{ row: number; message: string }>;
}

export interface ImportProgress {
  phase: 'parsing' | 'validating' | 'importing' | 'complete';
  current: number;
  total: number;
  message: string;
}

// ==================== Format Detection Types ====================

export interface FormatDetectionResult {
  format: InputFormat;
  confidence: number;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  detectedDelimiter?: ',' | '\t' | ';' | '|';
}

// ==================== Excel/CSV Parsing Types ====================

export interface ParsedRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  parsed: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

export interface HeaderDetectionResult {
  hasHeaders: boolean;
  headerRow: number;
  headers: string[];
  confidence: number;
}

// ==================== Simple Column Mapping (for excel-parser) ====================

export interface ColumnMapping {
  name?: number;
  category?: number;
  strainType?: number;
  thc?: number;
  cbd?: number;
  price?: number;
  pricePerLb?: number;
  pricePerOz?: number;
  pricePerQp?: number;
  quantity?: number;
  weight?: number;
  lineage?: number;
  terpenes?: number;
  growInfo?: number;
  notes?: number;
  [key: string]: number | undefined;
}

// ==================== Target Field Mapping (for UI) ====================

export type TargetField = 
  | 'name' 
  | 'category' 
  | 'strainType' 
  | 'thcPercentage' 
  | 'cbdPercentage'
  | 'pricePound' 
  | 'priceQp' 
  | 'priceOz' 
  | 'priceUnit'
  | 'quantity' 
  | 'quality' 
  | 'lineage' 
  | 'notes' 
  | 'ignore';

export interface ColumnMappingItem {
  sourceHeader: string;
  targetField: TargetField;
  confidence: number;
}

// ==================== Migration Wizard Types ====================

export type MigrationWizardStep = 
  | 'upload'
  | 'parsing'
  | 'mapping'
  | 'preview'
  | 'importing'
  | 'complete';

// ==================== Simple ParsedProduct (for validators/deduplication) ====================

/**
 * Simplified ParsedProduct interface for validation, deduplication, and import.
 * This is the working format after AI parsing has been completed.
 */
export interface ParsedProduct {
  name: string;
  category?: 'flower' | 'concentrate' | 'edible' | 'preroll' | 'vape' | 'tincture' | 'topical' | 'seed' | 'clone' | 'accessory' | 'other';
  strainType?: 'indica' | 'sativa' | 'hybrid' | null;
  thcPercentage?: number | null;
  cbdPercentage?: number | null;
  prices?: {
    lb?: number;
    hp?: number;
    qp?: number;
    oz?: number;
    unit?: number;
  };
  quantityLbs?: number;
  quantityUnits?: number;
  lineage?: string;
  terpenes?: string[];
  growInfo?: string;
  qualityTier?: 'exotic' | 'indoor' | 'greenhouse' | 'outdoor';
  stockStatus?: 'available' | 'limited' | 'out';
  notes?: string;
  confidence?: number;
  rawData?: Record<string, unknown>;
  rawText?: string;
}

