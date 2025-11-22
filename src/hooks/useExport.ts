import { logger } from '@/lib/logger';
/**
 * useExport Hook
 * Simplified data export functionality
 */

import { useCallback } from 'react';
import { exportToCSV, exportToJSON } from '@/lib/utils/exportData';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

interface ExportOptions {
  filename?: string;
  headers?: string[];
}

export function useExport() {
  const exportCSV = useCallback(
    <T extends Record<string, any>>(
      data: T[],
      options: ExportOptions = {}
    ) => {
      try {
        if (!data || data.length === 0) {
          showErrorToast('No data to export');
          return;
        }

        const filename = options.filename || `export-${new Date().toISOString().split('T')[0]}.csv`;
        exportToCSV(data, filename, options.headers);
        showSuccessToast('Data exported successfully');
      } catch (error) {
        logger.error('Export error:', error);
        showErrorToast('Failed to export data');
      }
    },
    []
  );

  const exportJSON = useCallback(
    <T>(data: T[], options: ExportOptions = {}) => {
      try {
        if (!data || data.length === 0) {
          showErrorToast('No data to export');
          return;
        }

        const filename = options.filename || `export-${new Date().toISOString().split('T')[0]}.json`;
        exportToJSON(data, filename);
        showSuccessToast('Data exported successfully');
      } catch (error) {
        logger.error('Export error:', error);
        showErrorToast('Failed to export data');
      }
    },
    []
  );

  return {
    exportCSV,
    exportJSON,
  };
}

