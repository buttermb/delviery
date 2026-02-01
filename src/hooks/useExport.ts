import { logger } from '@/lib/logger';
/**
 * useExport Hook
 * Simplified data export functionality with progress support for large datasets
 */

import { useCallback, useState } from 'react';
import { 
  exportToCSV, 
  exportToJSON, 
  isLargeDataset, 
  estimateExportTime,
  type ExportProgress 
} from '@/lib/utils/exportData';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/utils/toastHelpers';

interface ExportOptions {
  filename?: string;
  headers?: string[];
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const handleProgress = useCallback((p: ExportProgress) => {
    setProgress(p);
  }, []);

  const exportCSV = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <T extends Record<string, any>>(
      data: T[],
      options: ExportOptions = {}
    ) => {
      try {
        if (!data || data.length === 0) {
          showErrorToast('No data to export');
          return;
        }

        setIsExporting(true);
        setProgress(null);

        // Warn about large datasets
        if (isLargeDataset(data.length)) {
          showInfoToast(`Large export (${data.length.toLocaleString()} rows). This will take ${estimateExportTime(data.length)}.`);
        }

        const filename = options.filename || `export-${new Date().toISOString().split('T')[0]}.csv`;
        exportToCSV(data, filename, options.headers, handleProgress);
        
        // Show success after a small delay for large datasets
        setTimeout(() => {
          showSuccessToast('Data exported successfully');
          setIsExporting(false);
          setProgress(null);
        }, isLargeDataset(data.length) ? 500 : 0);
      } catch (error) {
        logger.error('Export error:', error);
        showErrorToast('Failed to export data');
        setIsExporting(false);
        setProgress(null);
      }
    },
    [handleProgress]
  );

  const exportJSON = useCallback(
    <T>(data: T[], options: ExportOptions = {}) => {
      try {
        if (!data || data.length === 0) {
          showErrorToast('No data to export');
          return;
        }

        setIsExporting(true);
        setProgress(null);

        if (isLargeDataset(data.length)) {
          showInfoToast(`Large export (${data.length.toLocaleString()} rows). This will take ${estimateExportTime(data.length)}.`);
        }

        const filename = options.filename || `export-${new Date().toISOString().split('T')[0]}.json`;
        exportToJSON(data, filename, handleProgress);
        
        setTimeout(() => {
          showSuccessToast('Data exported successfully');
          setIsExporting(false);
          setProgress(null);
        }, isLargeDataset(data.length) ? 500 : 0);
      } catch (error) {
        logger.error('Export error:', error);
        showErrorToast('Failed to export data');
        setIsExporting(false);
        setProgress(null);
      }
    },
    [handleProgress]
  );

  return {
    exportCSV,
    exportJSON,
    isExporting,
    progress,
  };
}

