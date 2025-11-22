import { logger } from '@/lib/logger';
/**
 * Data Export Utilities
 * Export data to CSV, JSON, Excel formats
 */

/**
 * Export data to CSV
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string = 'export.csv',
  headers?: string[]
): void {
  if (!data || data.length === 0) {
    logger.warn('No data to export');
    return;
  }

  // Get headers from data keys or use provided headers
  const csvHeaders = headers || Object.keys(data[0]);

  // Escape CSV values
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Create CSV content
  const csvContent = [
    csvHeaders.map(escapeCSV).join(','),
    ...data.map((row) =>
      csvHeaders.map((header) => escapeCSV(row[header])).join(',')
    ),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to JSON
 */
export function exportToJSON<T>(data: T[], filename: string = 'export.json'): void {
  if (!data || data.length === 0) {
    logger.warn('No data to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for export
 */
export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.toISOString().split('T')[0];
}

/**
 * Format currency for export (without currency symbol)
 */
export function formatCurrencyForExport(
  amount: number | string | null | undefined
): string {
  if (amount === null || amount === undefined || amount === '') return '0.00';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0.00';
  return numAmount.toFixed(2);
}

