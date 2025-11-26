import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

interface CustomerImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CustomerImportDialog({ open, onOpenChange, onSuccess }: CustomerImportDialogProps) {
    const { tenant } = useTenantAdminAuth();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
                toast.error("Please upload a CSV file");
                return;
            }
            setFile(selectedFile);
        }
    };

    const parseCSV = (text: string) => {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const requiredFields = ['first_name', 'last_name', 'email'];
        const missingFields = requiredFields.filter(field => !headers.includes(field));

        if (missingFields.length > 0) {
            throw new Error(`Missing required columns: ${missingFields.join(', ')}`);
        }

        return lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',');
            const entry: Record<string, string> = {};
            headers.forEach((header, index) => {
                entry[header] = values[index]?.trim() || '';
            });
            return entry;
        });
    };

    const handleImport = async () => {
        if (!file || !tenant?.id) return;

        setLoading(true);
        setProgress(0);

        try {
            const text = await file.text();
            const records = parseCSV(text);

            if (records.length === 0) {
                throw new Error("No records found in CSV");
            }

            // Process in batches of 10
            const batchSize = 10;
            let processed = 0;

            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);

                const { error } = await supabase.from('customers').insert(
                    batch.map(record => ({
                        tenant_id: tenant.id,
                        first_name: record.first_name,
                        last_name: record.last_name,
                        email: record.email || null,
                        phone: record.phone || null,
                        customer_type: record.customer_type || 'retail',
                        status: 'active',
                        total_spent: 0,
                        loyalty_points: 0,
                        loyalty_tier: 'bronze'
                    }))
                );

                if (error) throw error;

                processed += batch.length;
                setProgress(Math.round((processed / records.length) * 100));
            }

            toast.success(`Successfully imported ${records.length} customers`);
            onSuccess?.();
            onOpenChange(false);
            setFile(null);
            setProgress(0);
        } catch (error) {
            console.error('Import failed:', error);
            toast.error(error instanceof Error ? error.message : "Failed to import customers");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Customers</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with columns: first_name, last_name, email, phone (optional), customer_type (optional).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('csv-upload')?.click()}>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <div className="text-center">
                            <p className="text-sm font-medium">
                                {file ? file.name : "Click to upload CSV"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {file ? `${(file.size / 1024).toFixed(1)} KB` : "CSV files only"}
                            </p>
                        </div>
                        <Input
                            id="csv-upload"
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>

                    {loading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Importing...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">Required Columns:</p>
                        <p>first_name, last_name, email</p>
                        <p className="font-medium text-foreground mt-2">Optional Columns:</p>
                        <p>phone, customer_type (retail/wholesale)</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={!file || loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Import Customers
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
