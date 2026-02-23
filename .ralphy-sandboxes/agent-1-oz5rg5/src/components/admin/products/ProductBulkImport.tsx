import { useState, useMemo, useCallback } from "react";
import { read, utils } from "xlsx";
import { logger } from "@/lib/logger";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Upload from "lucide-react/dist/esm/icons/upload";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";
import Download from "lucide-react/dist/esm/icons/download";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { humanizeError } from "@/lib/humanizeError";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logActivity, ActivityAction, EntityType } from "@/lib/activityLog";

interface ProductBulkImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = "upload" | "map" | "preview" | "importing";

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "number" | "enum";
  enumValues?: string[];
  validator?: (value: unknown) => string | null;
}

interface ValidationResult {
  row: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data: Record<string, unknown>;
  normalized: Record<string, unknown>;
}

const PRODUCT_CATEGORIES = ["flower", "edibles", "vapes", "concentrates", "pre-rolls", "accessories", "topicals", "tinctures"];

const SYSTEM_FIELDS: SystemField[] = [
  { key: "name", label: "Product Name", required: true, type: "string" },
  { key: "sku", label: "SKU", required: true, type: "string" },
  {
    key: "category",
    label: "Category",
    required: true,
    type: "enum",
    enumValues: PRODUCT_CATEGORIES,
  },
  { key: "wholesale_price", label: "Wholesale Price", required: false, type: "number" },
  { key: "retail_price", label: "Retail Price", required: false, type: "number" },
  { key: "cost_per_unit", label: "Cost Per Unit", required: false, type: "number" },
  { key: "available_quantity", label: "Quantity", required: false, type: "number" },
  { key: "description", label: "Description", required: false, type: "string" },
  { key: "strain_name", label: "Strain Name", required: false, type: "string" },
  { key: "strain_type", label: "Strain Type", required: false, type: "string" },
  { key: "vendor_name", label: "Vendor Name", required: false, type: "string" },
  { key: "batch_number", label: "Batch Number", required: false, type: "string" },
  { key: "thc_percent", label: "THC %", required: false, type: "number" },
  { key: "cbd_percent", label: "CBD %", required: false, type: "number" },
  // Shipping dimensions
  { key: "weight_kg", label: "Shipping Weight (kg)", required: false, type: "number" },
  { key: "length_cm", label: "Length (cm)", required: false, type: "number" },
  { key: "width_cm", label: "Width (cm)", required: false, type: "number" },
  { key: "height_cm", label: "Height (cm)", required: false, type: "number" },
];

export function ProductBulkImport({ open, onOpenChange, onSuccess }: ProductBulkImportProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const [step, setStep] = useState<ImportStep>("upload");
  const [_file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Import Options
  const [decimalSeparator, setDecimalSeparator] = useState<"." | ",">(".");
  const [treatEmptyAsNull, setTreatEmptyAsNull] = useState(true);

  // Validation results
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [previewTab, setPreviewTab] = useState<"all" | "valid" | "invalid">("all");

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

      // Auto-map fields
      const initialMapping: Record<string, string> = {};
      SYSTEM_FIELDS.forEach((field) => {
        const match = headers.find(
          (h) =>
            h.toLowerCase().replace(/[^a-z0-9]/g, "") ===
              field.key.toLowerCase().replace(/[^a-z0-9]/g, "") ||
            h.toLowerCase().includes(field.label.toLowerCase()) ||
            field.label.toLowerCase().includes(h.toLowerCase())
        );
        if (match) initialMapping[field.key] = match;
      });
      setMapping(initialMapping);
      setStep("map");
    } catch (error) {
      logger.error("Error parsing file", error);
      toast.error("Failed to parse file. Please check format.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const parseNumber = useCallback(
    (value: unknown): number | null => {
      if (typeof value === "number") return value;
      if (!value) return null;
      let str = String(value).trim();
      if (decimalSeparator === ",") {
        str = str.replace(/\./g, "").replace(",", ".");
      } else {
        str = str.replace(/,/g, "");
      }
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    },
    [decimalSeparator]
  );

  const sanitizeSKU = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const strVal = String(value);
    if (/^\d+(\.\d+)?[eE]\+\d+$/.test(strVal)) {
      if (typeof value === "number") {
        return value.toLocaleString("fullwide", { useGrouping: false });
      }
    }
    return String(value).trim();
  };

  const validateRecord = useCallback(
    (record: Record<string, unknown>, rowIndex: number): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];
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

      // Check required fields
      SYSTEM_FIELDS.filter((f) => f.required).forEach((field) => {
        const val = normalized[field.key];
        if (val === null || val === undefined || val === "") {
          errors.push(`Missing required field: ${field.label}`);
        }
      });

      // Validate category
      if (normalized.category) {
        const categoryLower = String(normalized.category).toLowerCase();
        if (!PRODUCT_CATEGORIES.includes(categoryLower)) {
          errors.push(
            `Invalid category "${normalized.category}". Must be one of: ${PRODUCT_CATEGORIES.join(", ")}`
          );
        } else {
          normalized.category = categoryLower;
        }
      }

      // Validate numeric fields
      const numericFields = ["wholesale_price", "retail_price", "cost_per_unit", "available_quantity", "thc_percent", "cbd_percent", "weight_kg", "length_cm", "width_cm", "height_cm"];
      numericFields.forEach((fieldKey) => {
        if (normalized[fieldKey] !== null && normalized[fieldKey] !== undefined && normalized[fieldKey] !== "") {
          const num = parseNumber(normalized[fieldKey]);
          if (num === null) {
            errors.push(`Invalid number for ${fieldKey}: "${normalized[fieldKey]}"`);
          } else {
            if (num < 0) {
              errors.push(`${fieldKey} cannot be negative`);
            }
            if ((fieldKey === "thc_percent" || fieldKey === "cbd_percent") && num > 100) {
              errors.push(`${fieldKey} cannot exceed 100%`);
            }
            normalized[fieldKey] = num;
          }
        }
      });

      // Warnings for potential issues
      if (normalized.wholesale_price && normalized.cost_per_unit) {
        const wholesale = parseNumber(normalized.wholesale_price);
        const cost = parseNumber(normalized.cost_per_unit);
        if (wholesale !== null && cost !== null && wholesale < cost) {
          warnings.push("Wholesale price is less than cost per unit");
        }
      }

      if (normalized.name && String(normalized.name).length < 3) {
        warnings.push("Product name is very short");
      }

      return {
        row: rowIndex + 2, // +2 for header row and 1-based index
        isValid: errors.length === 0,
        errors,
        warnings,
        data: record,
        normalized,
      };
    },
    [mapping, treatEmptyAsNull, parseNumber]
  );

  const runValidation = useCallback(() => {
    const results = rawRecords.map((record, index) => validateRecord(record, index));
    setValidationResults(results);
    return results;
  }, [rawRecords, validateRecord]);

  const handlePreview = () => {
    // Verify required fields are mapped
    const missingRequired = SYSTEM_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    const results = runValidation();
    const validCount = results.filter((r) => r.isValid).length;

    if (validCount === 0) {
      toast.error("No valid records found. Please check your data and field mappings.");
      return;
    }

    setStep("preview");
  };

  const validRecords = useMemo(
    () => validationResults.filter((r) => r.isValid),
    [validationResults]
  );

  const invalidRecords = useMemo(
    () => validationResults.filter((r) => !r.isValid),
    [validationResults]
  );

  const displayedRecords = useMemo(() => {
    switch (previewTab) {
      case "valid":
        return validRecords;
      case "invalid":
        return invalidRecords;
      default:
        return validationResults;
    }
  }, [previewTab, validRecords, invalidRecords, validationResults]);

  const handleImport = async () => {
    if (!tenant?.id) return;

    const recordsToImport = validRecords;
    if (recordsToImport.length === 0) {
      toast.error("No valid records to import");
      return;
    }

    setStep("importing");
    setLoading(true);
    setProgress(0);

    try {
      const batchSize = 10;
      let insertedCount = 0;
      let inventoryEntriesCreated = 0;
      const importErrors: { row: number; reason: string }[] = [];
      const importedProductIds: string[] = [];

      for (let i = 0; i < recordsToImport.length; i += batchSize) {
        const batch = recordsToImport.slice(i, i + batchSize);

        // Insert products and get the inserted IDs
        const { data: insertedProducts, error } = await supabase
          .from("products")
          .insert(
            batch.map((record) => ({
              tenant_id: tenant.id,
              name: record.normalized.name as string,
              sku: record.normalized.sku as string,
              category: record.normalized.category as string,
              wholesale_price: (record.normalized.wholesale_price as number) ?? 0,
              retail_price: (record.normalized.retail_price as number) ?? 0,
              cost_per_unit: (record.normalized.cost_per_unit as number) ?? 0,
              available_quantity: Math.floor((record.normalized.available_quantity as number) ?? 0),
              total_quantity: Math.floor((record.normalized.available_quantity as number) ?? 0),
              description: (record.normalized.description as string) || null,
              strain_name: (record.normalized.strain_name as string) || null,
              strain_type: (record.normalized.strain_type as string) || null,
              vendor_name: (record.normalized.vendor_name as string) || null,
              batch_number: (record.normalized.batch_number as string) || null,
              thc_percent: (record.normalized.thc_percent as number) ?? 0,
              cbd_percent: (record.normalized.cbd_percent as number) ?? 0,
              thca_percentage: 0,
              price: (record.normalized.wholesale_price as number) ?? 0, // Legacy field sync
              // Shipping dimensions
              weight_kg: (record.normalized.weight_kg as number) || null,
              length_cm: (record.normalized.length_cm as number) || null,
              width_cm: (record.normalized.width_cm as number) || null,
              height_cm: (record.normalized.height_cm as number) || null,
            }))
          )
          .select("id, available_quantity");

        if (error) {
          logger.error("Batch insert failed", error);
          batch.forEach((r) => {
            let reason = `Database Error: ${error.message}`;
            if (error.code === "23505") reason = "Duplicate SKU or constraint violation";
            importErrors.push({ row: r.row, reason });
          });
        } else if (insertedProducts && insertedProducts.length > 0) {
          insertedCount += insertedProducts.length;
          importedProductIds.push(...insertedProducts.map((p) => p.id));

          // Create initial inventory_history entries for products with stock
          const inventoryEntries = insertedProducts
            .filter((p) => p.available_quantity > 0)
            .map((product) => ({
              tenant_id: tenant.id,
              product_id: product.id,
              change_type: "stock_in" as const,
              previous_quantity: 0,
              new_quantity: product.available_quantity,
              change_amount: product.available_quantity,
              reason: "Initial stock from CSV import",
              notes: "Bulk import",
              performed_by: admin?.userId || null,
              metadata: { source: "csv_import" },
            }));

          if (inventoryEntries.length > 0) {
            const { error: inventoryError } = await (supabase as any)
              .from("inventory_history")
              .insert(inventoryEntries);

            if (inventoryError) {
              logger.warn("Failed to create inventory history entries", inventoryError, {
                component: "ProductBulkImport",
              });
            } else {
              inventoryEntriesCreated += inventoryEntries.length;
            }
          }
        }

        setProgress(Math.round(((i + batchSize) / recordsToImport.length) * 100));
      }

      // Log the import action to activity_log
      if (insertedCount > 0 && admin?.userId) {
        await logActivity(
          tenant.id,
          admin.userId,
          ActivityAction.CREATED,
          EntityType.PRODUCT,
          null,
          {
            action: "bulk_import",
            productsImported: insertedCount,
            inventoryEntriesCreated,
            totalRecords: recordsToImport.length,
            errorsCount: importErrors.length,
            productIds: importedProductIds.slice(0, 10), // Log first 10 IDs
          }
        );
      }

      if (importErrors.length > 0) {
        const message = `Import complete: ${insertedCount} products imported, ${inventoryEntriesCreated} inventory entries created. ${importErrors.length} errors.`;
        toast.warning(message, {
          duration: 6000,
          action: {
            label: "Download Report",
            onClick: () => downloadErrorReport(importErrors),
          },
        });
      } else {
        toast.success(
          `Successfully imported ${insertedCount} products with ${inventoryEntriesCreated} inventory entries`
        );
      }

      if (insertedCount > 0) {
        onSuccess?.();
        onOpenChange(false);
        resetState();
      } else {
        setLoading(false);
        setStep("preview");
      }
    } catch (error) {
      logger.error(
        "Import failed:",
        error instanceof Error ? error : new Error(String(error)),
        { component: "ProductBulkImport" }
      );
      toast.error(humanizeError(error, "Failed to import products"));
      setLoading(false);
    }
  };

  const downloadErrorReport = (errors: { row: number; reason: string }[]) => {
    const blob = new Blob([JSON.stringify(errors, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-import-errors-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadValidationReport = () => {
    const report = {
      summary: {
        total: validationResults.length,
        valid: validRecords.length,
        invalid: invalidRecords.length,
      },
      invalidRecords: invalidRecords.map((r) => ({
        row: r.row,
        errors: r.errors,
        warnings: r.warnings,
        data: r.data,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `validation-report-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadTemplate = () => {
    const headers = SYSTEM_FIELDS.map((f) => f.label);
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetState = () => {
    setFile(null);
    setRawRecords([]);
    setFileHeaders([]);
    setMapping({});
    setStep("upload");
    setProgress(0);
    setLoading(false);
    setValidationResults([]);
    setPreviewTab("all");
  };

  // Get the mapped field labels for display
  const mappedFieldLabels = useMemo(() => {
    const labels: string[] = [];
    SYSTEM_FIELDS.forEach((field) => {
      if (mapping[field.key]) {
        labels.push(field.label);
      }
    });
    return labels.slice(0, 5); // Show max 5 columns
  }, [mapping]);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetState();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV or Excel file containing your product catalog."}
            {step === "map" && "Map columns from your file to system fields."}
            {step === "preview" && "Review validation results before importing."}
            {step === "importing" && "Importing products..."}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {["upload", "map", "preview", "importing"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["upload", "map", "preview", "importing"].indexOf(step) > i
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {["upload", "map", "preview", "importing"].indexOf(step) > i ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={`w-8 h-0.5 ${
                    ["upload", "map", "preview", "importing"].indexOf(step) > i
                      ? "bg-green-500"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div className="space-y-4 py-4">
              <div
                className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("product-csv-upload")?.click()}
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
                  id="product-csv-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </div>

              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <strong>Tips:</strong>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>
                      Format <strong>SKU</strong> and <strong>Barcode</strong> columns as "Text" in
                      Excel to prevent scientific notation
                    </li>
                    <li>
                      Valid categories: {PRODUCT_CATEGORIES.join(", ")}
                    </li>
                    <li>Numeric fields (prices, quantities) should not contain currency symbols</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === "map" && (
            <div className="space-y-4 py-4">
              {/* Import Settings */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Decimal Separator</Label>
                  <Select
                    value={decimalSeparator}
                    onValueChange={(v) => setDecimalSeparator(v as "." | ",")}
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
                <div className="space-y-2 flex items-center pt-8">
                  <input
                    type="checkbox"
                    id="empty-null"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mr-2"
                    checked={treatEmptyAsNull}
                    onChange={(e) => setTreatEmptyAsNull(e.target.checked)}
                  />
                  <Label htmlFor="empty-null" className="text-sm font-normal cursor-pointer">
                    Treat empty cells as NULL
                  </Label>
                </div>
              </div>

              {/* Mapping */}
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 font-medium text-sm text-muted-foreground mb-2 px-2 sticky top-0 bg-background pb-2">
                    <div>System Field</div>
                    <div>File Column</div>
                  </div>
                  {SYSTEM_FIELDS.map((field) => (
                    <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <span className={field.required ? "font-semibold" : ""}>{field.label}</span>
                        {field.required && <span className="text-red-500">*</span>}
                        {field.type === "enum" && field.enumValues && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertCircle className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Valid values: {field.enumValues.join(", ")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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

              <div className="text-xs text-muted-foreground">
                {rawRecords.length} records found in file.
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4 py-2 flex flex-col h-full">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold">{validationResults.length}</div>
                  <div className="text-xs text-muted-foreground">Total Records</div>
                </div>
                <div className="p-4 rounded-lg bg-green-50 text-center border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{validRecords.length}</div>
                  <div className="text-xs text-green-600">Valid Records</div>
                </div>
                <div className="p-4 rounded-lg bg-red-50 text-center border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{invalidRecords.length}</div>
                  <div className="text-xs text-red-600">Invalid Records</div>
                </div>
              </div>

              {/* Filter Tabs */}
              <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as typeof previewTab)}>
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="all">All ({validationResults.length})</TabsTrigger>
                    <TabsTrigger value="valid" className="text-green-600">
                      Valid ({validRecords.length})
                    </TabsTrigger>
                    <TabsTrigger value="invalid" className="text-red-600">
                      Invalid ({invalidRecords.length})
                    </TabsTrigger>
                  </TabsList>
                  {invalidRecords.length > 0 && (
                    <Button variant="outline" size="sm" onClick={downloadValidationReport}>
                      <Download className="mr-2 h-4 w-4" />
                      Export Errors
                    </Button>
                  )}
                </div>

                <TabsContent value="all" className="mt-2">
                  <PreviewTable records={displayedRecords} mappedFields={mappedFieldLabels} />
                </TabsContent>
                <TabsContent value="valid" className="mt-2">
                  <PreviewTable records={displayedRecords} mappedFields={mappedFieldLabels} />
                </TabsContent>
                <TabsContent value="invalid" className="mt-2">
                  <PreviewTable records={displayedRecords} mappedFields={mappedFieldLabels} />
                </TabsContent>
              </Tabs>

              {invalidRecords.length > 0 && (
                <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-md flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {invalidRecords.length} record(s) have validation errors and will be skipped
                    during import. You can download the error report to fix these records and
                    re-import them later.
                  </span>
                </div>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center space-y-4 h-full py-10">
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
              <p className="text-sm text-muted-foreground">
                Importing {validRecords.length} products...
              </p>
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
          {step !== "importing" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "map" && (
            <Button onClick={handlePreview} disabled={loading}>
              Preview <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === "preview" && (
            <Button onClick={handleImport} disabled={loading || validRecords.length === 0}>
              Import {validRecords.length} Products <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PreviewTableProps {
  records: ValidationResult[];
  mappedFields: string[];
}

function PreviewTable({ records, mappedFields: _mappedFields }: PreviewTableProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileSpreadsheet className="h-12 w-12 mb-2 opacity-50" />
        <p>No records to display</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[280px] border rounded-lg">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-[60px]">Row</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="w-[250px]">Issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow
              key={record.row}
              className={record.isValid ? "" : "bg-red-50/50 dark:bg-red-950/20"}
            >
              <TableCell className="font-mono text-xs">{record.row}</TableCell>
              <TableCell>
                {record.isValid ? (
                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </TableCell>
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
                {record.errors.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-red-600 text-xs cursor-help">
                          <XCircle className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">
                            {record.errors[0]}
                            {record.errors.length > 1 && ` (+${record.errors.length - 1} more)`}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[300px]">
                        <ul className="list-disc ml-4 space-y-1">
                          {record.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {record.warnings.length > 0 && record.errors.length === 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-yellow-600 text-xs cursor-help">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">
                            {record.warnings[0]}
                            {record.warnings.length > 1 &&
                              ` (+${record.warnings.length - 1} more)`}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[300px]">
                        <ul className="list-disc ml-4 space-y-1">
                          {record.warnings.map((warn, i) => (
                            <li key={i}>{warn}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {record.errors.length === 0 && record.warnings.length === 0 && (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
