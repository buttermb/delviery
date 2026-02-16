import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileJson, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { 
  exportToCSV, 
  exportToJSON, 
  ExportColumn, 
  generateExportFilename 
} from "@/lib/utils/exportUtils";

interface ExportButtonProps {
  data: Record<string, any>[];
  filename?: string;
  columns?: { key: string; label: string }[];
  disabled?: boolean;
}

export function ExportButton({ 
  data, 
  filename = "export", 
  columns,
  disabled = false 
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const getExportColumns = (): ExportColumn<Record<string, any>>[] => {
    if (columns) {
      return columns.map(c => ({
        key: c.key,
        header: c.label,
        type: 'string' as const,
      }));
    }
    if (data.length > 0) {
      return Object.keys(data[0]).map(key => ({
        key,
        header: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'string' as const,
      }));
    }
    return [];
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const exportColumns = getExportColumns();
      const exportFilename = generateExportFilename(filename, 'csv');
      exportToCSV(data, exportColumns, exportFilename);
      toast.success(`Exported ${data.length} rows to CSV`);
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      const exportFilename = generateExportFilename(filename, 'json');
      exportToJSON(data, exportFilename);
      toast.success(`Exported ${data.length} rows to JSON`);
    } catch {
      toast.error("Failed to export JSON");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const headers = columns 
        ? columns.map(c => c.label)
        : data.length > 0 ? Object.keys(data[0]) : [];
      const keys = columns
        ? columns.map(c => c.key)
        : data.length > 0 ? Object.keys(data[0]) : [];
      
      const wsData = [
        headers,
        ...data.map(row => keys.map(key => {
          const value = row[key];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        }))
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, generateExportFilename(filename, 'xlsx'));
      
      toast.success(`Exported ${data.length} rows to Excel`);
    } catch {
      toast.error("Failed to export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  if (data.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}