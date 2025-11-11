// @ts-nocheck
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileSpreadsheet as ExcelIcon } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface AnalyticsExportButtonProps {
  data: Record<string, unknown> | unknown[];
  filename: string;
}

export const AnalyticsExportButton = ({ data, filename }: AnalyticsExportButtonProps) => {
  const exportToCSV = () => {
    try {
      const csvContent = convertToCSV(data);
      downloadFile(csvContent, `${filename}.csv`, 'text/csv');
      toast.success('Analytics exported to CSV');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const exportToJSON = () => {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      downloadFile(jsonContent, `${filename}.json`, 'application/json');
      toast.success('Analytics exported to JSON');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const exportToExcel = () => {
    try {
      let worksheetData: Record<string, unknown>[];
      
      if (Array.isArray(data)) {
        worksheetData = data as Record<string, unknown>[];
      } else if (typeof data === 'object' && data !== null) {
        // Convert object to array of key-value pairs
        worksheetData = Object.entries(data).map(([key, value]) => ({
          Metric: key,
          Value: value,
        }));
      } else {
        worksheetData = [{ Value: data }];
      }

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // Auto-size columns
      const maxWidth = worksheetData.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
      worksheet['!cols'] = Array.from({ length: maxWidth }, () => ({ wch: 15 }));
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');
      
      // Generate Excel file
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      toast.success('Analytics exported to Excel');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export to Excel');
    }
  };

  const convertToCSV = (obj: Record<string, unknown> | unknown[]): string => {
    if (Array.isArray(obj)) {
      const headers = Object.keys(obj[0]).join(',');
      const rows = obj.map(row => Object.values(row).join(',')).join('\n');
      return `${headers}\n${rows}`;
    }
    const headers = Object.keys(obj).join(',');
    const values = Object.values(obj).join(',');
    return `${headers}\n${values}`;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel}>
          <ExcelIcon className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON}>
          <FileText className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
