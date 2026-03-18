import { useState } from "react";
import { read, utils } from "xlsx";
import { logger } from "@/lib/logger";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, AlertCircle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { humanizeError } from "@/lib/humanizeError";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Label } from "@/components/ui/label";

interface ProductImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

type ImportStep = 'upload' | 'map' | 'importing';

const SYSTEM_FIELDS = [
    { key: 'name', label: 'Product Name', required: true },
    { key: 'sku', label: 'SKU', required: true },
    { key: 'category', label: 'Category', required: true },
    { key: 'wholesale_price', label: 'Wholesale Price', required: false },
    { key: 'retail_price', label: 'Retail Price', required: false },
    { key: 'available_quantity', label: 'Quantity', required: false },
    { key: 'description', label: 'Description', required: false },
];

export function ProductImportDialog({ open, onOpenChange, onSuccess }: ProductImportDialogProps) {
    const { tenant } = useTenantAdminAuth();
    const [step, setStep] = useState<ImportStep>('upload');
    const [_file, _setFile] = useState<File | null>(null);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Import Options
    const [decimalSeparator, setDecimalSeparator] = useState<'.' | ','>('.');
    const [encoding, setEncoding] = useState<string>('UTF-8');

    const [treatEmptyAsNull, setTreatEmptyAsNull] = useState(true);

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

        await parseFile(selectedFile);
    };

    const parseFile = async (file: File) => {
        setLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            // Using raw: false forces everything to strings as formatted in Excel, which is safer for SKUs
            // BUT, if Excel shows "1.23E+11", we get that string.
            // Using raw: true gets the number.
            // Best approach: Use raw values and custom logic.
            const workbook = read(buffer, { type: 'array', codepage: 65001 });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            // defval: "" ensures missing cells come as empty strings not undefined
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
        } finally {
            setLoading(false);
        }
    };

    const parseNumber = (value: unknown): number => {
        if (typeof value === 'number') return value;
        if (!value) return 0;
        let str = String(value).trim();
        if (decimalSeparator === ',') {
            // "10,50" -> "10.50"
            // Remove thousand separators if present? E.g. "1.000,50".
            // Simple approach: replace dots with nothing (thousands), comma with dot.
            // Assumption: European format 1.234,56
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            // US Format "1,234.56" -> remove commas
            str = str.replace(/,/g, '');
        }
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };

    const sanitizeSKU = (value: unknown): string => {
        if (value === null || value === undefined) return '';

        // Check for scientific notation in string representation
        const strVal = String(value);
        if (/^\d+(\.\d+)?[eE]\+\d+$/.test(strVal)) {
            // It looks like scientific notation "1.23E+12"
            // If the original value was a number, we might be able to expand it precisely depending on precision
            if (typeof value === 'number') {
                return value.toLocaleString('fullwide', { useGrouping: false });
            }
            // If it's a string from Excel, we might have lost precision already
        }
        return String(value).trim();
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

                // Sanitize SKU specifically
                if (normalized.sku !== undefined && normalized.sku !== null) {
                    const originalSku = normalized.sku;
                    normalized.sku = sanitizeSKU(originalSku);
                    if (normalized.sku !== String(originalSku).trim() && /e\+/i.test(String(originalSku))) {
                        // We detected and strictly converted sci notation, but let's warn if it looks suspicious
                        // e.g. "1.23E+10" -> "12300000000" (might be right)
                    }
                }

                // Check required fields (post-mapping)
                const missing = SYSTEM_FIELDS.filter(f => f.required && (normalized[f.key] === null || normalized[f.key] === undefined || normalized[f.key] === '')).map(f => f.label);
                if (missing.length > 0) {
                    invalidRecords.push({ row: index + 2, reason: `Missing: ${missing.join(', ')}`, data: record });
                    return;
                }

                // Category Validation
                const validCategories = ['flower', 'edibles', 'vapes', 'concentrates'];
                if (normalized.category && !validCategories.includes(String(normalized.category).toLowerCase())) {
                    // Try primitive fuzzy match or default?
                    // Let's force lowercase at least
                    normalized.category = String(normalized.category).toLowerCase();
                    if (!validCategories.includes(String(normalized.category))) {
                        invalidRecords.push({ row: index + 2, reason: `Invalid Category: ${normalized.category}. Must be one of: ${validCategories.join(', ')}`, data: record });
                        return;
                    }
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

                const { error } = await supabase.from('products').insert(
                    batch.map(record => ({
                        tenant_id: tenant.id,
                        name: String(record.name || ''),
                        sku: String(record.sku || ''),
                        category: String(record.category || ''),
                        wholesale_price: parseNumber(record.wholesale_price),
                        retail_price: parseNumber(record.retail_price),
                        available_quantity: parseNumber(record.available_quantity),
                        description: record.description || null,
                        total_quantity: parseNumber(record.available_quantity), // Default total to available
                        // Defaults
                        price: parseNumber(record.wholesale_price), // Map base price to wholesale
                        thc_percent: 0,
                        cbd_percent: 0,
                        thca_percentage: 0
                    }))
                );

                if (error) {
                    insertFailures += batch.length;
                    batch.forEach((r, batchIndex) => {
                        // Check for duplicate SKU
                        let reason = `Database Error: ${error.message}`;
                        if (error.code === '23505') reason = "Duplicate SKU or Barcode";
                        invalidRecords.push({ row: i + batchIndex + 2, reason, data: r });
                    });
                } else {
                    insertedCount += batch.length;
                }

                setProgress(Math.round(((i + batchSize) / validRecords.length) * 100));
            }

            if (insertFailures > 0 || invalidRecords.length > 0) {
                const message = `Import complete: ${insertedCount} imported. ${invalidRecords.length} validation/database errors.`;
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
                toast.success(`Successfully imported ${insertedCount} products`);
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
            logger.error('Import failed:', error instanceof Error ? error : new Error(String(error)), { component: 'ProductImportDialog' });
            toast.error(humanizeError(error, "Failed to import products"));
            setLoading(false);
        }
    };

    const resetState = () => {
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
                    <DialogTitle>Import Products</DialogTitle>
                    <DialogDescription>
                        {step === 'upload' ? 'Upload a CSV or Excel file containing your product catalog.' :
                            step === 'map' ? 'Map columns and configure settings.' :
                                'Importing products...'}
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
                                aria-label="Upload CSV or Excel file for product import"
                            />
                        </div>
                    )}

                    {step === 'map' && (
                        <div className="space-y-6">
                            {/* Import Settings */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                                <div className="space-y-2">
                                    <Label>Decimal Separator</Label>
                                    <Select value={decimalSeparator} onValueChange={(v) => setDecimalSeparator(v as typeof decimalSeparator)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select separator" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value=".">Dot (10.50)</SelectItem>
                                            <SelectItem value=",">Comma (10,50)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Data Encoding</Label>
                                    <Select value={encoding} onValueChange={setEncoding}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select encoding" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UTF-8">UTF-8 (Standard)</SelectItem>
                                            <SelectItem value="ISO-8859-1">Latin-1 (West European)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2 flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="empty-null"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus-visible:ring-primary"
                                        checked={treatEmptyAsNull}
                                        onChange={(e) => setTreatEmptyAsNull(e.target.checked)}
                                    />
                                    <Label htmlFor="empty-null" className="text-sm font-normal cursor-pointer">
                                        Treat empty cells as NULL (Clear existing values)
                                    </Label>
                                </div>

                                <div className="col-span-2 bg-blue-50 text-blue-800 text-xs p-3 rounded-md flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>
                                        <strong>Tip:</strong> Format <strong>SKU</strong> and <strong>Barcode</strong> columns as "Text" in Excel to prevent scientific notation (e.g., 1.23E+11) and lost leading zeros.
                                    </span>
                                </div>
                            </div>

                            {/* Mapping */}
                            <div className="space-y-4">
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
                            <p className="text-sm text-muted-foreground">Processing products...</p>
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
                            Import Products <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
