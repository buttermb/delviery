/**
 * Export Utilities
 * 
 * Standardized CSV and Excel export with proper formatting.
 */

import { format } from 'date-fns';

// Local formatting helpers
function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercentValue(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatQuantityValue(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDateValue(value: unknown, formatStr: string): string {
  try {
    const date = value instanceof Date ? value : new Date(value as string | number);
    return format(date, formatStr);
  } catch {
    return String(value);
  }
}

export interface ExportColumn<T> {
  key: keyof T;
  header: string;
  /** Format function for the cell value */
  format?: (value: unknown, row: T) => string;
  /** Column type for automatic formatting */
  type?: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean';
}

export interface ExportOptions {
  /** Include BOM for Excel UTF-8 compatibility */
  includeBOM?: boolean;
  /** Date format string */
  dateFormat?: string;
  /** Currency code */
  currencyCode?: string;
  /** Sheet name for Excel exports */
  sheetName?: string;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeBOM: true,
  dateFormat: 'MMM d, yyyy',
  currencyCode: 'USD',
  sheetName: 'Export',
};

/**
 * Escape a cell value for CSV
 */
function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  const needsQuotes = /[",\n\r]/.test(stringValue);
  if (needsQuotes) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Format a cell value based on type
 */
function formatCellValue<T>(
  value: unknown,
  row: T,
  column: ExportColumn<T>,
  options: ExportOptions
): string {
  if (column.format) return column.format(value, row);
  if (value === null || value === undefined) return '';

  switch (column.type) {
    case 'currency':
      return formatCurrencyValue(Number(value));
    case 'percent':
      return formatPercentValue(Number(value));
    case 'number':
      return formatQuantityValue(Number(value));
    case 'date':
      return formatDateValue(value, options.dateFormat || 'MMM d, yyyy');
    case 'datetime':
      return formatDateValue(value, 'MMM d, yyyy h:mm a');
    
    case 'boolean':
      return value ? 'Yes' : 'No';
    
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  options: ExportOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Build header row
  const headers = columns.map(col => escapeCSVCell(col.header));
  
  // Build data rows
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      const formatted = formatCellValue(value, row, col, opts);
      return escapeCSVCell(formatted);
    })
  );
  
  // Combine into CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Add BOM for Excel compatibility
  const content = opts.includeBOM 
    ? '\uFEFF' + csvContent 
    : csvContent;
  
  // Download file
  downloadFile(content, filename, 'text/csv;charset=utf-8');
}

/**
 * Export data to JSON format
 */
export function exportToJSON<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  pretty = true
): void {
  const content = pretty 
    ? JSON.stringify(data, null, 2) 
    : JSON.stringify(data);
  
  downloadFile(content, filename, 'application/json');
}

/**
 * Download a file in the browser
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Generate a timestamped filename
 */
export function generateExportFilename(
  baseName: string,
  extension: string
): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Helper to create common export columns
 */
export const ExportColumnHelpers = {
  text: <T>(key: keyof T, header: string): ExportColumn<T> => ({
    key,
    header,
    type: 'string',
  }),
  
  number: <T>(key: keyof T, header: string): ExportColumn<T> => ({
    key,
    header,
    type: 'number',
  }),
  
  currency: <T>(key: keyof T, header: string): ExportColumn<T> => ({
    key,
    header,
    type: 'currency',
  }),
  
  percent: <T>(key: keyof T, header: string): ExportColumn<T> => ({
    key,
    header,
    type: 'percent',
  }),
  
  date: <T>(key: keyof T, header: string): ExportColumn<T> => ({
    key,
    header,
    type: 'date',
  }),
  
  datetime: <T>(key: keyof T, header: string): ExportColumn<T> => ({
    key,
    header,
    type: 'datetime',
  }),
  
  boolean: <T>(key: keyof T, header: string): ExportColumn<T> => ({
    key,
    header,
    type: 'boolean',
  }),
  
  custom: <T>(
    key: keyof T,
    header: string,
    format: (value: unknown, row: T) => string
  ): ExportColumn<T> => ({
    key,
    header,
    format,
  }),
};

/**
 * Quick export function for simple use cases
 */
export function quickExportCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string
): void {
  if (data.length === 0) return;
  
  // Auto-generate columns from first row keys
  const columns: ExportColumn<T>[] = Object.keys(data[0]).map(key => ({
    key: key as keyof T,
    header: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    type: 'string',
  }));
  
  exportToCSV(data, columns, filename);
}
