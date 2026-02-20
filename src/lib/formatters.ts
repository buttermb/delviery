/**
 * Central Formatting Utilities Export
 * Re-exports all formatting utilities from one location for easy discovery
 */

// Currency formatting
export {
  formatCurrency,
  formatCurrencyNumber,
  formatCompactCurrency,
} from './utils/formatCurrency';

// Date formatting
export {
  formatSmartDate,
  formatRelativeTime,
  formatDateRange,
  formatDateWithTimezone,
  getUserTimezone,
} from './utils/formatDate';

// Number formatting
export {
  formatNumber,
  formatPercent,
  formatQuantity,
  formatCompactNumber,
  formatDuration,
  formatFileSize,
} from './utils/formatNumber';

// Phone formatting
export { formatPhoneNumber } from './utils/formatPhone';

// Time validation
export {
  isValidTime,
  parseTime,
  formatTime,
  validateTimeRange,
  convert12to24,
  convert24to12,
} from './utils/timeValidation';

// Export utilities
export {
  exportToCSV,
  exportToJSON,
  downloadFile,
  generateExportFilename,
  ExportColumnHelpers,
} from './utils/exportUtils';

// Display value (null/undefined handling)
export { displayValue, displayName } from './utils/displayValue';

// Status colors
export {
  getStatusColors,
  getStatusBadgeClasses,
  STATUS_COLORS,
} from '@/constants/statusColors';

/**
 * Quick reference for formatting utilities:
 * 
 * CURRENCY:
 * - formatCurrency(1234.56) → "$1,234.56"
 * - formatCompactCurrency(1234567) → "$1.2M"
 * - formatCurrencyNumber(1234.56) → "1234.56"
 * 
 * DATES:
 * - formatSmartDate(date) → "Today" / "Yesterday" / "Dec 23, 2024"
 * - formatRelativeTime(date) → "2 hours ago"
 * - formatDateRange(start, end) → "Dec 1 - Dec 15, 2024"
 * - formatDateWithTimezone(date) → "Dec 23, 2024 2:30 PM (EST)"
 * 
 * NUMBERS:
 * - formatNumber(1234) → "1,234"
 * - formatPercent(12.5) → "12.5%"
 * - formatQuantity(5, 'items') → "5 items"
 * - formatCompactNumber(1234567) → "1.2M"
 * - formatDuration(90) → "1 hour 30 min"
 * - formatFileSize(1024) → "1 KB"
 * 
 * PHONE:
 * - formatPhoneNumber('5551234567') → "(555) 123-4567"
 * - formatPhoneNumber(null) → "—"
 *
 * DISPLAY VALUE:
 * - displayValue(null) → "—"
 * - displayValue('hello') → "hello"
 * - displayName('John', 'Doe') → "John Doe"
 * - displayName(null, null) → "Unknown"
 *
 * STATUS:
 * - getStatusColors('pending') → { bg: '...', text: '...', ... }
 * - getStatusBadgeClasses('success') → "bg-green-100 text-green-800 ..."
 */
