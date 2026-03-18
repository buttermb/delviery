/**
 * BulkCSVUploader Component
 *
 * Multi-step wizard for bulk importing products from CSV/Excel files.
 * Steps: Upload → Map Columns → Preview & Validate → Import → Complete.
 * Duplicate detection by SKU. Validation preview with error reporting.
 * Batch processing with progress tracking.
 */

import { useState, useMemo, useCallback } from 'react';
import { read, utils } from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  SkipForward,
  RefreshCw,
  Package,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface BulkCSVUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'map' | 'preview' | 'importing' | 'complete';

type DuplicateStrategy = 'skip' | 'update';

interface ParsedProduct {
  rowIndex: number;
  name: string;
  sku: string;
  category: string;
  vendor_name: string | null;
  strain_name: string | null;
  strain_type: string | null;
  thc_percent: number;
  cbd_percent: number;
  wholesale_price: number;
  retail_price: number;
  available_quantity: number;
  description: string | null;
  batch_number: string | null;
  isValid: boolean;
  validationErrors: string[];
}

interface ExistingProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
}

interface DuplicateMatch {
  parsed: ParsedProduct;
  existing: ExistingProduct;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; reason: string; data: Record<string, unknown> }>;
}

// ============================================================================
// Constants
// ============================================================================

const SYSTEM_FIELDS = [
  { key: 'name', label: 'Product Name', required: true },
  { key: 'sku', label: 'SKU', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'vendor_name', label: 'Vendor', required: false },
  { key: 'strain_name', label: 'Strain Name', required: false },
  { key: 'strain_type', label: 'Strain Type', required: false },
  { key: 'thc_percent', label: 'THC %', required: false },
  { key: 'cbd_percent', label: 'CBD %', required: false },
  { key: 'wholesale_price', label: 'Wholesale Price', required: false },
  { key: 'retail_price', label: 'Retail Price', required: false },
  { key: 'available_quantity', label: 'Quantity', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'batch_number', label: 'Batch Number', required: false },
] as const;

const VALID_CATEGORIES = [
  'flower', 'concentrates', 'edibles', 'topicals',
  'tinctures', 'pre-rolls', 'vapes', 'accessories',
  'seeds', 'clones',
];

const BATCH_SIZE = 10;

// ============================================================================
// Helper Functions
// ============================================================================

function sanitizeString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).trim().replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function sanitizeSKU(value: unknown): string {
  if (value === null || value === undefined) return '';
  const strVal = String(value);
  // Handle scientific notation from Excel
  if (/^\d+(\.\d+)?[eE]\+\d+$/.test(strVal) && typeof value === 'number') {
    return value.toLocaleString('fullwide', { useGrouping: false });
  }
  return strVal.trim();
}

function normalizeCategory(value: unknown): string | null {
  if (!value) return null;
  const lower = String(value).trim().toLowerCase();
  // Direct match
  if (VALID_CATEGORIES.includes(lower)) return lower;
  // Common aliases
  const aliases: Record<string, string> = {
    'pre-roll': 'pre-rolls',
    'preroll': 'pre-rolls',
    'prerolls': 'pre-rolls',
    'vape': 'vapes',
    'cartridge': 'vapes',
    'cartridges': 'vapes',
    'edible': 'edibles',
    'gummy': 'edibles',
    'gummies': 'edibles',
    'concentrate': 'concentrates',
    'wax': 'concentrates',
    'shatter': 'concentrates',
    'topical': 'topicals',
    'cream': 'topicals',
    'tincture': 'tinctures',
    'oil': 'tinctures',
    'seed': 'seeds',
    'clone': 'clones',
    'accessory': 'accessories',
  };
  return aliases[lower] ?? null;
}

// ============================================================================
// Main Component
// ============================================================================

export function BulkCSVUploader({ open, onOpenChange, onSuccess }: BulkCSVUploaderProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ============================================================================
  // File Handling
  // ============================================================================

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const isValid = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!isValid) {
      toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = read(buffer, { type: 'array', codepage: 65001 });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        throw new Error('No records found in file');
      }

      const headers = Object.keys(jsonData[0]);
      setFileHeaders(headers);
      setRawRecords(jsonData);

      // Auto-map fields by name matching
      const initialMapping: Record<string, string> = {};
      SYSTEM_FIELDS.forEach((field) => {
        const match = headers.find(
          (h) =>
            h.toLowerCase().replace(/[^a-z0-9]/g, '') ===
              field.key.toLowerCase().replace(/[^a-z0-9]/g, '') ||
            h.toLowerCase().includes(field.label.toLowerCase()) ||
            (field.key === 'thc_percent' && /thc/i.test(h)) ||
            (field.key === 'cbd_percent' && /cbd/i.test(h)) ||
            (field.key === 'available_quantity' && /qty|quantity/i.test(h)) ||
            (field.key === 'wholesale_price' && /wholesale/i.test(h)) ||
            (field.key === 'retail_price' && /retail/i.test(h))
        );
        if (match) initialMapping[field.key] = match;
      });
      setMapping(initialMapping);
      setStep('map');
    } catch (error) {
      logger.error('Error parsing file', error, { component: 'BulkCSVUploader' });
      toast.error('Failed to parse file. Please check the format.', {
        description: humanizeError(error),
      });
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Validation
  // ============================================================================

  const validateAndParse = useCallback(() => {
    const parsed: ParsedProduct[] = rawRecords.map((record, index) => {
      const errors: string[] = [];

      const name = sanitizeString(record[mapping.name]);
      const rawSku = record[mapping.sku];
      const sku = sanitizeSKU(rawSku);
      const rawCategory = sanitizeString(record[mapping.category]);
      const category = normalizeCategory(rawCategory);
      const vendor_name = mapping.vendor_name ? sanitizeString(record[mapping.vendor_name]) : null;
      const strain_name = mapping.strain_name ? sanitizeString(record[mapping.strain_name]) : null;
      const strain_type = mapping.strain_type ? sanitizeString(record[mapping.strain_type]) : null;
      const thc_percent = mapping.thc_percent ? parseNumber(record[mapping.thc_percent]) : 0;
      const cbd_percent = mapping.cbd_percent ? parseNumber(record[mapping.cbd_percent]) : 0;
      const wholesale_price = mapping.wholesale_price ? parseNumber(record[mapping.wholesale_price]) : 0;
      const retail_price = mapping.retail_price ? parseNumber(record[mapping.retail_price]) : 0;
      const available_quantity = mapping.available_quantity ? parseNumber(record[mapping.available_quantity]) : 0;
      const description = mapping.description ? sanitizeString(record[mapping.description]) : null;
      const batch_number = mapping.batch_number ? sanitizeString(record[mapping.batch_number]) : null;

      // Validation
      if (!name) errors.push('Product name is required');
      if (!sku) errors.push('SKU is required');
      if (!rawCategory) {
        errors.push('Category is required');
      } else if (!category) {
        errors.push(`Invalid category: "${rawCategory}". Must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }

      return {
        rowIndex: index + 2, // +2 for header row and 1-based index
        name: name ?? '',
        sku,
        category: category ?? '',
        vendor_name,
        strain_name,
        strain_type,
        thc_percent,
        cbd_percent,
        wholesale_price,
        retail_price,
        available_quantity,
        description,
        batch_number,
        isValid: errors.length === 0,
        validationErrors: errors,
      };
    });

    setParsedProducts(parsed);
    return parsed;
  }, [rawRecords, mapping]);

  // ============================================================================
  // Duplicate Detection
  // ============================================================================

  const validSkus = useMemo(() => {
    return parsedProducts
      .filter((p) => p.isValid && p.sku)
      .map((p) => p.sku);
  }, [parsedProducts]);

  const { data: existingProducts, isLoading: loadingExisting } = useQuery({
    queryKey: [...queryKeys.products.all, 'import-duplicates', tenantId, validSkus],
    queryFn: async () => {
      if (!tenantId || validSkus.length === 0) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, category')
        .eq('tenant_id', tenantId)
        .in('sku', validSkus);

      if (error) {
        logger.error('Failed to fetch existing products for duplicate check', error, {
          component: 'BulkCSVUploader',
          tenantId,
        });
        throw error;
      }

      return data as ExistingProduct[];
    },
    enabled: !!tenantId && validSkus.length > 0 && step === 'preview',
    staleTime: 0,
  });

  // Compute duplicates
  const computedDuplicates = useMemo(() => {
    if (!existingProducts || existingProducts.length === 0) return [];

    const skuMap = new Map<string, ExistingProduct>();
    existingProducts.forEach((product) => {
      if (product.sku) skuMap.set(product.sku, product);
    });

    const matches: DuplicateMatch[] = [];
    parsedProducts.forEach((parsed) => {
      if (!parsed.isValid) return;
      const existing = skuMap.get(parsed.sku);
      if (existing) {
        matches.push({ parsed, existing });
      }
    });

    return matches;
  }, [existingProducts, parsedProducts]);

  // Update duplicates state when computed
  useMemo(() => {
    setDuplicates(computedDuplicates);
  }, [computedDuplicates]);

  // ============================================================================
  // Import Logic
  // ============================================================================

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant context');

      const result: ImportResult = {
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      };

      const validProducts = parsedProducts.filter((p) => p.isValid);
      const duplicateSkus = new Set(duplicates.map((d) => d.parsed.sku));
      const duplicateMap = new Map(duplicates.map((d) => [d.parsed.sku, d.existing]));
      const total = validProducts.length;
      let processed = 0;

      // Separate into new and duplicate records
      const newProducts: ParsedProduct[] = [];
      const duplicateProducts: ParsedProduct[] = [];

      for (const product of validProducts) {
        if (duplicateSkus.has(product.sku)) {
          duplicateProducts.push(product);
        } else {
          newProducts.push(product);
        }
      }

      // Handle duplicates based on strategy
      for (const product of duplicateProducts) {
        try {
          if (duplicateStrategy === 'skip') {
            result.skipped++;
          } else {
            // Update existing product
            const existing = duplicateMap.get(product.sku);
            if (!existing) {
              result.skipped++;
              processed++;
              setProgress(Math.round((processed / total) * 100));
              continue;
            }

            const { error: updateError } = await supabase
              .from('products')
              .update({
                name: product.name,
                category: product.category,
                vendor_name: product.vendor_name,
                strain_name: product.strain_name,
                strain_type: product.strain_type,
                thc_percent: product.thc_percent,
                cbd_percent: product.cbd_percent,
                wholesale_price: product.wholesale_price,
                retail_price: product.retail_price,
                price: product.wholesale_price,
                available_quantity: product.available_quantity,
                description: product.description,
                batch_number: product.batch_number,
              })
              .eq('id', existing.id)
              .eq('tenant_id', tenantId);

            if (updateError) {
              logger.error('Failed to update product', updateError, {
                component: 'BulkCSVUploader',
                productId: existing.id,
              });
              result.errors.push({
                row: product.rowIndex,
                reason: `Update failed: ${updateError.message}`,
                data: product as unknown as Record<string, unknown>,
              });
              result.failed++;
            } else {
              result.updated++;
            }
          }
        } catch (error) {
          logger.error('Unexpected error processing duplicate product', error, {
            component: 'BulkCSVUploader',
            row: product.rowIndex,
          });
          result.errors.push({
            row: product.rowIndex,
            reason: error instanceof Error ? error.message : 'Unknown error',
            data: product as unknown as Record<string, unknown>,
          });
          result.failed++;
        }

        processed++;
        setProgress(Math.round((processed / total) * 100));
      }

      // Batch insert new products
      for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
        const batch = newProducts.slice(i, i + BATCH_SIZE);

        const insertData = batch.map((product) => ({
          tenant_id: tenantId,
          name: product.name,
          sku: product.sku,
          category: product.category,
          vendor_name: product.vendor_name,
          strain_name: product.strain_name,
          strain_type: product.strain_type,
          thc_percent: product.thc_percent,
          cbd_percent: product.cbd_percent,
          wholesale_price: product.wholesale_price,
          retail_price: product.retail_price,
          price: product.wholesale_price,
          available_quantity: product.available_quantity,
          total_quantity: product.available_quantity,
          description: product.description,
          batch_number: product.batch_number,
          thca_percentage: 0,
        }));

        const { error: insertError } = await supabase.from('products').insert(insertData);

        if (insertError) {
          // If batch fails, try individual inserts to identify specific failures
          if (insertError.code === '23505') {
            for (const product of batch) {
              const { error: singleError } = await supabase.from('products').insert({
                ...insertData.find((d) => d.sku === product.sku),
              });

              if (singleError) {
                const reason = singleError.code === '23505'
                  ? 'Duplicate SKU or barcode'
                  : `Database error: ${singleError.message}`;
                result.errors.push({
                  row: product.rowIndex,
                  reason,
                  data: product as unknown as Record<string, unknown>,
                });
                result.failed++;
              } else {
                result.imported++;
              }
              processed++;
              setProgress(Math.round((processed / total) * 100));
            }
          } else {
            batch.forEach((product) => {
              result.errors.push({
                row: product.rowIndex,
                reason: `Database error: ${insertError.message}`,
                data: product as unknown as Record<string, unknown>,
              });
              result.failed++;
            });
            processed += batch.length;
            setProgress(Math.round((processed / total) * 100));
          }
        } else {
          result.imported += batch.length;
          processed += batch.length;
          setProgress(Math.round((processed / total) * 100));
        }
      }

      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('complete');

      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      const successCount = result.imported + result.updated;
      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} products`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} records failed to import`);
      }
    },
    onError: (error) => {
      logger.error('Product import failed', error, { component: 'BulkCSVUploader' });
      toast.error('Import failed. Please try again.', { description: humanizeError(error) });
      setLoading(false);
    },
  });

  // ============================================================================
  // Navigation Handlers
  // ============================================================================

  const handleProceedToPreview = useCallback(() => {
    const missingRequired = SYSTEM_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }

    const parsed = validateAndParse();
    const validCount = parsed.filter((p) => p.isValid).length;

    if (validCount === 0) {
      toast.error('No valid records found. Please check your data.');
      return;
    }

    setStep('preview');
  }, [mapping, validateAndParse]);

  const handleStartImport = useCallback(() => {
    setStep('importing');
    setProgress(0);
    importMutation.mutate();
  }, [importMutation]);

  const handleClose = useCallback(() => {
    setStep('upload');
    setFile(null);
    setFileHeaders([]);
    setRawRecords([]);
    setMapping({});
    setParsedProducts([]);
    setDuplicates([]);
    setDuplicateStrategy('skip');
    setProgress(0);
    setImportResult(null);
    setLoading(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleComplete = useCallback(() => {
    handleClose();
    onSuccess?.();
  }, [handleClose, onSuccess]);

  const downloadErrorReport = useCallback(() => {
    if (!importResult || importResult.errors.length === 0) return;

    const blob = new Blob([JSON.stringify(importResult.errors, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-import-errors-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [importResult]);

  const downloadTemplate = useCallback(() => {
    const headers = SYSTEM_FIELDS.map((f) => f.label);
    const sampleRow = [
      'Blue Dream Flower', 'SKU-001', 'flower', 'Green Farms',
      'Blue Dream', 'hybrid', '22.5', '0.5', '25.00', '45.00',
      '100', 'Premium indoor flower', 'BN-2024-001',
    ];
    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // ============================================================================
  // Statistics
  // ============================================================================

  const stats = useMemo(() => {
    const valid = parsedProducts.filter((p) => p.isValid).length;
    const invalid = parsedProducts.filter((p) => !p.isValid).length;
    const duplicateCount = duplicates.length;
    const newCount = valid - duplicateCount;

    return { valid, invalid, duplicateCount, newCount };
  }, [parsedProducts, duplicates]);

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-4',
          'hover:bg-muted/50 transition-colors cursor-pointer min-h-[250px]'
        )}
        onClick={() => document.getElementById('csv-upload-products')?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            document.getElementById('csv-upload-products')?.click();
          }
        }}
      >
        {loading ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : (
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium">Click to upload CSV or Excel file</p>
          <p className="text-xs text-muted-foreground mt-1">Supported formats: .csv, .xlsx, .xls</p>
        </div>
        <Input
          id="csv-upload-products"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
          aria-label="Upload CSV or Excel file for product import"
        />
      </div>

      <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Download CSV Template
      </Button>
    </div>
  );

  const renderMapStep = () => (
    <div className="space-y-6">
      {/* File info */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">{file?.name}</p>
          <p className="text-xs text-muted-foreground">{rawRecords.length} records found</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
          Change
        </Button>
      </div>

      {/* Field mapping */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 font-medium text-sm text-muted-foreground mb-2 px-2">
          <div>System Field</div>
          <div>CSV Column</div>
        </div>
        {SYSTEM_FIELDS.map((field) => (
          <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className={field.required ? 'font-semibold' : ''}>{field.label}</span>
              {field.required && <span className="text-destructive">*</span>}
            </div>
            <Select
              value={mapping[field.key] || '_ignore'}
              onValueChange={(val) =>
                setMapping((prev) => ({
                  ...prev,
                  [field.key]: val === '_ignore' ? '' : val,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_ignore" className="text-muted-foreground">
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

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs p-3 rounded-md flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>Tip:</strong> Format <strong>SKU</strong> columns as &quot;Text&quot; in Excel to
          prevent scientific notation. Valid categories:{' '}
          {VALID_CATEGORIES.join(', ')}.
        </span>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      {/* Statistics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
          <p className="text-2xl font-bold">{stats.valid}</p>
          <p className="text-xs text-muted-foreground">Valid Records</p>
        </Card>
        <Card className="p-4 text-center">
          <XCircle className="h-6 w-6 mx-auto mb-2 text-rose-500" />
          <p className="text-2xl font-bold">{stats.invalid}</p>
          <p className="text-xs text-muted-foreground">Invalid Records</p>
        </Card>
        <Card className="p-4 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-500" />
          <p className="text-2xl font-bold">{loadingExisting ? '...' : stats.duplicateCount}</p>
          <p className="text-xs text-muted-foreground">Duplicate SKUs</p>
        </Card>
        <Card className="p-4 text-center">
          <Package className="h-6 w-6 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">{loadingExisting ? '...' : stats.newCount}</p>
          <p className="text-xs text-muted-foreground">New Products</p>
        </Card>
      </div>

      {/* Duplicate handling strategy */}
      {stats.duplicateCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Duplicate Handling
            </CardTitle>
            <CardDescription>
              {stats.duplicateCount} product(s) match existing SKUs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={duplicateStrategy}
              onValueChange={(v) => setDuplicateStrategy(v as DuplicateStrategy)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <Label
                htmlFor="skip-products"
                className={cn(
                  'flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors',
                  duplicateStrategy === 'skip' && 'border-primary bg-primary/5'
                )}
              >
                <RadioGroupItem value="skip" id="skip-products" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4" />
                    <span className="font-medium">Skip</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Keep existing products unchanged
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="update-products"
                className={cn(
                  'flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors',
                  duplicateStrategy === 'update' && 'border-primary bg-primary/5'
                )}
              >
                <RadioGroupItem value="update" id="update-products" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    <span className="font-medium">Update</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Overwrite existing with CSV data
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Duplicates preview table */}
      {duplicates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Matched Existing Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Row</TableHead>
                    <TableHead>CSV Product</TableHead>
                    <TableHead>Existing Product</TableHead>
                    <TableHead className="w-[100px]">SKU</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.slice(0, 10).map((dup) => (
                    <TableRow key={`dup-${dup.parsed.rowIndex}`}>
                      <TableCell className="font-mono text-xs">{dup.parsed.rowIndex}</TableCell>
                      <TableCell>
                        <div className="text-sm">{dup.parsed.name}</div>
                        <div className="text-xs text-muted-foreground">{dup.parsed.category}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{dup.existing.name}</div>
                        <div className="text-xs text-muted-foreground">{dup.existing.category}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {dup.parsed.sku}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            {duplicates.length > 10 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                ... and {duplicates.length - 10} more matches
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invalid records preview */}
      {stats.invalid > 0 && (
        <Card className="border-rose-200 dark:border-rose-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Records with Validation Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[150px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Row</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedProducts
                    .filter((p) => !p.isValid)
                    .slice(0, 10)
                    .map((product) => (
                      <TableRow key={`invalid-${product.rowIndex}`}>
                        <TableCell className="font-mono text-xs">{product.rowIndex}</TableCell>
                        <TableCell>{product.name || '(empty)'}</TableCell>
                        <TableCell className="text-xs text-rose-600 dark:text-rose-400">
                          {product.validationErrors.join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderImportingStep = () => (
    <div className="flex flex-col items-center justify-center space-y-6 py-10 min-h-[250px]">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Importing products...</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      <p className="text-sm text-muted-foreground">Please do not close this dialog</p>
    </div>
  );

  const renderCompleteStep = () => {
    if (!importResult) return null;

    const totalProcessed =
      importResult.imported + importResult.updated + importResult.skipped + importResult.failed;
    const successCount = importResult.imported + importResult.updated;

    return (
      <div className="space-y-6 py-4">
        {/* Success banner */}
        <div
          className={cn(
            'flex items-center gap-4 p-4 rounded-lg',
            successCount > 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : 'bg-rose-50 dark:bg-rose-900/20'
          )}
        >
          {successCount > 0 ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <XCircle className="h-8 w-8 text-rose-600" />
          )}
          <div>
            <p className="font-semibold text-lg">
              {successCount > 0 ? 'Import Complete!' : 'Import Failed'}
            </p>
            <p className="text-sm text-muted-foreground">
              {successCount} of {totalProcessed} records processed successfully
            </p>
          </div>
        </div>

        {/* Results breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{importResult.imported}</p>
            <p className="text-xs text-muted-foreground">New Imported</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
            <p className="text-xs text-muted-foreground">Updated</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-rose-600">{importResult.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </Card>
        </div>

        {/* Download error report */}
        {importResult.errors.length > 0 && (
          <Card className="border-rose-200 dark:border-rose-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-rose-600 dark:text-rose-400">
                    {importResult.errors.length} records failed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Download the error report for details
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={step === 'importing' ? undefined : handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV or Excel file with product data'}
            {step === 'map' && 'Map your file columns to product fields'}
            {step === 'preview' && 'Review import preview and select duplicate handling'}
            {step === 'importing' && 'Importing products...'}
            {step === 'complete' && 'Import summary'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="py-4">
            {step === 'upload' && renderUploadStep()}
            {step === 'map' && renderMapStep()}
            {step === 'preview' && renderPreviewStep()}
            {step === 'importing' && renderImportingStep()}
            {step === 'complete' && renderCompleteStep()}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          {step === 'upload' && (
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleProceedToPreview} disabled={loading}>
                Preview Import
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleStartImport}
                disabled={loadingExisting || stats.valid === 0}
              >
                {loadingExisting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    Import {stats.valid} Products
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkCSVUploader;
