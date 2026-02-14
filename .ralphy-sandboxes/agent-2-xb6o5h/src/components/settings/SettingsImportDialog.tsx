import { useState, useCallback, useRef } from 'react';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  FileJson,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileWarning,
  X
} from 'lucide-react';
import { toast } from 'sonner';

// Schema for settings validation
const generalSettingsSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  requirePasswordChange: z.boolean().optional(),
  sessionTimeout: z.number().min(5).max(1440).optional(),
  passwordMinLength: z.number().min(8).max(32).optional(),
});

const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  overdueAlerts: z.boolean().optional(),
  orderAlerts: z.boolean().optional(),
});

const settingsImportSchema = z.object({
  general: generalSettingsSchema.optional(),
  security: securitySettingsSchema.optional(),
  notifications: notificationSettingsSchema.optional(),
  exportedAt: z.string().optional(),
  version: z.string().optional(),
});

export type ImportedSettings = z.infer<typeof settingsImportSchema>;

interface ValidationResult {
  isValid: boolean;
  data: ImportedSettings | null;
  errors: string[];
  warnings: string[];
}

interface SettingsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (settings: ImportedSettings) => Promise<void>;
}

export function SettingsImportDialog({
  open,
  onOpenChange,
  onImport,
}: SettingsImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setValidationResult(null);
    setIsImporting(false);
    setIsDragging(false);
  }, []);

  const validateJsonContent = useCallback((content: string): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Try to parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        isValid: false,
        data: null,
        errors: ['Invalid JSON format. Please ensure the file contains valid JSON.'],
        warnings: [],
      };
    }

    // Check if it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        isValid: false,
        data: null,
        errors: ['Settings file must be a JSON object, not an array or primitive value.'],
        warnings: [],
      };
    }

    // Validate against schema
    const result = settingsImportSchema.safeParse(parsed);

    if (!result.success) {
      const zodErrors = result.error.errors.map(err => {
        const path = err.path.join('.');
        return `${path ? `${path}: ` : ''}${err.message}`;
      });
      return {
        isValid: false,
        data: null,
        errors: zodErrors,
        warnings: [],
      };
    }

    // Check for recognized sections
    const data = result.data;
    const recognizedSections = ['general', 'security', 'notifications'];
    const providedSections = Object.keys(parsed as object).filter(
      key => recognizedSections.includes(key) && (parsed as Record<string, unknown>)[key] !== undefined
    );

    if (providedSections.length === 0) {
      return {
        isValid: false,
        data: null,
        errors: ['No valid settings sections found. Expected at least one of: general, security, notifications.'],
        warnings: [],
      };
    }

    // Add warnings for unknown keys
    const unknownKeys = Object.keys(parsed as object).filter(
      key => !recognizedSections.includes(key) && !['exportedAt', 'version'].includes(key)
    );
    if (unknownKeys.length > 0) {
      warnings.push(`Unknown settings sections will be ignored: ${unknownKeys.join(', ')}`);
    }

    // Warn about version mismatch if present
    if (data.version && data.version !== '1.0') {
      warnings.push(`Settings file was exported from a different version (${data.version}). Some settings may not be compatible.`);
    }

    return {
      isValid: true,
      data,
      errors,
      warnings,
    };
  }, []);

  const processFile = useCallback(async (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    // Validate file size (max 1MB for settings)
    if (selectedFile.size > 1024 * 1024) {
      toast.error('File is too large. Settings file should be under 1MB.');
      return;
    }

    setFile(selectedFile);

    try {
      const content = await selectedFile.text();
      const result = validateJsonContent(content);
      setValidationResult(result);

      if (!result.isValid) {
        logger.warn('Settings import validation failed', { errors: result.errors });
      }
    } catch (error) {
      logger.error('Error reading settings file', error);
      setValidationResult({
        isValid: false,
        data: null,
        errors: ['Failed to read file contents. Please try again.'],
        warnings: [],
      });
    }
  }, [validateJsonContent]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [processFile]);

  const handleImport = useCallback(async () => {
    if (!validationResult?.isValid || !validationResult.data) {
      return;
    }

    setIsImporting(true);
    try {
      await onImport(validationResult.data);
      toast.success('Settings imported successfully');
      onOpenChange(false);
      resetState();
    } catch (error) {
      logger.error('Failed to import settings', error);
      toast.error('Failed to import settings. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [validationResult, onImport, onOpenChange, resetState]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, resetState]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Import Settings
          </DialogTitle>
          <DialogDescription>
            Import settings from a previously exported JSON file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Area */}
          {!file ? (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8
                flex flex-col items-center justify-center gap-3
                transition-colors cursor-pointer
                ${isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFilePicker}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Choose settings file"
              />
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  <span className="text-primary">Click to upload</span>
                  {' '}or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JSON file only (max 1MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded bg-muted">
                    <FileJson className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={isImporting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-3">
                {/* Errors */}
                {validationResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Validation Errors</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {validationResult.errors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Warnings */}
                {validationResult.warnings.length > 0 && (
                  <Alert>
                    <FileWarning className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {validationResult.warnings.map((warning, index) => (
                          <li key={index} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Success Preview */}
                {validationResult.isValid && validationResult.data && (
                  <Alert className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-700 dark:text-green-400">
                      File validated successfully
                    </AlertTitle>
                    <AlertDescription className="text-green-600 dark:text-green-500">
                      <p className="text-sm mt-1">
                        The following settings will be imported:
                      </p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {validationResult.data.general && (
                          <li className="text-sm">General settings</li>
                        )}
                        {validationResult.data.security && (
                          <li className="text-sm">Security settings</li>
                        )}
                        {validationResult.data.notifications && (
                          <li className="text-sm">Notification settings</li>
                        )}
                      </ul>
                      {validationResult.data.exportedAt && (
                        <p className="text-xs mt-2 text-muted-foreground">
                          Exported on: {new Date(validationResult.data.exportedAt).toLocaleString()}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!validationResult?.isValid || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Settings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
