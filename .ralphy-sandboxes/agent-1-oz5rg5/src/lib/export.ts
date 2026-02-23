/**
 * Shared Export Utility
 *
 * Provides CSV and JSON export functionality with:
 * - Column configuration for header mapping
 * - Date formatting
 * - Nested object handling
 * - Special character escaping
 * - Activity logging integration
 *
 * Usage:
 *   import { exportToCSV, exportToJSON } from '@/lib/export';
 *   await exportToCSV(data, columns, 'orders.csv', { tenantId, userId });
 */

import { format } from 'date-fns';

import type { ActivityMetadata } from '@/lib/activityLog';
import { logActivity, ActivityAction, EntityType } from '@/lib/activityLog';
import { logger } from '@/lib/logger';

/**
 * Column configuration for CSV export
 */
export interface ExportColumn<T> {
  /** The key in the data object (supports dot notation for nested: 'customer.name') */
  key: string;
  /** The header label to display in the CSV */
  header: string;
  /** Optional custom formatter function */
  format?: (value: unknown, row: T) => string;
  /** Column type for automatic formatting */
  type?: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean';
}

/**
 * Options for export operations
 */
export interface ExportOptions {
  /** Include BOM for Excel UTF-8 compatibility */
  includeBOM?: boolean;
  /** Date format string (date-fns format) */
  dateFormat?: string;
  /** Datetime format string */
  datetimeFormat?: string;
  /** Currency locale */
  currencyLocale?: string;
  /** Currency code */
  currencyCode?: string;
  /** Tenant ID for activity logging */
  tenantId?: string;
  /** User ID for activity logging */
  userId?: string;
  /** Entity type for activity logging */
  entityType?: string;
  /** Additional metadata for activity log */
  metadata?: ActivityMetadata;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeBOM: true,
  dateFormat: 'MMM d, yyyy',
  datetimeFormat: 'MMM d, yyyy h:mm a',
  currencyLocale: 'en-US',
  currencyCode: 'USD',
};

/**
 * Get nested value from object using dot notation
 * @example getNestedValue({ customer: { name: 'John' } }, 'customer.name') => 'John'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object' && current !== null) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Format a date value
 */
function formatDateValue(value: unknown, formatStr: string): string {
  if (value === null || value === undefined) return '';
  try {
    const date = value instanceof Date ? value : new Date(String(value));
    if (isNaN(date.getTime())) return '';
    return format(date, formatStr);
  } catch {
    return String(value);
  }
}

/**
 * Format a currency value
 */
function formatCurrencyValue(
  value: unknown,
  locale: string,
  currencyCode: string
): string {
  if (value === null || value === undefined) return '';
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return '';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(numValue);
}

/**
 * Format a percentage value
 */
function formatPercentValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return '';
  return `${(numValue * 100).toFixed(1)}%`;
}

/**
 * Format a number value
 */
function formatNumberValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return '';
  return new Intl.NumberFormat('en-US').format(numValue);
}

/**
 * Format a cell value based on column configuration
 */
function formatCellValue<T extends Record<string, unknown>>(
  value: unknown,
  row: T,
  column: ExportColumn<T>,
  options: ExportOptions
): string {
  // Use custom formatter if provided
  if (column.format) {
    return column.format(value, row);
  }

  if (value === null || value === undefined) return '';

  // Handle objects and arrays
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return formatDateValue(value, options.dateFormat || 'MMM d, yyyy');
    }
    // Stringify arrays and objects
    return JSON.stringify(value);
  }

  // Format based on type
  switch (column.type) {
    case 'currency':
      return formatCurrencyValue(
        value,
        options.currencyLocale || 'en-US',
        options.currencyCode || 'USD'
      );
    case 'percent':
      return formatPercentValue(value);
    case 'number':
      return formatNumberValue(value);
    case 'date':
      return formatDateValue(value, options.dateFormat || 'MMM d, yyyy');
    case 'datetime':
      return formatDateValue(value, options.datetimeFormat || 'MMM d, yyyy h:mm a');
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Escape a value for CSV format
 * Handles special characters: commas, quotes, newlines
 */
function escapeCSVValue(value: string): string {
  if (value === '') return '';
  // Check if value contains special characters that require quoting
  const needsQuoting = /[",\n\r\t]/.test(value);
  if (needsQuoting) {
    // Escape double quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Create a download link and trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Log export activity
 */
async function logExportActivity(
  filename: string,
  format: 'csv' | 'json',
  rowCount: number,
  options: ExportOptions
): Promise<void> {
  if (!options.tenantId || !options.userId) {
    logger.debug('Skipping activity log - missing tenantId or userId', {
      tenantId: options.tenantId,
      userId: options.userId,
    });
    return;
  }

  await logActivity(
    options.tenantId,
    options.userId,
    ActivityAction.EXPORTED,
    options.entityType || EntityType.REPORT,
    null,
    {
      filename,
      format,
      rowCount,
      ...options.metadata,
    }
  );
}

/**
 * Export data to CSV format
 *
 * @param data - Array of data objects to export
 * @param columns - Column configuration for header mapping and formatting
 * @param filename - Name of the file to download
 * @param options - Export options (BOM, date format, activity logging)
 *
 * @example
 * const columns = [
 *   { key: 'id', header: 'Order ID' },
 *   { key: 'customer.name', header: 'Customer Name' },
 *   { key: 'total', header: 'Total', type: 'currency' },
 *   { key: 'created_at', header: 'Date', type: 'date' },
 * ];
 * await exportToCSV(orders, columns, 'orders.csv', { tenantId, userId });
 */
export async function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!data || data.length === 0) {
    logger.warn('exportToCSV called with empty data', { filename });
    return;
  }

  try {
    // Build header row
    const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(',');

    // Build data rows
    const dataRows = data.map((row) => {
      return columns
        .map((col) => {
          const value = getNestedValue(row, col.key);
          const formatted = formatCellValue(value, row, col, opts);
          return escapeCSVValue(formatted);
        })
        .join(',');
    });

    // Combine into CSV content
    const csvContent = [headerRow, ...dataRows].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const content = opts.includeBOM ? '\uFEFF' + csvContent : csvContent;

    // Download the file
    downloadFile(content, filename, 'text/csv;charset=utf-8');

    logger.info('CSV export completed', {
      filename,
      rowCount: data.length,
      columnCount: columns.length,
    });

    // Log activity
    await logExportActivity(filename, 'csv', data.length, opts);
  } catch (error) {
    logger.error('Failed to export CSV', error, { filename });
    throw error;
  }
}

/**
 * Export data to JSON format
 *
 * @param data - Array of data objects to export
 * @param filename - Name of the file to download
 * @param options - Export options (activity logging)
 *
 * @example
 * await exportToJSON(products, 'products.json', { tenantId, userId });
 */
export async function exportToJSON<T>(
  data: T[],
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  if (!data || data.length === 0) {
    logger.warn('exportToJSON called with empty data', { filename });
    return;
  }

  try {
    // Create JSON content with pretty printing
    const jsonContent = JSON.stringify(data, null, 2);

    // Download the file
    downloadFile(jsonContent, filename, 'application/json');

    logger.info('JSON export completed', {
      filename,
      rowCount: Array.isArray(data) ? data.length : 1,
    });

    // Log activity
    await logExportActivity(
      filename,
      'json',
      Array.isArray(data) ? data.length : 1,
      options
    );
  } catch (error) {
    logger.error('Failed to export JSON', error, { filename });
    throw error;
  }
}

/**
 * Helper to generate timestamped filename
 */
export function generateFilename(baseName: string, extension: 'csv' | 'json'): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Helper to create column configuration quickly
 */
export const ColumnBuilder = {
  text: <T extends Record<string, unknown>>(
    key: string,
    header: string
  ): ExportColumn<T> => ({
    key,
    header,
    type: 'string',
  }),

  number: <T extends Record<string, unknown>>(
    key: string,
    header: string
  ): ExportColumn<T> => ({
    key,
    header,
    type: 'number',
  }),

  currency: <T extends Record<string, unknown>>(
    key: string,
    header: string
  ): ExportColumn<T> => ({
    key,
    header,
    type: 'currency',
  }),

  percent: <T extends Record<string, unknown>>(
    key: string,
    header: string
  ): ExportColumn<T> => ({
    key,
    header,
    type: 'percent',
  }),

  date: <T extends Record<string, unknown>>(
    key: string,
    header: string
  ): ExportColumn<T> => ({
    key,
    header,
    type: 'date',
  }),

  datetime: <T extends Record<string, unknown>>(
    key: string,
    header: string
  ): ExportColumn<T> => ({
    key,
    header,
    type: 'datetime',
  }),

  boolean: <T extends Record<string, unknown>>(
    key: string,
    header: string
  ): ExportColumn<T> => ({
    key,
    header,
    type: 'boolean',
  }),

  custom: <T extends Record<string, unknown>>(
    key: string,
    header: string,
    format: (value: unknown, row: T) => string
  ): ExportColumn<T> => ({
    key,
    header,
    format,
  }),
};
