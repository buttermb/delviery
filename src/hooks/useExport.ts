/**
 * useExport Hook
 *
 * React hook that wraps the shared export utility with React state.
 * Provides CSV and JSON export functionality with:
 * - Progress tracking for large datasets
 * - Toast notifications for success/error
 * - Activity logging via useActivityLog
 * - Column configuration support
 *
 * Usage:
 *   const { exportCSV, exportJSON, isExporting, progress } = useExport();
 *   await exportCSV(orders, orderColumns, 'orders.csv');
 */

import { useCallback, useState } from 'react';

import type { ExportColumn, ExportOptions } from '@/lib/export';
import { exportToCSV, exportToJSON, generateFilename } from '@/lib/export';
import { useActivityLog, ActivityAction, EntityType } from '@/hooks/useActivityLog';
import { useTenantContext } from '@/hooks/useTenantContext';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';

/**
 * Progress state for export operations
 */
export interface ExportProgress {
  /** Number of rows processed */
  current: number;
  /** Total rows to process */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current phase of export */
  phase: 'preparing' | 'processing' | 'downloading' | 'complete';
}

/**
 * Options for export operations via the hook
 */
export interface UseExportOptions {
  /** Entity type for activity logging (default: 'report') */
  entityType?: string;
  /** Additional metadata to log with export activity */
  metadata?: Record<string, unknown>;
}

/**
 * Return type for the useExport hook
 */
export interface UseExportResult {
  /** Export data to CSV format with column configuration */
  exportCSV: <T extends Record<string, unknown>>(
    data: T[],
    columns: ExportColumn<T>[],
    filename?: string,
    options?: UseExportOptions
  ) => Promise<void>;
  /** Export data to JSON format */
  exportJSON: <T>(
    data: T[],
    filename?: string,
    options?: UseExportOptions
  ) => Promise<void>;
  /** Whether an export operation is in progress */
  isExporting: boolean;
  /** Current progress of the export operation */
  progress: ExportProgress | null;
  /** Clear progress state manually */
  clearProgress: () => void;
}

/**
 * Threshold for showing progress indicator (rows)
 */
const LARGE_DATASET_THRESHOLD = 1000;

/**
 * Estimate export time based on data size
 */
function estimateExportTime(rowCount: number): string {
  if (rowCount < 1000) return 'a moment';
  if (rowCount < 5000) return 'a few seconds';
  if (rowCount < 10000) return 'about 10 seconds';
  if (rowCount < 50000) return 'about 30 seconds';
  return 'about a minute';
}

/**
 * Hook for exporting data with React state management
 *
 * @returns Object with export functions, loading state, and progress
 *
 * @example
 * ```tsx
 * const { exportCSV, exportJSON, isExporting, progress } = useExport();
 *
 * const columns = [
 *   { key: 'id', header: 'Order ID' },
 *   { key: 'customer.name', header: 'Customer' },
 *   { key: 'total', header: 'Total', type: 'currency' },
 * ];
 *
 * const handleExport = async () => {
 *   await exportCSV(orders, columns, 'orders.csv');
 * };
 *
 * // Show progress for large datasets
 * {progress && (
 *   <Progress value={progress.percentage} />
 * )}
 * ```
 */
export function useExport(): UseExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const { tenantId, userId, isReady } = useTenantContext();
  const { logActivity } = useActivityLog();

  /**
   * Clear progress state
   */
  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  /**
   * Update progress for large dataset exports
   */
  const updateProgress = useCallback(
    (current: number, total: number, phase: ExportProgress['phase']) => {
      setProgress({
        current,
        total,
        percentage: Math.round((current / total) * 100),
        phase,
      });
    },
    []
  );

  /**
   * Export data to CSV with column configuration
   */
  const handleExportCSV = useCallback(
    async <T extends Record<string, unknown>>(
      data: T[],
      columns: ExportColumn<T>[],
      filename?: string,
      options: UseExportOptions = {}
    ): Promise<void> => {
      if (!data || data.length === 0) {
        showErrorToast('No data to export', 'The dataset is empty');
        return;
      }

      const exportFilename = filename || generateFilename('export', 'csv');
      const isLargeDataset = data.length >= LARGE_DATASET_THRESHOLD;

      logger.info('[useExport] Starting CSV export', {
        filename: exportFilename,
        rowCount: data.length,
        columnCount: columns.length,
        isLargeDataset,
      });

      try {
        setIsExporting(true);

        // Show info toast for large datasets
        if (isLargeDataset) {
          showInfoToast(
            `Exporting ${data.length.toLocaleString()} rows`,
            `This will take ${estimateExportTime(data.length)}`
          );
          updateProgress(0, data.length, 'preparing');
        }

        // Simulate progress for user feedback on large datasets
        if (isLargeDataset) {
          updateProgress(Math.floor(data.length * 0.1), data.length, 'processing');
        }

        // Build export options with tenant context for activity logging
        const exportOptions: ExportOptions = {
          tenantId: tenantId ?? undefined,
          userId: userId ?? undefined,
          entityType: options.entityType || EntityType.REPORT,
          metadata: {
            ...options.metadata,
            source: 'useExport',
            columnCount: columns.length,
          },
        };

        // Perform the export
        await exportToCSV(data, columns, exportFilename, exportOptions);

        // Update progress to complete
        if (isLargeDataset) {
          updateProgress(data.length, data.length, 'complete');
        }

        // Log activity via hook (additional logging - export utility also logs)
        if (isReady) {
          await logActivity(
            ActivityAction.EXPORTED,
            options.entityType || EntityType.REPORT,
            null,
            {
              filename: exportFilename,
              format: 'csv',
              rowCount: data.length,
              columnCount: columns.length,
              ...options.metadata,
            }
          );
        }

        showSuccessToast(
          'Export complete',
          `${data.length.toLocaleString()} rows exported to ${exportFilename}`
        );

        logger.info('[useExport] CSV export completed', {
          filename: exportFilename,
          rowCount: data.length,
        });
      } catch (error) {
        logger.error('[useExport] CSV export failed', error, {
          filename: exportFilename,
        });
        showErrorToast(
          'Export failed',
          error instanceof Error ? error.message : 'An unexpected error occurred'
        );
        throw error;
      } finally {
        setIsExporting(false);
        // Clear progress after a short delay for UI feedback
        setTimeout(() => setProgress(null), 1000);
      }
    },
    [tenantId, userId, isReady, logActivity, updateProgress]
  );

  /**
   * Export data to JSON format
   */
  const handleExportJSON = useCallback(
    async <T>(
      data: T[],
      filename?: string,
      options: UseExportOptions = {}
    ): Promise<void> => {
      if (!data || data.length === 0) {
        showErrorToast('No data to export', 'The dataset is empty');
        return;
      }

      const exportFilename = filename || generateFilename('export', 'json');
      const rowCount = Array.isArray(data) ? data.length : 1;
      const isLargeDataset = rowCount >= LARGE_DATASET_THRESHOLD;

      logger.info('[useExport] Starting JSON export', {
        filename: exportFilename,
        rowCount,
        isLargeDataset,
      });

      try {
        setIsExporting(true);

        // Show info toast for large datasets
        if (isLargeDataset) {
          showInfoToast(
            `Exporting ${rowCount.toLocaleString()} items`,
            `This will take ${estimateExportTime(rowCount)}`
          );
          updateProgress(0, rowCount, 'preparing');
        }

        // Simulate progress for user feedback on large datasets
        if (isLargeDataset) {
          updateProgress(Math.floor(rowCount * 0.1), rowCount, 'processing');
        }

        // Build export options with tenant context for activity logging
        const exportOptions: ExportOptions = {
          tenantId: tenantId ?? undefined,
          userId: userId ?? undefined,
          entityType: options.entityType || EntityType.REPORT,
          metadata: {
            ...options.metadata,
            source: 'useExport',
          },
        };

        // Perform the export
        await exportToJSON(data, exportFilename, exportOptions);

        // Update progress to complete
        if (isLargeDataset) {
          updateProgress(rowCount, rowCount, 'complete');
        }

        // Log activity via hook
        if (isReady) {
          await logActivity(
            ActivityAction.EXPORTED,
            options.entityType || EntityType.REPORT,
            null,
            {
              filename: exportFilename,
              format: 'json',
              rowCount,
              ...options.metadata,
            }
          );
        }

        showSuccessToast(
          'Export complete',
          `${rowCount.toLocaleString()} items exported to ${exportFilename}`
        );

        logger.info('[useExport] JSON export completed', {
          filename: exportFilename,
          rowCount,
        });
      } catch (error) {
        logger.error('[useExport] JSON export failed', error, {
          filename: exportFilename,
        });
        showErrorToast(
          'Export failed',
          error instanceof Error ? error.message : 'An unexpected error occurred'
        );
        throw error;
      } finally {
        setIsExporting(false);
        // Clear progress after a short delay for UI feedback
        setTimeout(() => setProgress(null), 1000);
      }
    },
    [tenantId, userId, isReady, logActivity, updateProgress]
  );

  return {
    exportCSV: handleExportCSV,
    exportJSON: handleExportJSON,
    isExporting,
    progress,
    clearProgress,
  };
}

// Re-export types and helpers for convenience
export type { ExportColumn, ExportOptions };
export { generateFilename, ColumnBuilder } from '@/lib/export';

export default useExport;
