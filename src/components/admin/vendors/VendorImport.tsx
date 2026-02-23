/**
 * VendorImport Component
 *
 * Import multiple vendors from CSV file.
 * Fields: name, contact name, email, phone, address, license number
 * Features:
 * - File upload (CSV/Excel)
 * - Column mapping
 * - Duplicate detection by name and license number
 * - Preview with validation errors
 * - Import results summary
 * - Activity logging
 */

import { useState, useMemo, useCallback } from 'react';
import { read, utils } from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import Upload from 'lucide-react/dist/esm/icons/upload';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Download from 'lucide-react/dist/esm/icons/download';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logActivity, ActivityAction, EntityType } from '@/lib/activityLog';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface VendorImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'map' | 'preview' | 'importing' | 'complete';

type DuplicateStrategy = 'skip' | 'overwrite';

interface SystemField {
  key: string;
  label: string;
  required: boolean;
}

interface ParsedVendor {
  rowIndex: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  license_number: string | null;
  isValid: boolean;
  validationErrors: string[];
}

interface ExistingVendor {
  id: string;
  name: string;
  license_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
}

interface DuplicateMatch {
  parsed: ParsedVendor;
  existing: ExistingVendor;
  matchType: 'name' | 'license' | 'both';
}

interface ImportResult {
  imported: number;
  skipped: number;
  overwritten: number;
  failed: number;
  errors: Array<{ row: number; reason: string; data: Record<string, unknown> }>;
}

// ============================================================================
// Constants
// ============================================================================

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'name', label: 'Vendor Name', required: true },
  { key: 'contact_name', label: 'Contact Name', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'license_number', label: 'License Number', required: false },
];

// ============================================================================
// Helper Functions
// ============================================================================

function sanitizeString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
}

function sanitizeEmail(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const email = String(value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function sanitizePhone(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^\d+\-() ]/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

// ============================================================================
// Main Component
// ============================================================================

export function VendorImport({ open, onOpenChange, onSuccess }: VendorImportProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedVendors, setParsedVendors] = useState<ParsedVendor[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ============================================================================
  // File Handling
  // ============================================================================

  const parseFile = useCallback(async (fileToRead: File) => {
    setLoading(true);
    try {
      const buffer = await fileToRead.arrayBuffer();
      const workbook = read(buffer);
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
            field.label.toLowerCase().includes(h.toLowerCase()) ||
            (field.key === 'name' && h.toLowerCase().includes('vendor')) ||
            (field.key === 'license_number' && h.toLowerCase().includes('license'))
        );
        if (match) initialMapping[field.key] = match;
      });
      setMapping(initialMapping);
      setStep('map');
    } catch (error) {
      logger.error('Error parsing file', error, { component: 'VendorImport' });
      toast.error('Failed to parse file. Please check the format.');
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const validExtensions = ['.csv', '.xlsx', '.xls'];

    const isValid =
      validTypes.includes(selectedFile.type) ||
      validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    setFile(selectedFile);
    await parseFile(selectedFile);
  }, [parseFile]);

  // ============================================================================
  // Validation and Duplicate Detection
  // ============================================================================

  const validateAndParse = useCallback(() => {
    const parsed: ParsedVendor[] = rawRecords.map((record, index) => {
      const errors: string[] = [];

      const name = sanitizeString(record[mapping.name]);
      const contact_name = mapping.contact_name ? sanitizeString(record[mapping.contact_name]) : null;
      const email = mapping.email ? sanitizeEmail(record[mapping.email]) : null;
      const phone = mapping.phone ? sanitizePhone(record[mapping.phone]) : null;
      const address = mapping.address ? sanitizeString(record[mapping.address]) : null;
      const license_number = mapping.license_number ? sanitizeString(record[mapping.license_number]) : null;

      // Validation
      if (!name) errors.push('Vendor name is required');
      if (mapping.email && record[mapping.email] && !email) {
        errors.push('Invalid email format');
      }

      return {
        rowIndex: index + 2, // +2 for header row and 1-based index
        name: name || '',
        contact_name,
        email,
        phone,
        address,
        license_number,
        isValid: errors.length === 0,
        validationErrors: errors,
      };
    });

    setParsedVendors(parsed);
    return parsed;
  }, [rawRecords, mapping]);

  // Query existing vendors for duplicate detection
  const { data: existingVendors, isLoading: loadingExisting } = useQuery({
    queryKey: ['vendor-import-duplicates', tenantId, parsedVendors.length],
    queryFn: async () => {
      if (!tenantId || parsedVendors.length === 0) return [];

      // Collect all names and license numbers from parsed data
      const names = parsedVendors
        .filter((v) => v.name)
        .map((v) => v.name.toLowerCase());
      const licenses = parsedVendors
        .filter((v) => v.license_number)
        .map((v) => v.license_number as string);

      if (names.length === 0 && licenses.length === 0) return [];

      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, license_number, contact_name, contact_email, contact_phone, address')
        .eq('account_id', tenantId);

      if (error) {
        logger.error('Failed to fetch existing vendors for duplicate check', error, {
          component: 'VendorImport',
          tenantId,
        });
        throw error;
      }

      return (data || []) as ExistingVendor[];
    },
    enabled: !!tenantId && parsedVendors.length > 0 && step === 'preview',
    staleTime: 0,
  });

  // Compute duplicates
  const computedDuplicates = useMemo(() => {
    if (!existingVendors || existingVendors.length === 0) return [];

    const matches: DuplicateMatch[] = [];
    const nameMap = new Map<string, ExistingVendor>();
    const licenseMap = new Map<string, ExistingVendor>();

    existingVendors.forEach((vendor) => {
      if (vendor.name) {
        nameMap.set(vendor.name.toLowerCase(), vendor);
      }
      if (vendor.license_number) {
        licenseMap.set(vendor.license_number.toLowerCase(), vendor);
      }
    });

    parsedVendors.forEach((parsed) => {
      if (!parsed.isValid) return;

      const nameMatch = parsed.name ? nameMap.get(parsed.name.toLowerCase()) : undefined;
      const licenseMatch = parsed.license_number
        ? licenseMap.get(parsed.license_number.toLowerCase())
        : undefined;

      if (nameMatch && licenseMatch && nameMatch.id === licenseMatch.id) {
        matches.push({
          parsed,
          existing: nameMatch,
          matchType: 'both',
        });
      } else if (nameMatch) {
        matches.push({
          parsed,
          existing: nameMatch,
          matchType: 'name',
        });
      } else if (licenseMatch) {
        matches.push({
          parsed,
          existing: licenseMatch,
          matchType: 'license',
        });
      }
    });

    return matches;
  }, [existingVendors, parsedVendors]);

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
        skipped: 0,
        overwritten: 0,
        failed: 0,
        errors: [],
      };

      const validVendors = parsedVendors.filter((v) => v.isValid);
      const duplicateRowIndices = new Set(duplicates.map((d) => d.parsed.rowIndex));
      const total = validVendors.length;
      let processed = 0;

      // Process each vendor
      for (const vendor of validVendors) {
        try {
          const isDuplicate = duplicateRowIndices.has(vendor.rowIndex);
          const duplicate = isDuplicate
            ? duplicates.find((d) => d.parsed.rowIndex === vendor.rowIndex)
            : null;

          if (isDuplicate && duplicate) {
            switch (duplicateStrategy) {
              case 'skip':
                result.skipped++;
                break;

              case 'overwrite': {
                // Overwrite: update existing vendor with all new values
                const { error: overwriteError } = await supabase
                  .from('vendors')
                  .update({
                    name: vendor.name,
                    contact_name: vendor.contact_name,
                    contact_email: vendor.email,
                    contact_phone: vendor.phone,
                    address: vendor.address,
                    license_number: vendor.license_number,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', duplicate.existing.id)
                  .eq('account_id', tenantId);

                if (overwriteError) {
                  logger.error('Failed to overwrite vendor', overwriteError, {
                    component: 'VendorImport',
                    vendorId: duplicate.existing.id,
                  });
                  result.errors.push({
                    row: vendor.rowIndex,
                    reason: `Overwrite failed: ${overwriteError.message}`,
                    data: vendor as unknown as Record<string, unknown>,
                  });
                  result.failed++;
                } else {
                  result.overwritten++;
                }
                break;
              }
            }
          } else {
            // No duplicate - insert new vendor
            const { error: insertError } = await supabase.from('vendors').insert({
              account_id: tenantId,
              name: vendor.name,
              contact_name: vendor.contact_name,
              contact_email: vendor.email,
              contact_phone: vendor.phone,
              address: vendor.address,
              license_number: vendor.license_number,
              status: 'active',
            });

            if (insertError) {
              logger.error('Failed to insert vendor', insertError, {
                component: 'VendorImport',
                row: vendor.rowIndex,
              });
              result.errors.push({
                row: vendor.rowIndex,
                reason: `Insert failed: ${insertError.message}`,
                data: vendor as unknown as Record<string, unknown>,
              });
              result.failed++;
            } else {
              result.imported++;
            }
          }
        } catch (error) {
          logger.error('Unexpected error processing vendor', error, {
            component: 'VendorImport',
            row: vendor.rowIndex,
          });
          result.errors.push({
            row: vendor.rowIndex,
            reason: error instanceof Error ? error.message : 'Unknown error',
            data: vendor as unknown as Record<string, unknown>,
          });
          result.failed++;
        }

        processed++;
        setProgress(Math.round((processed / total) * 100));
      }

      // Log the import action
      if (admin?.userId) {
        await logActivity(
          tenantId,
          admin.userId,
          ActivityAction.CREATED,
          EntityType.VENDOR,
          null,
          {
            action: 'vendor_bulk_import',
            filename: file?.name,
            totalRecords: rawRecords.length,
            validRecords: validVendors.length,
            duplicatesFound: duplicates.length,
            duplicateStrategy,
            result: {
              imported: result.imported,
              skipped: result.skipped,
              overwritten: result.overwritten,
              failed: result.failed,
            },
          }
        );
      }

      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('complete');

      // Invalidate vendor queries
      queryClient.invalidateQueries({ queryKey: ['vendors'] });

      const successCount = result.imported + result.overwritten;
      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} vendors`);
      }

      if (result.failed > 0) {
        toast.warning(`${result.failed} records failed to import`);
      }
    },
    onError: (error) => {
      logger.error('Vendor import failed', error, { component: 'VendorImport' });
      toast.error('Import failed. Please try again.');
      setLoading(false);
    },
  });

  // ============================================================================
  // Navigation Handlers
  // ============================================================================

  const handleProceedToPreview = useCallback(() => {
    // Validate required mapping
    const missingRequired = SYSTEM_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }

    const parsed = validateAndParse();
    const validCount = parsed.filter((v) => v.isValid).length;

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
    setParsedVendors([]);
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

  const downloadTemplate = useCallback(() => {
    const headers = SYSTEM_FIELDS.map((f) => f.label);
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadErrorReport = useCallback(() => {
    if (!importResult || importResult.errors.length === 0) return;

    const blob = new Blob([JSON.stringify(importResult.errors, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-import-errors-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [importResult]);

  // ============================================================================
  // Statistics
  // ============================================================================

  const stats = useMemo(() => {
    const valid = parsedVendors.filter((v) => v.isValid).length;
    const invalid = parsedVendors.filter((v) => !v.isValid).length;
    const duplicateCount = duplicates.length;
    const newCount = valid - duplicateCount;

    return { valid, invalid, duplicateCount, newCount };
  }, [parsedVendors, duplicates]);

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
        onClick={() => document.getElementById('csv-upload-vendors')?.click()}
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
          id="csv-upload-vendors"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
          aria-label="Upload CSV or Excel file for vendor import"
        />
      </div>

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs p-3 rounded-md flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Tips:</strong>
          <ul className="list-disc ml-4 mt-1 space-y-1">
            <li>Required field: Vendor Name</li>
            <li>Duplicate detection uses Name and License Number</li>
            <li>Useful when onboarding multiple vendors at once</li>
          </ul>
        </div>
      </div>
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
      <div className="space-y-4">
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
                setMapping((prev) => ({ ...prev, [field.key]: val === '_ignore' ? '' : val }))
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
          <p className="text-xs text-muted-foreground">Duplicates Found</p>
        </Card>
        <Card className="p-4 text-center">
          <Building2 className="h-6 w-6 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">{loadingExisting ? '...' : stats.newCount}</p>
          <p className="text-xs text-muted-foreground">New Vendors</p>
        </Card>
      </div>

      {/* Duplicate handling strategy */}
      {stats.duplicateCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Duplicate Handling Strategy
            </CardTitle>
            <CardDescription>
              {stats.duplicateCount} existing vendor(s) match by name or license number
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={duplicateStrategy}
              onValueChange={(v) => setDuplicateStrategy(v as DuplicateStrategy)}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <Label
                htmlFor="skip"
                className={cn(
                  'flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors',
                  duplicateStrategy === 'skip' && 'border-primary bg-primary/5'
                )}
              >
                <RadioGroupItem value="skip" id="skip" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4" />
                    <span className="font-medium">Skip</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Keep existing vendor records unchanged
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="overwrite"
                className={cn(
                  'flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors',
                  duplicateStrategy === 'overwrite' && 'border-primary bg-primary/5'
                )}
              >
                <RadioGroupItem value="overwrite" id="overwrite" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    <span className="font-medium">Overwrite</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Replace existing with new data
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
            <CardTitle className="text-sm">Matched Existing Vendors</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Row</TableHead>
                    <TableHead>Imported Data</TableHead>
                    <TableHead>Existing Vendor</TableHead>
                    <TableHead className="w-[100px]">Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.slice(0, 10).map((dup, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{dup.parsed.rowIndex}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{dup.parsed.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {dup.parsed.license_number || 'No license'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{dup.existing.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {dup.existing.license_number || 'No license'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={dup.matchType === 'both' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {dup.matchType === 'both'
                            ? 'Name & License'
                            : dup.matchType === 'name'
                            ? 'Name'
                            : 'License'}
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
                    <TableHead className="w-[80px]">Row</TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedVendors
                    .filter((v) => !v.isValid)
                    .slice(0, 10)
                    .map((vendor, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{vendor.rowIndex}</TableCell>
                        <TableCell>{vendor.name || '(empty)'}</TableCell>
                        <TableCell className="text-xs text-rose-600 dark:text-rose-400">
                          {vendor.validationErrors.join(', ')}
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
          <span>Importing vendors...</span>
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
      importResult.imported + importResult.overwritten + importResult.skipped + importResult.failed;
    const successCount = importResult.imported + importResult.overwritten;

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
            <p className="text-2xl font-bold text-purple-600">{importResult.overwritten}</p>
            <p className="text-xs text-muted-foreground">Overwritten</p>
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
            Import Vendors
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV or Excel file with vendor data'}
            {step === 'map' && 'Map your file columns to vendor fields'}
            {step === 'preview' && 'Review import preview and select duplicate handling strategy'}
            {step === 'importing' && 'Importing vendors...'}
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
                    Import {stats.valid} Vendors
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

export default VendorImport;
