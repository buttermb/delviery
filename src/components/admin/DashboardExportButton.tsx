/**
 * DashboardExportButton
 *
 * Export dashboard views as PDF, CSV, or Excel.
 * Uses html2canvas + jsPDF for capturing the current view as a PDF screenshot.
 */

import { useState, type RefObject } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Download from "lucide-react/dist/esm/icons/download";
import FileImage from "lucide-react/dist/esm/icons/file-image";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";
import FileText from "lucide-react/dist/esm/icons/file-text";
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { generateExportFilename } from '@/lib/utils/exportUtils';

export interface DashboardExportData {
  /** Key-value pairs of dashboard metrics */
  metrics?: Record<string, string | number>;
  /** Array data for CSV/Excel export */
  tableData?: Record<string, unknown>[];
}

export interface DashboardExportButtonProps {
  /** Ref to the dashboard element to capture for PDF */
  targetRef: RefObject<HTMLElement | null>;
  /** Base filename for exports (without extension) */
  filename?: string;
  /** Optional title for the export */
  title?: string;
  /** Optional structured data for CSV/Excel exports */
  data?: DashboardExportData;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const DashboardExportButton = ({
  targetRef,
  filename = 'dashboard-export',
  title = 'Dashboard Export',
  data,
  variant = 'outline',
  size = 'sm',
}: DashboardExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    if (!targetRef.current) {
      toast.error('No content to export');
      return;
    }

    setIsExporting(true);
    toast.info('Generating PDF...', { id: 'export-pdf' });

    try {
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const exportFilename = generateExportFilename(filename, 'pdf');
      pdf.save(exportFilename);

      toast.success('PDF exported successfully', { id: 'export-pdf' });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('PDF export failed', errorObj, { component: 'DashboardExportButton' });
      toast.error('Failed to export PDF', { id: 'export-pdf' });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = () => {
    try {
      let csvContent: string;

      if (data?.tableData && data.tableData.length > 0) {
        // Export table data
        const headers = Object.keys(data.tableData[0]).join(',');
        const rows = data.tableData
          .map((row) =>
            Object.values(row)
              .map((val) => {
                const strVal = String(val ?? '');
                return strVal.includes(',') || strVal.includes('"')
                  ? `"${strVal.replace(/"/g, '""')}"`
                  : strVal;
              })
              .join(',')
          )
          .join('\n');
        csvContent = `${headers}\n${rows}`;
      } else if (data?.metrics) {
        // Export metrics as key-value pairs
        csvContent = 'Metric,Value\n';
        csvContent += Object.entries(data.metrics)
          .map(([key, value]) => `"${key}","${value}"`)
          .join('\n');
      } else {
        toast.error('No data available for CSV export');
        return;
      }

      // Add BOM for Excel UTF-8 compatibility
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateExportFilename(filename, 'csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('CSV exported successfully');
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('CSV export failed', errorObj, { component: 'DashboardExportButton' });
      toast.error('Failed to export CSV');
    }
  };

  const exportToExcel = () => {
    try {
      let worksheetData: Record<string, unknown>[];

      if (data?.tableData && data.tableData.length > 0) {
        worksheetData = data.tableData;
      } else if (data?.metrics) {
        // Convert metrics to array format for Excel
        worksheetData = Object.entries(data.metrics).map(([key, value]) => ({
          Metric: key,
          Value: value,
        }));
      } else {
        toast.error('No data available for Excel export');
        return;
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // Auto-size columns
      const maxWidth = worksheetData.reduce(
        (w, r) => Math.max(w, Object.keys(r).length),
        10
      );
      worksheet['!cols'] = Array.from({ length: maxWidth }, () => ({ wch: 20 }));

      XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));
      XLSX.writeFile(workbook, generateExportFilename(filename, 'xlsx'));

      toast.success('Excel exported successfully');
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Excel export failed', errorObj, { component: 'DashboardExportButton' });
      toast.error('Failed to export Excel');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isExporting} loading={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToPDF} disabled={isExporting}>
          <FileImage className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        {data && (
          <>
            <DropdownMenuItem onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToCSV}>
              <FileText className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
