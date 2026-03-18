import { useState } from "react";
import { read, utils } from "xlsx";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, AlertCircle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Label } from "@/components/ui/label";

interface CustomerImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

type ImportStep = 'upload' | 'map' | 'importing';

const SYSTEM_FIELDS = [
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'last_name', label: 'Last Name', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'date_of_birth', label: 'Date of Birth', required: false },
    { key: 'customer_type', label: 'Customer Type', required: false },
];

export function CustomerImportDialog({ open, onOpenChange, onSuccess }: CustomerImportDialogProps) {
    const { tenant } = useTenantAdminAuth();
    const [step, setStep] = useState<ImportStep>('upload');
    const [_file, setFile] = useState<File | null>(null);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [treatEmptyAsNull, setTreatEmptyAsNull] = useState(true);
    const [dateFormat, setDateFormat] = useState<'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'>('MM/DD/YYYY');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const validTypes = [
            "text/csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel"
        ];
        const validExtensions = [".csv", ".xlsx", ".xls"];

        const isValid = validTypes.includes(selectedFile.type) ||
            validExtensions.some(ext => selectedFile.name.endsWith(ext));

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
            const workbook = read(buffer);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

            if (jsonData.length === 0) {
                throw new Error("No records found in file");
            }

            const headers = Object.keys(jsonData[0]);
            setFileHeaders(headers);
            setRawRecords(jsonData);

            // Auto-map fields
            const initialMapping: Record<string, string> = {};
            SYSTEM_FIELDS.forEach(field => {
                const match = headers.find(h =>
                    h.toLowerCase().replace(/[^a-z0-9]/g, '') === field.key.toLowerCase().replace(/[^a-z0-9]/g, '') ||
                    h.toLowerCase().includes(field.label.toLowerCase())
                );
                if (match) initialMapping[field.key] = match;
            });
            setMapping(initialMapping);
            setStep('map');
        } catch (error) {
            logger.error("Error parsing file", error);
            toast.error("Failed to parse file. Please check format.", { description: humanizeError(error) });
            setFile(null);
        } finally {
            setLoading(false);
        }
    };

    const sanitizePhone = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        // If it's a number (from Excel), convert to string.
        // Note: Leading zeros might be lost by Excel itself before we get it if raw processing isn't careful.
        // But if we get a number 7700, we convert to "7700".
        // We can't magically guess "07700" unless we know valid length.
        return String(value).trim();
    };

    const parseDate = (value: unknown): string | null => {
        if (!value) return null;

        // Handle Excel Serial Number (e.g. 45318)
        if (typeof value === 'number') {
            const date = new Date((value - 25569) * 86400 * 1000); // Excel base date calculation
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        }

        const strVal = String(value).trim();
        // Regex for DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD with separators [/-.]
        const parts = strVal.split(/[/\-.]/);

        if (parts.length === 3) {
            let day, month, year;
            if (dateFormat === 'YYYY-MM-DD') {
                // Assuming standard ISO-like
                year = parseInt(parts[0]);
                month = parseInt(parts[1]);
                day = parseInt(parts[2]);
            } else if (dateFormat === 'MM/DD/YYYY') {
                month = parseInt(parts[0]);
                day = parseInt(parts[1]);
                year = parseInt(parts[2]);
            } else {
                // DD/MM/YYYY
                day = parseInt(parts[0]);
                month = parseInt(parts[1]);
                year = parseInt(parts[2]);
            }

            // Fix 2-digit years if needed (assume 20xx for now or 19xx)
            if (year < 100) year += 2000;

            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime()) && date.getMonth() === month - 1) {
                return date.toISOString().split('T')[0];
            }
        }

        // Fallback or ignore? warning?
        return null; // Or return original string if flexible? DB expects date type usually.
    };

    const handleImport = async () => {
        if (!tenant?.id) return;

        // Verify required fields
        const missingRequired = SYSTEM_FIELDS.filter(f => f.required && !mapping[f.key]);
        if (missingRequired.length > 0) {
            toast.error(`Please map required fields: ${missingRequired.map(f => f.label).join(', ')}`);
            return;
        }

        setStep('importing');
        setLoading(true);
        setProgress(0);

        try {
            // Normalization and Validation
            const validRecords: Record<string, unknown>[] = [];
            const invalidRecords: { row: number; reason: string; data: Record<string, unknown> }[] = [];

            rawRecords.forEach((record, index) => {
                const normalized: Record<string, unknown> = {};

                // Map fields using user selection
                Object.entries(mapping).forEach(([systemKey, fileHeader]) => {
                    if (fileHeader) {
                        let val = record[fileHeader];
                        if (typeof val === 'string') val = val.trim();

                        // Clean empty strings
                        if (treatEmptyAsNull && val === '') {
                            val = null;
                        }

                        normalized[systemKey] = val;
                    }
                });

                // Sanitize Phone specifically
                if (normalized.phone !== undefined && normalized.phone !== null) {
                    normalized.phone = sanitizePhone(normalized.phone);
                }

                // Parse Date
                if (normalized.date_of_birth) {
                    const parsed = parseDate(normalized.date_of_birth);
                    if (!parsed) {
                        invalidRecords.push({ row: index + 2, reason: `Invalid Date Format used for ${normalized.date_of_birth} (Expected ${dateFormat})`, data: record });
                        return;
                    }
                    normalized.date_of_birth = parsed;
                }

                // Check required fields (post-mapping)
                const missing = SYSTEM_FIELDS.filter(f => f.required && (normalized[f.key] === null || normalized[f.key] === undefined || normalized[f.key] === '')).map(f => f.label);
                if (missing.length > 0) {
                    invalidRecords.push({ row: index + 2, reason: `Missing: ${missing.join(', ')}`, data: record });
                    return;
                }

                // Email validation
                if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(normalized.email))) {
                    invalidRecords.push({ row: index + 2, reason: "Invalid email format", data: record });
                    return;
                }

                validRecords.push(normalized);
            });

            if (validRecords.length === 0) {
                throw new Error(`All ${rawRecords.length} records failed validation.`);
            }

            // Batched Insert
            const batchSize = 10;
            let insertedCount = 0;
            let insertFailures = 0;

            for (let i = 0; i < validRecords.length; i += batchSize) {
                const batch = validRecords.slice(i, i + batchSize);

                const { error } = await supabase.from('customers').insert(
                    batch.map(record => ({
                        account_id: tenant.id,
                        first_name: String(record.first_name || ''),
                        last_name: String(record.last_name || ''),
                        email: String(record.email || ''),
                        phone: record.phone ? String(record.phone) : null,
                        date_of_birth: record.date_of_birth ? String(record.date_of_birth) : null,
                        customer_type: String(record.customer_type || 'retail').toLowerCase(),
                        status: 'active',
                        total_spent: 0,
                        loyalty_points: 0,
                        loyalty_tier: 'bronze'
                    }))
                );

                if (error) {
                    logger.error("Batch insert failed", error);
                    insertFailures += batch.length;
                    batch.forEach((r, batchIndex) => {
                        invalidRecords.push({ row: i + batchIndex + 2, reason: `Database Error: ${error.message}`, data: r });
                    });
                } else {
                    insertedCount += batch.length;
                }

                setProgress(Math.round(((i + batchSize) / validRecords.length) * 100));
            }

            if (insertFailures > 0 || invalidRecords.length > 0) {
                const message = `Import complete: ${insertedCount} imported. ${invalidRecords.length} validation errors.`;
                toast.warning(message, {
                    duration: 6000,
                    action: {
                        label: "Download Report",
                        onClick: () => {
                            const blob = new Blob([JSON.stringify(invalidRecords, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `import-errors-${new Date().toISOString()}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        }
                    }
                });
            } else {
                toast.success(`Successfully imported ${insertedCount} customers`);
            }

            if (insertedCount > 0) {
                onSuccess?.();
                onOpenChange(false);
                resetState();
            } else {
                setLoading(false);
                setStep('map');
            }
        } catch (error) {
            logger.error('Import failed:', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerImportDialog' });
            toast.error(humanizeError(error, "Failed to import customers"));
            setLoading(false);
        }
    };

    const resetState = () => {
        setFile(null);
        setRawRecords([]);
        setFileHeaders([]);
        setMapping({});
        setStep('upload');
        setProgress(0);
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetState();
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Import Customers</DialogTitle>
                    <DialogDescription>
                        {step === 'upload' ? 'Upload a CSV or Excel file.' :
                            step === 'map' ? 'Map columns from your file to system fields.' :
                                'Importing data...'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 min-h-[300px]">
                    {step === 'upload' && (
                        <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => document.getElementById('csv-upload')?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('csv-upload')?.click(); } }}>
                            {loading ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Upload className="h-10 w-10 text-muted-foreground" />}
                            <div className="text-center">
                                <p className="text-sm font-medium">Click to upload CSV or Excel</p>
                                <p className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls</p>
                            </div>
                            <Input
                                id="csv-upload"
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={loading}
                                aria-label="Upload CSV or Excel file for customer import"
                            />
                        </div>
                    )}

                    {step === 'map' && (
                        <div className="space-y-4">
                            {/* Import Settings */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg mb-4">
                                <div className="space-y-2">
                                    <Label>Date Format</Label>
                                    <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as typeof dateFormat)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select date format" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (Start with Day)</SelectItem>
                                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 flex items-center pt-8">
                                    <input
                                        type="checkbox"
                                        id="empty-null"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus-visible:ring-primary mr-2"
                                        checked={treatEmptyAsNull}
                                        onChange={(e) => setTreatEmptyAsNull(e.target.checked)}
                                    />
                                    <Label htmlFor="empty-null" className="text-sm font-normal cursor-pointer">
                                        Treat empty cells as NULL
                                    </Label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 font-medium text-sm text-muted-foreground mb-2 px-2">
                                <div>System Field</div>
                                <div>File Header</div>
                            </div>
                            {SYSTEM_FIELDS.map((field) => (
                                <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                                    <div className="flex items-center gap-2">
                                        <span className={field.required ? "font-semibold" : ""}>{field.label}</span>
                                        {field.required && <span className="text-red-500">*</span>}
                                    </div>
                                    <Select
                                        value={mapping[field.key] || "ignore"}
                                        onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val === "ignore" ? "" : val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select column..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ignore" className="text-muted-foreground">-- Ignore --</SelectItem>
                                            {fileHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                            <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-md flex items-start gap-2 mt-4">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>
                                    <strong>Tip:</strong> Format <strong>Phone</strong> columns as "Text" in Excel to prevent lost leading zeros (e.g., 077...).
                                </span>
                            </div>

                            <div className="text-xs text-muted-foreground mt-4">
                                {rawRecords.length} records found.
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center space-y-4 h-full py-10">
                            <div className="w-full max-w-xs space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Progress</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">Processing records...</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 'map' && (
                        <Button variant="outline" onClick={() => setStep('upload')}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>
                    )}
                    {step !== 'importing' && (
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    )}

                    {step === 'map' && (
                        <Button onClick={handleImport} disabled={loading}>
                            Import Customers <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
