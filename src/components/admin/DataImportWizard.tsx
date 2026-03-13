/**
 * DataImportWizard
 * Multi-step CSV import wizard dialog for products, customers, and orders.
 * Steps: entity selection + file upload, column mapping, validation preview, import confirmation.
 */

import { useState, useCallback } from 'react';

import { Upload, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityType = 'products' | 'customers' | 'orders';

interface ColumnMapping {
  csvHeader: string;
  targetField: string;
}

interface ValidationRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: Record<string, string>;
  isValid: boolean;
}

interface DataImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (entityType: EntityType, validRows: Record<string, string>[]) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_FIELDS: Record<EntityType, { value: string; label: string }[]> = {
  products: [
    { value: 'name', label: 'Name' },
    { value: 'sku', label: 'SKU' },
    { value: 'price', label: 'Price' },
    { value: 'category', label: 'Category' },
    { value: 'description', label: 'Description' },
    { value: 'stock_quantity', label: 'Stock Quantity' },
  ],
  customers: [
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'address', label: 'Address' },
  ],
  orders: [
    { value: 'order_number', label: 'Order Number' },
    { value: 'customer_email', label: 'Customer Email' },
    { value: 'total', label: 'Total' },
    { value: 'status', label: 'Status' },
    { value: 'created_at', label: 'Date' },
  ],
};

const REQUIRED_FIELDS: Record<EntityType, string[]> = {
  products: ['name', 'price'],
  customers: ['first_name', 'email'],
  orders: ['order_number', 'total'],
};

const SKIP_FIELD = '__skip__';

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRow(
  row: Record<string, string>,
  entityType: EntityType
): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = REQUIRED_FIELDS[entityType];

  for (const field of required) {
    if (!row[field] || row[field].trim().length === 0) {
      errors[field] = 'Required';
    }
  }

  if (entityType === 'products' && row.price) {
    if (isNaN(Number(row.price))) errors.price = 'Must be a number';
  }

  if (entityType === 'customers' && row.email) {
    if (!row.email.includes('@')) errors.email = 'Invalid email';
  }

  if (entityType === 'orders' && row.total) {
    if (isNaN(Number(row.total))) errors.total = 'Must be a number';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataImportWizard({
  open,
  onOpenChange,
  onImportComplete,
}: DataImportWizardProps) {
  const [step, setStep] = useState(0);
  const [entityType, setEntityType] = useState<EntityType>('products');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationRow[]>([]);

  const resetState = useCallback(() => {
    setStep(0);
    setEntityType('products');
    setCsvHeaders([]);
    setCsvRows([]);
    setMappings([]);
    setValidationResults([]);
  }, []);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) resetState();
      onOpenChange(open);
    },
    [onOpenChange, resetState]
  );

  // ---- Step 1: File upload ----
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { headers, rows } = parseCSV(text);

        if (headers.length === 0) {
          logger.warn('CSV file is empty or invalid', { component: 'DataImportWizard' });
          return;
        }

        setCsvHeaders(headers);
        setCsvRows(rows);

        // Auto-map columns by name similarity
        const fields = ENTITY_FIELDS[entityType];
        const autoMappings = headers.map((header) => {
          const normalized = header.toLowerCase().replace(/[_\s-]/g, '');
          const match = fields.find((f) => {
            const fieldNorm = f.value.toLowerCase().replace(/[_\s-]/g, '');
            return fieldNorm === normalized || f.label.toLowerCase().replace(/[_\s-]/g, '') === normalized;
          });
          return { csvHeader: header, targetField: match?.value ?? SKIP_FIELD };
        });

        setMappings(autoMappings);
        setStep(1);
      };
      reader.readAsText(file);
    },
    [entityType]
  );

  // ---- Step 2: Update mapping ----
  const updateMapping = useCallback((index: number, targetField: string) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, targetField } : m))
    );
  }, []);

  // ---- Step 2 -> 3: Run validation ----
  const runValidation = useCallback(() => {
    const results: ValidationRow[] = csvRows.map((row, rowIndex) => {
      const data: Record<string, string> = {};
      mappings.forEach((mapping, colIndex) => {
        if (mapping.targetField !== SKIP_FIELD) {
          data[mapping.targetField] = row[colIndex] ?? '';
        }
      });
      const errors = validateRow(data, entityType);
      return { rowIndex, data, errors, isValid: Object.keys(errors).length === 0 };
    });

    setValidationResults(results);
    setStep(2);
  }, [csvRows, mappings, entityType]);

  // ---- Step 4: Import ----
  const handleImport = useCallback(() => {
    const validRows = validationResults
      .filter((r) => r.isValid)
      .map((r) => r.data);

    logger.info('Importing data', { entityType, count: validRows.length }, { component: 'DataImportWizard' });
    onImportComplete(entityType, validRows);
    handleClose(false);
  }, [validationResults, entityType, onImportComplete, handleClose]);

  const validCount = validationResults.filter((r) => r.isValid).length;
  const invalidCount = validationResults.filter((r) => !r.isValid).length;
  const previewRows = validationResults.slice(0, 5);
  const mappedFields = mappings
    .filter((m) => m.targetField !== SKIP_FIELD)
    .map((m) => m.targetField);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            {step === 0 && 'Select data type and upload a CSV file.'}
            {step === 1 && 'Map CSV columns to data fields.'}
            {step === 2 && 'Review validation results.'}
            {step === 3 && 'Confirm and import.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {['Upload', 'Map', 'Validate', 'Import'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium ${
                  i === step
                    ? 'bg-primary text-primary-foreground'
                    : i < step
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {i < 3 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Entity type + file upload */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Entity Type</label>
              <Select
                value={entityType}
                onValueChange={(v) => setEntityType(v as EntityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">CSV File</label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === 1 && (
          <div className="space-y-3">
            {mappings.map((mapping, index) => (
              <div key={mapping.csvHeader} className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{mapping.csvHeader}</span>
                </div>
                <span className="text-muted-foreground text-sm">-&gt;</span>
                <div className="flex-1">
                  <Select
                    value={mapping.targetField}
                    onValueChange={(v) => updateMapping(index, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP_FIELD}>-- Skip --</SelectItem>
                      {ENTITY_FIELDS[entityType].map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Validation preview */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {invalidCount} invalid
                </Badge>
              )}
              <span className="text-muted-foreground">
                Showing first {previewRows.length} of {validationResults.length} rows
              </span>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    {mappedFields.map((field) => (
                      <th key={field} className="px-3 py-2 text-left font-medium">
                        {ENTITY_FIELDS[entityType].find((f) => f.value === field)?.label ?? field}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.rowIndex} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{row.rowIndex + 1}</td>
                      {mappedFields.map((field) => (
                        <td
                          key={field}
                          className={`px-3 py-2 ${row.errors[field] ? 'text-destructive' : ''}`}
                        >
                          <span className="truncate block max-w-[120px]">
                            {row.data[field] || '-'}
                          </span>
                          {row.errors[field] && (
                            <span className="text-xs text-destructive">{row.errors[field]}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 3 && (
          <div className="space-y-4 text-center py-4">
            <AlertCircle className="h-12 w-12 text-primary mx-auto" />
            <div>
              <p className="text-lg font-medium">
                Ready to import {validCount} {entityType}
              </p>
              {invalidCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {invalidCount} invalid row{invalidCount !== 1 ? 's' : ''} will be skipped.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button onClick={runValidation}>Validate</Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)}>Continue</Button>
          )}
          {step === 3 && (
            <Button onClick={handleImport} disabled={validCount === 0}>
              Import {validCount} Row{validCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
