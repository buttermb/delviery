/**
 * CustomerImport Component
 *
 * Upload CSV with customer data. Parse and validate name, phone, email, address.
 * Duplicate detection by phone/email. Show preview with matched existing customers.
 * Options: skip duplicates, merge, overwrite. Import results summary.
 * Log action to activity_log. Connects to customer search for deduplication.
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
  Users,
  Download,
  SkipForward,
  Merge,
  RefreshCw,
  User,
  Phone,
  Mail,
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
import { useActivityLog, ActivityAction, EntityType } from '@/hooks/useActivityLog';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CustomerImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'map' | 'preview' | 'importing' | 'complete';

type DuplicateStrategy = 'skip' | 'merge' | 'overwrite';

interface ParsedCustomer {
  rowIndex: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  isValid: boolean;
  validationErrors: string[];
}

interface ExistingCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface DuplicateMatch {
  parsed: ParsedCustomer;
  existing: ExistingCustomer;
  matchType: 'email' | 'phone' | 'both';
}

interface ImportResult {
  imported: number;
  skipped: number;
  merged: number;
  overwritten: number;
  failed: number;
  errors: Array<{ row: number; reason: string; data: Record<string, unknown> }>;
}

// ============================================================================
// Constants
// ============================================================================

const SYSTEM_FIELDS = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'zip_code', label: 'ZIP Code', required: false },
];

// ============================================================================
// Helper Functions
// ============================================================================

function sanitizePhone(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  // Remove all non-digit characters except +
  const cleaned = String(value).replace(/[^\d+]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeEmail(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const email = String(value).trim().toLowerCase();
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function sanitizeString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomerImport({ open, onOpenChange, onSuccess }: CustomerImportProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedCustomers, setParsedCustomers] = useState<ParsedCustomer[]>([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parseFile is defined below and is stable (no deps)
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
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
            (field.key === 'zip_code' && h.toLowerCase().includes('zip')) ||
            (field.key === 'zip_code' && h.toLowerCase().includes('postal'))
        );
        if (match) initialMapping[field.key] = match;
      });
      setMapping(initialMapping);
      setStep('map');
    } catch (error) {
      logger.error('Error parsing file', error, { component: 'CustomerImport' });
      toast.error('Failed to parse file. Please check the format.', { description: humanizeError(error) });
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Validation and Duplicate Detection
  // ============================================================================

  const validateAndParse = useCallback(() => {
    const parsed: ParsedCustomer[] = rawRecords.map((record, index) => {
      const errors: string[] = [];

      const first_name = sanitizeString(record[mapping.first_name]);
      const last_name = sanitizeString(record[mapping.last_name]);
      const email = mapping.email ? sanitizeEmail(record[mapping.email]) : null;
      const phone = mapping.phone ? sanitizePhone(record[mapping.phone]) : null;
      const address = mapping.address ? sanitizeString(record[mapping.address]) : null;
      const city = mapping.city ? sanitizeString(record[mapping.city]) : null;
      const state = mapping.state ? sanitizeString(record[mapping.state]) : null;
      const zip_code = mapping.zip_code ? sanitizeString(record[mapping.zip_code]) : null;

      // Validation
      if (!first_name) errors.push('First name is required');
      if (!last_name) errors.push('Last name is required');
      if (mapping.email && record[mapping.email] && !email) {
        errors.push('Invalid email format');
      }

      return {
        rowIndex: index + 2, // +2 for header row and 1-based index
        first_name: first_name ?? '',
        last_name: last_name ?? '',
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        isValid: errors.length === 0,
        validationErrors: errors,
      };
    });

    setParsedCustomers(parsed);
    return parsed;
  }, [rawRecords, mapping]);

  // Query existing customers for duplicate detection
  const { data: existingCustomers, isLoading: loadingExisting } = useQuery({
    queryKey: queryKeys.customerDetail.importDuplicates(tenantId, parsedCustomers),
    queryFn: async () => {
      if (!tenantId || parsedCustomers.length === 0) return [];

      // Collect all unique emails and phones from parsed data
      const emails = parsedCustomers
        .filter((c) => c.email)
        .map((c) => c.email as string);
      const phones = parsedCustomers
        .filter((c) => c.phone)
        .map((c) => c.phone as string);

      if (emails.length === 0 && phones.length === 0) return [];

      // Build query to find matching customers
      let query = supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, address, city, state, zip_code')
        .eq('tenant_id', tenantId);

      // Build OR conditions for email and phone matches
      const orConditions: string[] = [];
      if (emails.length > 0) {
        orConditions.push(`email.in.(${emails.join(',')})`);
      }
      if (phones.length > 0) {
        orConditions.push(`phone.in.(${phones.join(',')})`);
      }

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch existing customers for duplicate check', error, {
          component: 'CustomerImport',
          tenantId,
        });
        throw error;
      }

      return data as ExistingCustomer[];
    },
    enabled: !!tenantId && parsedCustomers.length > 0 && step === 'preview',
    staleTime: 0,
  });

  // Compute duplicates
  const computedDuplicates = useMemo(() => {
    if (!existingCustomers || existingCustomers.length === 0) return [];

    const matches: DuplicateMatch[] = [];
    const emailMap = new Map<string, ExistingCustomer>();
    const phoneMap = new Map<string, ExistingCustomer>();

    existingCustomers.forEach((customer) => {
      if (customer.email) {
        emailMap.set(customer.email.toLowerCase(), customer);
      }
      if (customer.phone) {
        phoneMap.set(customer.phone, customer);
      }
    });

    parsedCustomers.forEach((parsed) => {
      if (!parsed.isValid) return;

      const emailMatch = parsed.email ? emailMap.get(parsed.email.toLowerCase()) : undefined;
      const phoneMatch = parsed.phone ? phoneMap.get(parsed.phone) : undefined;

      if (emailMatch && phoneMatch && emailMatch.id === phoneMatch.id) {
        matches.push({
          parsed,
          existing: emailMatch,
          matchType: 'both',
        });
      } else if (emailMatch) {
        matches.push({
          parsed,
          existing: emailMatch,
          matchType: 'email',
        });
      } else if (phoneMatch) {
        matches.push({
          parsed,
          existing: phoneMatch,
          matchType: 'phone',
        });
      }
    });

    return matches;
  }, [existingCustomers, parsedCustomers]);

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
        merged: 0,
        overwritten: 0,
        failed: 0,
        errors: [],
      };

      const validCustomers = parsedCustomers.filter((c) => c.isValid);
      const duplicateRowIndices = new Set(duplicates.map((d) => d.parsed.rowIndex));
      const total = validCustomers.length;
      let processed = 0;

      // Process each customer
      for (const customer of validCustomers) {
        try {
          const isDuplicate = duplicateRowIndices.has(customer.rowIndex);
          const duplicate = isDuplicate
            ? duplicates.find((d) => d.parsed.rowIndex === customer.rowIndex)
            : null;

          if (isDuplicate && duplicate) {
            switch (duplicateStrategy) {
              case 'skip':
                result.skipped++;
                break;

              case 'merge': {
                // Merge: update existing customer with new non-null values
                const updates: Record<string, unknown> = {};
                if (customer.address && !duplicate.existing.address) {
                  updates.address = customer.address;
                }
                if (customer.city && !duplicate.existing.city) {
                  updates.city = customer.city;
                }
                if (customer.state && !duplicate.existing.state) {
                  updates.state = customer.state;
                }
                if (customer.zip_code && !duplicate.existing.zip_code) {
                  updates.zip_code = customer.zip_code;
                }

                if (Object.keys(updates).length > 0) {
                  const { error: updateError } = await supabase
                    .from('customers')
                    .update(updates)
                    .eq('id', duplicate.existing.id)
                    .eq('tenant_id', tenantId);

                  if (updateError) {
                    logger.error('Failed to merge customer', updateError, {
                      component: 'CustomerImport',
                      customerId: duplicate.existing.id,
                    });
                    result.errors.push({
                      row: customer.rowIndex,
                      reason: `Merge failed: ${updateError.message}`,
                      data: customer as unknown as Record<string, unknown>,
                    });
                    result.failed++;
                  } else {
                    result.merged++;
                  }
                } else {
                  // Nothing to merge, count as skipped
                  result.skipped++;
                }
                break;
              }

              case 'overwrite': {
                // Overwrite: update existing customer with all new values
                const { error: overwriteError } = await supabase
                  .from('customers')
                  .update({
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    city: customer.city,
                    state: customer.state,
                    zip_code: customer.zip_code,
                  })
                  .eq('id', duplicate.existing.id)
                  .eq('tenant_id', tenantId);

                if (overwriteError) {
                  logger.error('Failed to overwrite customer', overwriteError, {
                    component: 'CustomerImport',
                    customerId: duplicate.existing.id,
                  });
                  result.errors.push({
                    row: customer.rowIndex,
                    reason: `Overwrite failed: ${overwriteError.message}`,
                    data: customer as unknown as Record<string, unknown>,
                  });
                  result.failed++;
                } else {
                  result.overwritten++;
                }
                break;
              }
            }
          } else {
            // No duplicate - insert new customer
            const { error: insertError } = await supabase.from('customers').insert({
              tenant_id: tenantId,
              first_name: customer.first_name,
              last_name: customer.last_name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              city: customer.city,
              state: customer.state,
              zip_code: customer.zip_code,
              status: 'active',
              total_spent: 0,
              loyalty_points: 0,
              loyalty_tier: 'bronze',
            });

            if (insertError) {
              logger.error('Failed to insert customer', insertError, {
                component: 'CustomerImport',
                row: customer.rowIndex,
              });
              result.errors.push({
                row: customer.rowIndex,
                reason: `Insert failed: ${insertError.message}`,
                data: customer as unknown as Record<string, unknown>,
              });
              result.failed++;
            } else {
              result.imported++;
            }
          }
        } catch (error) {
          logger.error('Unexpected error processing customer', error, {
            component: 'CustomerImport',
            row: customer.rowIndex,
          });
          result.errors.push({
            row: customer.rowIndex,
            reason: error instanceof Error ? error.message : 'Unknown error',
            data: customer as unknown as Record<string, unknown>,
          });
          result.failed++;
        }

        processed++;
        setProgress(Math.round((processed / total) * 100));
      }

      // Log the import action
      await logActivity(ActivityAction.CREATED, EntityType.CUSTOMER, undefined, {
        action: 'customer_import',
        filename: file?.name,
        totalRecords: rawRecords.length,
        validRecords: validCustomers.length,
        duplicatesFound: duplicates.length,
        duplicateStrategy,
        result: {
          imported: result.imported,
          skipped: result.skipped,
          merged: result.merged,
          overwritten: result.overwritten,
          failed: result.failed,
        },
        performedBy: admin?.userId,
      });

      return result;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('complete');

      // Invalidate customer queries
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      const successCount = result.imported + result.merged + result.overwritten;
      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} customers`);
      }

      if (result.failed > 0) {
        toast.warning(`${result.failed} records failed to import`);
      }
    },
    onError: (error) => {
      logger.error('Customer import failed', error, { component: 'CustomerImport' });
      toast.error('Import failed. Please try again.', { description: humanizeError(error) });
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
    const validCount = parsed.filter((c) => c.isValid).length;

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
    setParsedCustomers([]);
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
    a.download = `customer-import-errors-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [importResult]);

  // ============================================================================
  // Statistics
  // ============================================================================

  const stats = useMemo(() => {
    const valid = parsedCustomers.filter((c) => c.isValid).length;
    const invalid = parsedCustomers.filter((c) => !c.isValid).length;
    const duplicateCount = duplicates.length;
    const newCount = valid - duplicateCount;

    return { valid, invalid, duplicateCount, newCount };
  }, [parsedCustomers, duplicates]);

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderUploadStep = () => (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-4',
        'hover:bg-muted/50 transition-colors cursor-pointer min-h-[300px]'
      )}
      onClick={() => document.getElementById('csv-upload-customers')?.click()}
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
        id="csv-upload-customers"
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
        disabled={loading}
        aria-label="Upload CSV or Excel file for customer import"
      />
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

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs p-3 rounded-md flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>Tip:</strong> At least one of Email or Phone is recommended for duplicate
          detection.
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
          <Users className="h-6 w-6 mx-auto mb-2 text-amber-500" />
          <p className="text-2xl font-bold">{loadingExisting ? '...' : stats.duplicateCount}</p>
          <p className="text-xs text-muted-foreground">Duplicates Found</p>
        </Card>
        <Card className="p-4 text-center">
          <User className="h-6 w-6 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">{loadingExisting ? '...' : stats.newCount}</p>
          <p className="text-xs text-muted-foreground">New Customers</p>
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
              {stats.duplicateCount} existing customer(s) match by email or phone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={duplicateStrategy}
              onValueChange={(v) => setDuplicateStrategy(v as DuplicateStrategy)}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
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
                    Keep existing records unchanged
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="merge"
                className={cn(
                  'flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors',
                  duplicateStrategy === 'merge' && 'border-primary bg-primary/5'
                )}
              >
                <RadioGroupItem value="merge" id="merge" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Merge className="h-4 w-4" />
                    <span className="font-medium">Merge</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fill in missing fields only
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
            <CardTitle className="text-sm">Matched Existing Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Row</TableHead>
                    <TableHead>Imported Data</TableHead>
                    <TableHead>Existing Customer</TableHead>
                    <TableHead className="w-[100px]">Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.slice(0, 10).map((dup) => (
                    <TableRow key={`dup-${dup.parsed.rowIndex}-${dup.existing.id}`}>
                      <TableCell className="font-mono text-xs">{dup.parsed.rowIndex}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {dup.parsed.first_name} {dup.parsed.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dup.parsed.email || dup.parsed.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {dup.existing.first_name} {dup.existing.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dup.existing.email || dup.existing.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={dup.matchType === 'both' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {dup.matchType === 'both' ? (
                            'Email & Phone'
                          ) : dup.matchType === 'email' ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> Email
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> Phone
                            </span>
                          )}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedCustomers
                    .filter((c) => !c.isValid)
                    .slice(0, 10)
                    .map((customer) => (
                      <TableRow key={`invalid-${customer.rowIndex}`}>
                        <TableCell className="font-mono text-xs">{customer.rowIndex}</TableCell>
                        <TableCell>
                          {customer.first_name || '(empty)'} {customer.last_name || '(empty)'}
                        </TableCell>
                        <TableCell className="text-xs text-rose-600 dark:text-rose-400">
                          {customer.validationErrors.join(', ')}
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
    <div className="flex flex-col items-center justify-center space-y-6 py-10 min-h-[300px]">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Importing customers...</span>
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
      importResult.imported +
      importResult.merged +
      importResult.overwritten +
      importResult.skipped +
      importResult.failed;
    const successCount = importResult.imported + importResult.merged + importResult.overwritten;

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{importResult.imported}</p>
            <p className="text-xs text-muted-foreground">New Imported</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{importResult.merged}</p>
            <p className="text-xs text-muted-foreground">Merged</p>
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
            Import Customers
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV or Excel file with customer data'}
            {step === 'map' && 'Map your file columns to customer fields'}
            {step === 'preview' &&
              'Review import preview and select duplicate handling strategy'}
            {step === 'importing' && 'Importing customers...'}
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
                    Import {stats.valid} Customers
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

export default CustomerImport;
