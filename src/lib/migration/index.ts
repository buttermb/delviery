/**
 * FloraIQ Menu Migration System
 * Main exports for the migration library
 */

// Format detection
export { detectFormat, validateInput, isCSVContent, looksLikeCannabisMenu } from './format-detector';
// FormatDetectionResult re-exported below in types block

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

// Strain normalizer
export {
  lookupStrain,
  detectStrainType,
  parseStrainInfo,
  extractStrainFromProductName,
  suggestStrains,
  getStrainsByType,
  getTypicalTerpenes,
} from './normalizers/strain';

// Text Parser (informal menu format)
export {
  parseTextMenu,
  isInformalTextMenu,
  analyzeTextForDefaults,
  DEFAULT_QUICK_ANSWERS,
} from './text-parser';
export type { QuickAnswers, TextParseResult } from './text-parser';

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
