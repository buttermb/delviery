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

  const getHeaders = () => {
    if (columns) {
      return columns.map(c => c.label);
    }
    if (data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  };

  const getKeys = () => {
    if (columns) {
      return columns.map(c => c.key);
    }
    if (data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const exportCSV = () => {
    setIsExporting(true);
    try {
      const headers = getHeaders();
      const keys = getKeys();
      
      const csvContent = [
        headers.join(","),
        ...data.map(row => 
          keys.map(key => {
            const value = formatValue(row[key]);
            // Escape quotes and wrap in quotes if contains comma
            if (value.includes(",") || value.includes('"') || value.includes("\n")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(",")
        )
      ].join("\n");

      downloadFile(csvContent, `${filename}.csv`, "text/csv");
      toast.success(`Exported ${data.length} rows to CSV`);
    } catch (error) {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const exportJSON = () => {
    setIsExporting(true);
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      downloadFile(jsonContent, `${filename}.json`, "application/json");
      toast.success(`Exported ${data.length} rows to JSON`);
    } catch (error) {
      toast.error("Failed to export JSON");
    } finally {
      setIsExporting(false);
    }
  };

  const exportExcel = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const headers = getHeaders();
      const keys = getKeys();
      
      const wsData = [
        headers,
        ...data.map(row => keys.map(key => formatValue(row[key])))
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${filename}.xlsx`);
      
      toast.success(`Exported ${data.length} rows to Excel`);
    } catch (error) {
      toast.error("Failed to export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        <DropdownMenuItem onClick={exportCSV}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportJSON}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}