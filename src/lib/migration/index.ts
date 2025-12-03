/**
 * FloraIQ Menu Migration System
 * Main exports for the migration library
 */

// Format detection
export { detectFormat, validateInput, isCSVContent, looksLikeCannabisMenu } from './format-detector';
export type { FormatDetectionResult } from '@/types/migration';

// Excel/CSV parsing
export {
  parseExcelFile,
  parseCSVContent,
  detectHeaders,
  autoMapColumns,
  parseRowsWithMapping,
  rowsToProducts,
  getSuggestedMappings,
  transformMappedDataToProducts,
} from './excel-parser';

// Normalizers
export {
  parseWeight,
  convertWeight,
  formatWeight,
  parseQuantityString,
} from './normalizers/weight';
export type { WeightResult } from './normalizers/weight';

export {
  parsePrice,
  parseTieredPricing,
  parsePricingFromColumns,
  calculatePerUnitPrice,
  calculatePricePerPound,
  validatePricing,
  formatPrice,
  formatTieredPricing,
} from './normalizers/price';
export type { PriceResult, TieredPricing } from './normalizers/price';

export {
  detectCategory,
  detectCategoryFromName,
  getCategoryDisplayName,
  getStandardCategories,
  isWholesaleCategory,
} from './normalizers/category';
export type { CannabisCategory, CategoryResult } from './normalizers/category';

export {
  lookupStrain,
  detectStrainType,
  parseStrainInfo,
  extractStrainFromProductName,
  suggestStrains,
  getStrainsByType,
  getTypicalTerpenes,
} from './normalizers/strain';
export type { StrainType, StrainInfo } from './normalizers/strain';

// AI Prompts
export {
  CANNABIS_PARSING_SYSTEM_PROMPT,
  CANNABIS_PARSING_USER_PROMPT,
  OCR_PARSING_PROMPT,
  generateParsingPrompt,
  generateValidationPrompt,
  generateStrainNormalizationPrompt,
  generatePricingExtractionPrompt,
} from './prompts';

// Validation
export {
  ParsedProductSchema,
  PricesSchema,
  validateProduct,
  validateProducts,
  autoFixProduct,
  calculateConfidenceScore,
} from './validators';
export type { ValidatedProduct } from './validators';

// Deduplication
export {
  findDuplicates,
  findDuplicatesFuzzy,
  mergeProducts,
  deduplicateProducts,
  findExistingProduct,
} from './deduplication';
export type { DuplicateMatch, DeduplicationResult } from './deduplication';

// Import service
export {
  importProducts,
  rollbackImport,
  getImportHistory,
  getImportDetails,
} from './import-service';
export type { ImportOptions, BatchImportResult } from './import-service';

// Re-export types
export type {
  InputFormat,
  ParsedProduct,
  AIParsedProduct,
  ParsedRow,
  ColumnMapping,
  AIColumnMapping,
  HeaderDetectionResult,
  FormatDetectionResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ImportResult,
  ImportProgress,
  MigrationWizardStep,
  MigrationState,
  CannabisCategory,
  StrainType,
  QualityTier,
  StockStatus,
  WeightUnit,
} from '@/types/migration';

