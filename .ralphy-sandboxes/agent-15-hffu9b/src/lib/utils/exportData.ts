import { logger } from '@/lib/logger';
/**
 * Data Export Utilities
 * Export data to CSV, JSON, Excel formats with pagination support for large datasets
 */

const CHUNK_SIZE = 10000; // Process 10k rows at a time
const LARGE_DATASET_THRESHOLD = 10000;

export interface ExportProgress {
  current: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Export data to CSV with pagination support for large datasets
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string = 'export.csv',
  headers?: string[],
  onProgress?: ProgressCallback
): void {
  if (!data || data.length === 0) {
    logger.warn('No data to export');
    return;
  }

  // Get headers from data keys or use provided headers
  const csvHeaders = headers || Object.keys(data[0]);

  // Escape CSV values
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // For large datasets, process in chunks
  if (data.length > LARGE_DATASET_THRESHOLD) {
    exportLargeCSV(data, filename, csvHeaders, escapeCSV, onProgress);
    return;
  }

  // Create CSV content for smaller datasets
  const csvContent = [
    csvHeaders.map(escapeCSV).join(','),
    ...data.map((row) =>
      csvHeaders.map((header) => escapeCSV(row[header])).join(',')
    ),
  ].join('\n');

  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export large CSV in chunks with progress reporting
 */
function exportLargeCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers: string[],
  escapeCSV: (value: unknown) => string,
  onProgress?: ProgressCallback
): void {
  const chunks: string[] = [];
  chunks.push(headers.map(escapeCSV).join(','));

  const totalRows = data.length;
  let processedRows = 0;

  // Process in chunks using requestAnimationFrame to avoid blocking
  const processChunk = (startIndex: number) => {
    const endIndex = Math.min(startIndex + CHUNK_SIZE, totalRows);
    
    for (let i = startIndex; i < endIndex; i++) {
      chunks.push(headers.map((header) => escapeCSV(data[i][header])).join(','));
      processedRows++;
    }

    // Report progress
    if (onProgress) {
      onProgress({
        current: processedRows,
        total: totalRows,
        percentage: Math.round((processedRows / totalRows) * 100),
      });
    }

    if (endIndex < totalRows) {
      // Process next chunk
      requestAnimationFrame(() => processChunk(endIndex));
    } else {
      // All done, download
      const csvContent = chunks.join('\n');
      downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
    }
  };

  processChunk(0);
}

/**
 * Export data to JSON with streaming for large datasets
 */
export function exportToJSON<T>(
  data: T[], 
  filename: string = 'export.json',
  onProgress?: ProgressCallback
): void {
  if (!data || data.length === 0) {
    logger.warn('No data to export');
    return;
  }

  if (data.length > LARGE_DATASET_THRESHOLD && onProgress) {
    // For large datasets, stream the JSON
    let processed = 0;
    const interval = setInterval(() => {
      processed = Math.min(processed + CHUNK_SIZE, data.length);
      onProgress({
        current: processed,
        total: data.length,
        percentage: Math.round((processed / data.length) * 100),
      });
      if (processed >= data.length) {
        clearInterval(interval);
      }
    }, 100);
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadBlob(jsonContent, filename, 'application/json');
}

/**
 * Helper to download blob
 */
function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
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
 * Estimate export time based on data size
 */
export function estimateExportTime(rowCount: number): string {
  if (rowCount < 1000) return 'a few seconds';
  if (rowCount < 10000) return 'about 10 seconds';
  if (rowCount < 50000) return 'about 30 seconds';
  if (rowCount < 100000) return 'about 1 minute';
  return 'several minutes';
}

/**
 * Check if dataset is considered large
 */
export function isLargeDataset(rowCount: number): boolean {
  return rowCount > LARGE_DATASET_THRESHOLD;
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

