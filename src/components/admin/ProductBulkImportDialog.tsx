import { useState, useMemo, useCallback } from "react";
import { read, utils } from "xlsx";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Upload from "lucide-react/dist/esm/icons/upload";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Download from "lucide-react/dist/esm/icons/download";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";
import Eye from "lucide-react/dist/esm/icons/eye";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { cn } from "@/lib/utils";

interface ProductBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = "upload" | "map" | "preview" | "importing" | "complete";

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "category";
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: "name", label: "Product Name", required: true, type: "text" },
  { key: "sku", label: "SKU", required: true, type: "text" },
  { key: "category", label: "Category", required: true, type: "category" },
  { key: "wholesale_price", label: "Wholesale Price", required: false, type: "number" },
  { key: "retail_price", label: "Retail Price", required: false, type: "number" },
  { key: "cost_per_unit", label: "Cost per Unit", required: false, type: "number" },
  { key: "available_quantity", label: "Quantity", required: false, type: "number" },
  { key: "description", label: "Description", required: false, type: "text" },
  { key: "vendor_name", label: "Vendor", required: false, type: "text" },
  { key: "strain_name", label: "Strain Name", required: false, type: "text" },
  { key: "strain_type", label: "Strain Type", required: false, type: "text" },
  { key: "thc_percent", label: "THC %", required: false, type: "number" },
  { key: "cbd_percent", label: "CBD %", required: false, type: "number" },
  { key: "batch_number", label: "Batch Number", required: false, type: "text" },
];

const VALID_CATEGORIES = ["flower", "edibles", "vapes", "concentrates", "prerolls", "tinctures", "topicals", "accessories"];

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestedValue?: string | number;
}

interface ValidatedRecord {
  row: number;
  data: Record<string, unknown>;
  normalized: Record<string, unknown>;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  selected: boolean;
}

interface ImportSummary {
  total: number;
  valid: number;
  withErrors: number;
  withWarnings: number;
  selected: number;
}

export function ProductBulkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProductBulkImportDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const [step, setStep] = useState<ImportStep>("upload");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Import Options
  const [decimalSeparator, setDecimalSeparator] = useState<"." | ",">(",");
  const [treatEmptyAsNull, setTreatEmptyAsNull] = useState(true);

  // Validation Preview State
  const [validatedRecords, setValidatedRecords] = useState<ValidatedRecord[]>([]);
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "errors" | "warnings">("all");

  // Import Results
  const [importResults, setImportResults] = useState<{
    imported: number;
    failed: number;
    skipped: number;
    failures: Array<{ row: number; reason: string; data: Record<string, unknown> }>;
  } | null>(null);

  // Parse number with decimal separator handling
  const parseNumber = useCallback((value: unknown): number => {
    if (typeof value === "number") return value;
    if (!value) return 0;
    let str = String(value).trim();
    if (decimalSeparator === ",") {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }, [decimalSeparator]);

  // Sanitize SKU to handle scientific notation from Excel
  const sanitizeSKU = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return "";
    const strVal = String(value);
    if (/^\d+(\.\d+)?[eE]\+\d+$/.test(strVal)) {
      if (typeof value === "number") {
        return value.toLocaleString("fullwide", { useGrouping: false });
      }
    }
    return strVal.trim();
  }, []);

  // Normalize category
  const normalizeCategory = useCallback((value: unknown): string | null => {
    if (!value) return null;
    const lower = String(value).toLowerCase().trim();

    // Direct match
    if (VALID_CATEGORIES.includes(lower)) return lower;

    // Fuzzy matching
    const mappings: Record<string, string> = {
      "flowers": "flower",
      "buds": "flower",
      "bud": "flower",
      "weed": "flower",
      "edible": "edibles",
      "gummies": "edibles",
      "gummy": "edibles",
      "chocolate": "edibles",
      "candy": "edibles",
      "vape": "vapes",
      "cartridge": "vapes",
      "cart": "vapes",
      "carts": "vapes",
      "concentrate": "concentrates",
      "wax": "concentrates",
      "shatter": "concentrates",
      "resin": "concentrates",
      "rosin": "concentrates",
      "hash": "concentrates",
      "preroll": "prerolls",
      "pre-roll": "prerolls",
      "joint": "prerolls",
      "joints": "prerolls",
      "tincture": "tinctures",
      "oil": "tinctures",
      "topical": "topicals",
      "lotion": "topicals",
      "cream": "topicals",
      "accessory": "accessories",
      "accessories": "accessories",
      "gear": "accessories",
    };

    return mappings[lower] || null;
  }, []);

  // Validate a single record
  const validateRecord = useCallback((
    record: Record<string, unknown>,
    rowIndex: number
  ): ValidatedRecord => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const normalized: Record<string, unknown> = {};

    // Map fields using user selection
    Object.entries(mapping).forEach(([systemKey, fileHeader]) => {
      if (fileHeader) {
        let val = record[fileHeader];
        if (typeof val === "string") val = val.trim();
        if (treatEmptyAsNull && val === "") {
          val = null;
        }
        normalized[systemKey] = val;
      }
    });

    // Sanitize SKU
    if (normalized.sku !== undefined && normalized.sku !== null) {
      normalized.sku = sanitizeSKU(normalized.sku);
    }

    // Validate required fields
    SYSTEM_FIELDS.filter((f) => f.required).forEach((field) => {
      const val = normalized[field.key];
      if (val === null || val === undefined || val === "") {
        errors.push({
          field: field.key,
          message: `${field.label} is required`,
          code: "REQUIRED_FIELD",
        });
      }
    });

    // Validate category
    if (normalized.category) {
      const normalizedCat = normalizeCategory(normalized.category);
      if (!normalizedCat) {
        errors.push({
          field: "category",
          message: `Invalid category "${normalized.category}". Must be one of: ${VALID_CATEGORIES.join(", ")}`,
          code: "INVALID_CATEGORY",
        });
      } else {
        if (normalizedCat !== String(normalized.category).toLowerCase()) {
          warnings.push({
            field: "category",
            message: `Category "${normalized.category}" will be normalized to "${normalizedCat}"`,
            code: "CATEGORY_NORMALIZED",
            suggestedValue: normalizedCat,
          });
        }
        normalized.category = normalizedCat;
      }
    }

    // Validate numeric fields
    const numericFields = ["wholesale_price", "retail_price", "cost_per_unit", "available_quantity", "thc_percent", "cbd_percent"];
    numericFields.forEach((field) => {
      if (normalized[field] !== null && normalized[field] !== undefined && normalized[field] !== "") {
        const num = parseNumber(normalized[field]);
        if (isNaN(num)) {
          errors.push({
            field,
            message: `${field} must be a valid number`,
            code: "INVALID_NUMBER",
          });
        } else {
          normalized[field] = num;

          // Specific validations
          if (field === "thc_percent" || field === "cbd_percent") {
            if (num < 0 || num > 100) {
              errors.push({
                field,
                message: `${field === "thc_percent" ? "THC" : "CBD"} percentage must be between 0 and 100`,
                code: "OUT_OF_RANGE",
              });
            } else if (num > 35 && field === "thc_percent") {
              warnings.push({
                field,
                message: `THC ${num}% is unusually high. Most cannabis is under 35%. Please verify.`,
                code: "THC_HIGH",
              });
            }
          }

          if ((field === "wholesale_price" || field === "retail_price" || field === "cost_per_unit") && num < 0) {
            errors.push({
              field,
              message: `${field} must be 0 or greater`,
              code: "NEGATIVE_PRICE",
            });
          }

          if (field === "available_quantity") {
            if (num < 0) {
              errors.push({
                field,
                message: "Quantity must be 0 or greater",
                code: "NEGATIVE_QUANTITY",
              });
            } else if (!Number.isInteger(num)) {
              warnings.push({
                field,
                message: `Quantity ${num} will be rounded to ${Math.floor(num)}`,
                code: "QUANTITY_ROUNDED",
                suggestedValue: Math.floor(num),
              });
              normalized[field] = Math.floor(num);
            }
          }
        }
      }
    });

    // Validate strain type
    if (normalized.strain_type) {
      const validStrainTypes = ["indica", "sativa", "hybrid"];
      const strainLower = String(normalized.strain_type).toLowerCase();
      if (!validStrainTypes.includes(strainLower)) {
        warnings.push({
          field: "strain_type",
          message: `Unknown strain type "${normalized.strain_type}". Expected: indica, sativa, or hybrid`,
          code: "INVALID_STRAIN_TYPE",
        });
      } else {
        normalized.strain_type = strainLower;
      }
    }

    return {
      row: rowIndex + 2, // +2 for header row and 0-indexing
      data: record,
      normalized,
      isValid: errors.length === 0,
      errors,
      warnings,
      selected: errors.length === 0, // Auto-select valid records
    };
  }, [mapping, treatEmptyAsNull, sanitizeSKU, normalizeCategory, parseNumber]);

  // Process file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const validExtensions = [".csv", ".xlsx", ".xls"];

    const isValid =
      validTypes.includes(selectedFile.type) ||
      validExtensions.some((ext) => selectedFile.name.endsWith(ext));

    if (!isValid) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array", codepage: 65001 });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: Record<string, unknown>[] = utils.sheet_to_json(worksheet, { defval: "" });

      if (jsonData.length === 0) {
        throw new Error("No records found in file");
      }

      const headers = Object.keys(jsonData[0]);
      setFileHeaders(headers);
      setRawRecords(jsonData);

      // Auto-map fields using fuzzy matching
      const initialMapping: Record<string, string> = {};
      SYSTEM_FIELDS.forEach((field) => {
        const match = headers.find((h) => {
          const hLower = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          const fieldLower = field.key.toLowerCase().replace(/[^a-z0-9]/g, "");
          const labelLower = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");
          return hLower === fieldLower || hLower.includes(labelLower) || labelLower.includes(hLower);
        });
        if (match) initialMapping[field.key] = match;
      });
      setMapping(initialMapping);
      setStep("map");

      toast.success(`Loaded ${jsonData.length} records from ${file.name}`);
    } catch (error) {
      logger.error("Error parsing file", error);
      toast.error("Failed to parse file. Please check format.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  // Run validation on all records
  const runValidation = useCallback(() => {
    setLoading(true);
    try {
      const validated = rawRecords.map((record, index) => validateRecord(record, index));
      setValidatedRecords(validated);
      setStep("preview");
    } catch (error) {
      logger.error("Validation error", error);
      toast.error("Failed to validate records");
    } finally {
      setLoading(false);
    }
  }, [rawRecords, validateRecord]);

  // Calculate summary
  const summary: ImportSummary = useMemo(() => {
    return {
      total: validatedRecords.length,
      valid: validatedRecords.filter((r) => r.isValid).length,
      withErrors: validatedRecords.filter((r) => r.errors.length > 0).length,
      withWarnings: validatedRecords.filter((r) => r.warnings.length > 0 && r.isValid).length,
      selected: validatedRecords.filter((r) => r.selected).length,
    };
  }, [validatedRecords]);

  // Filter records for preview
  const filteredRecords = useMemo(() => {
    switch (previewFilter) {
      case "valid":
        return validatedRecords.filter((r) => r.isValid && r.errors.length === 0);
      case "errors":
        return validatedRecords.filter((r) => r.errors.length > 0);
      case "warnings":
        return validatedRecords.filter((r) => r.warnings.length > 0 && r.isValid);
      default:
        return validatedRecords;
    }
  }, [validatedRecords, previewFilter]);

  // Toggle record selection
  const toggleRecordSelection = (index: number) => {
    setValidatedRecords((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  };

  // Select/deselect all valid records
  const toggleSelectAll = (selected: boolean) => {
    setValidatedRecords((prev) =>
      prev.map((r) => ({ ...r, selected: r.isValid ? selected : false }))
    );
  };

  // Execute import
  const handleImport = async () => {
    if (!tenant?.id) return;

    const recordsToImport = validatedRecords.filter((r) => r.selected && r.isValid);
    if (recordsToImport.length === 0) {
      toast.error("No valid records selected for import");
      return;
    }

    setStep("importing");
    setLoading(true);
    setProgress(0);

    const failures: Array<{ row: number; reason: string; data: Record<string, unknown> }> = [];
    let importedCount = 0;
    let skippedCount = 0;

    try {
      const batchSize = 10;

      for (let i = 0; i < recordsToImport.length; i += batchSize) {
        const batch = recordsToImport.slice(i, i + batchSize);

        const { error } = await supabase.from("products").insert(
          batch.map((record) => ({
            tenant_id: tenant.id,
            name: String(record.normalized.name || ""),
            sku: String(record.normalized.sku || ""),
            category: String(record.normalized.category || "flower"),
            wholesale_price: record.normalized.wholesale_price ? parseNumber(record.normalized.wholesale_price) : null,
            retail_price: record.normalized.retail_price ? parseNumber(record.normalized.retail_price) : null,
            cost_per_unit: record.normalized.cost_per_unit ? parseNumber(record.normalized.cost_per_unit) : null,
            available_quantity: record.normalized.available_quantity ? Math.floor(parseNumber(record.normalized.available_quantity)) : 0,
            description: record.normalized.description ? String(record.normalized.description) : null,
            vendor_name: record.normalized.vendor_name ? String(record.normalized.vendor_name) : null,
            strain_name: record.normalized.strain_name ? String(record.normalized.strain_name) : null,
            strain_type: record.normalized.strain_type ? String(record.normalized.strain_type) : null,
            thc_percent: record.normalized.thc_percent ? parseNumber(record.normalized.thc_percent) : null,
            cbd_percent: record.normalized.cbd_percent ? parseNumber(record.normalized.cbd_percent) : null,
            batch_number: record.normalized.batch_number ? String(record.normalized.batch_number) : null,
            total_quantity: record.normalized.available_quantity ? Math.floor(parseNumber(record.normalized.available_quantity)) : 0,
            price: record.normalized.wholesale_price ? parseNumber(record.normalized.wholesale_price) : 0,
            thca_percentage: 0,
          }))
        );

        if (error) {
          // Handle batch errors - mark all as failed
          batch.forEach((r) => {
            let reason = `Database Error: ${error.message}`;
            if (error.code === "23505") reason = "Duplicate SKU or Barcode";
            failures.push({ row: r.row, reason, data: r.normalized });
          });
        } else {
          importedCount += batch.length;
        }

        setProgress(Math.round(((i + batchSize) / recordsToImport.length) * 100));
      }

      skippedCount = validatedRecords.filter((r) => !r.selected).length;

      setImportResults({
        imported: importedCount,
        failed: failures.length,
        skipped: skippedCount,
        failures,
      });

      setStep("complete");

      if (importedCount > 0) {
        onSuccess?.();
      }
    } catch (error) {
      logger.error("Import failed:", error instanceof Error ? error : new Error(String(error)), {
        component: "ProductBulkImportDialog",
      });
      toast.error(error instanceof Error ? error.message : "Failed to import products");
      setLoading(false);
    }
  };

  // Download error report
  const downloadErrorReport = () => {
    if (!importResults?.failures.length) return;

    const csvContent = [
      ["Row", "Reason", "Data"].join(","),
      ...importResults.failures.map((f) => [
        f.row,
        `"${f.reason.replace(/"/g, '""')}"`,
        `"${JSON.stringify(f.data).replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setFile(null);
    setRawRecords([]);
    setFileHeaders([]);
    setMapping({});
    setStep("upload");
    setProgress(0);
    setLoading(false);
    setValidatedRecords([]);
    setImportResults(null);
    setPreviewFilter("all");
  };

  // Step indicator component
  const StepIndicator = () => {
    const steps = [
      { key: "upload", label: "Upload", icon: Upload },
      { key: "map", label: "Map", icon: FileSpreadsheet },
      { key: "preview", label: "Preview", icon: Eye },
      { key: "importing", label: "Import", icon: Loader2 },
    ];

    const currentIndex = steps.findIndex((s) => s.key === step);

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.key === step;
          const isComplete = i < currentIndex || step === "complete";

          return (
            <div key={s.key} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isComplete && "border-green-500 bg-green-500 text-white",
                  !isActive && !isComplete && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className={cn("h-4 w-4", isActive && s.key === "importing" && "animate-spin")} />
                )}
              </div>
              <span
                className={cn(
                  "ml-2 text-xs font-medium hidden sm:inline",
                  isActive && "text-primary",
                  isComplete && "text-green-600",
                  !isActive && !isComplete && "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-2",
                    isComplete ? "bg-green-500" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetState();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV or Excel file containing your product catalog."}
            {step === "map" && "Map your file columns to system fields."}
            {step === "preview" && "Review and select products to import."}
            {step === "importing" && "Importing products..."}
            {step === "complete" && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator />

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div
              className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer min-h-[300px]"
              onClick={() => document.getElementById("bulk-csv-upload")?.click()}
            >
              {loading ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload CSV or Excel</p>
                <p className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls</p>
              </div>
              <Input
                id="bulk-csv-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>
          )}

          {/* Step 2: Map */}
          {step === "map" && (
            <div className="space-y-4 overflow-auto max-h-[50vh]">
              {/* Import Settings */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Decimal Separator</Label>
                  <Select
                    value={decimalSeparator}
                    onValueChange={(v: "." | ",") => setDecimalSeparator(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=".">Dot (10.50)</SelectItem>
                      <SelectItem value=",">Comma (10,50)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 self-end pb-2">
                  <Checkbox
                    id="empty-null"
                    checked={treatEmptyAsNull}
                    onCheckedChange={(checked) => setTreatEmptyAsNull(checked === true)}
                  />
                  <Label htmlFor="empty-null" className="text-sm font-normal cursor-pointer">
                    Treat empty cells as NULL
                  </Label>
                </div>
                <div className="col-span-2 bg-blue-50 text-blue-800 text-xs p-3 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>Tip:</strong> Format <strong>SKU</strong> columns as &quot;Text&quot; in
                    Excel to prevent scientific notation (e.g., 1.23E+11).
                  </span>
                </div>
              </div>

              {/* Column Mapping */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 font-medium text-sm text-muted-foreground px-2">
                  <div>System Field</div>
                  <div>File Column</div>
                </div>
                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-2">
                    {SYSTEM_FIELDS.map((field) => (
                      <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <span className={field.required ? "font-semibold" : ""}>
                            {field.label}
                          </span>
                          {field.required && <span className="text-red-500">*</span>}
                        </div>
                        <Select
                          value={mapping[field.key] || "ignore"}
                          onValueChange={(val) =>
                            setMapping((prev) => ({
                              ...prev,
                              [field.key]: val === "ignore" ? "" : val,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore" className="text-muted-foreground">
                              -- Ignore --
                            </SelectItem>
                            {fileHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4 overflow-hidden flex flex-col h-full">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-xs text-muted-foreground">Total Records</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{summary.valid}</div>
                  <div className="text-xs text-green-600">Valid</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.withErrors}</div>
                  <div className="text-xs text-red-600">With Errors</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{summary.withWarnings}</div>
                  <div className="text-xs text-yellow-600">With Warnings</div>
                </div>
              </div>

              {/* Filter Tabs and Selection Controls */}
              <div className="flex items-center justify-between">
                <Tabs value={previewFilter} onValueChange={(v) => setPreviewFilter(v as typeof previewFilter)}>
                  <TabsList>
                    <TabsTrigger value="all">All ({summary.total})</TabsTrigger>
                    <TabsTrigger value="valid">Valid ({summary.valid})</TabsTrigger>
                    <TabsTrigger value="errors">Errors ({summary.withErrors})</TabsTrigger>
                    <TabsTrigger value="warnings">Warnings ({summary.withWarnings})</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleSelectAll(true)}>
                    Select All Valid
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleSelectAll(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>

              {/* Records Table */}
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Select</TableHead>
                      <TableHead className="w-[60px]">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow
                        key={record.row}
                        className={cn(
                          record.errors.length > 0 && "bg-red-50/50",
                          record.warnings.length > 0 && record.isValid && "bg-yellow-50/50"
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={record.selected}
                            disabled={!record.isValid}
                            onCheckedChange={() => {
                              const originalIndex = validatedRecords.findIndex((r) => r.row === record.row);
                              if (originalIndex !== -1) {
                                toggleRecordSelection(originalIndex);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{record.row}</TableCell>
                        <TableCell className="font-medium max-w-[150px] truncate">
                          {String(record.normalized.name || "-")}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[100px] truncate">
                          {String(record.normalized.sku || "-")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {String(record.normalized.category || "-")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.errors.length > 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" /> Error
                            </Badge>
                          ) : record.warnings.length > 0 ? (
                            <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
                              <AlertTriangle className="h-3 w-3" /> Warning
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3" /> Valid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.errors.length > 0 && (
                            <div className="text-red-600">
                              {record.errors.map((e, i) => (
                                <div key={i}>{e.message}</div>
                              ))}
                            </div>
                          )}
                          {record.warnings.length > 0 && (
                            <div className="text-yellow-600">
                              {record.warnings.map((w, i) => (
                                <div key={i}>{w.message}</div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Selection Summary */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">
                  {summary.selected} of {summary.valid} valid records selected for import
                </span>
                <Button variant="outline" size="sm" onClick={() => setStep("map")}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Re-map Columns
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-10 min-h-[300px]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Processing products...</p>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === "complete" && importResults && (
            <div className="flex flex-col items-center justify-center space-y-6 py-10 min-h-[300px]">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Import Complete!</h3>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{importResults.imported}</div>
                    <div className="text-xs text-green-600">Imported</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                    <div className="text-xs text-red-600">Failed</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{importResults.skipped}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Skipped</div>
                  </div>
                </div>
              </div>

              {importResults.failed > 0 && (
                <Button variant="outline" onClick={downloadErrorReport}>
                  <Download className="h-4 w-4 mr-2" /> Download Error Report
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {step === "map" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("map")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {step !== "importing" && step !== "complete" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "map" && (
            <Button onClick={runValidation} disabled={loading}>
              Validate & Preview <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === "preview" && (
            <Button onClick={handleImport} disabled={loading || summary.selected === 0}>
              Import {summary.selected} Products <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === "complete" && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
