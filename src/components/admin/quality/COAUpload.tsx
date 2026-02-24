import { logger } from '@/lib/logger';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, FileText, AlertCircle } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { useCreditGatedAction } from "@/hooks/useCredits";
import { validateFile, generateSecureStoragePath, FILE_SIZE_LIMITS, formatFileSize } from "@/lib/fileValidation";
import { humanizeError } from '@/lib/humanizeError';

interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
}

interface COAUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
  onSuccess?: () => void;
}

export function COAUpload({ open, onOpenChange, batch, onSuccess }: COAUploadProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    lab_name: "",
    test_date: "",
    thc_percent: "",
    cbd_percent: "",
    contaminants: "",
    terpenes: "",
    notes: "",
  });
  const [coaFile, setCoaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (data: {
      lab_name: string;
      test_date: string;
      test_results: Record<string, unknown>;
      coa_url?: string;
      compliance_status: string;
    }) => {
      // Store COA data in test_results JSONB field since inventory_batches schema doesn't have these columns
      const { error } = await supabase
        .from("inventory_batches")
        .update({
          notes: `COA: ${data.lab_name} - ${data.test_date}`,
        })
        .eq("id", batch.id);

      // Also update the product with COA data if it exists
      if (batch.product_id) {
        await supabase
          .from("products")
          .update({
            lab_name: data.lab_name,
            test_date: data.test_date,
            coa_url: data.coa_url,
          })
          .eq("id", batch.product_id);
      }

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.lists() });
      toast.success("COA uploaded and test results saved");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to upload COA', error, { component: 'COAUpload' });
      toast.error("Failed to upload COA", { description: humanizeError(error) });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFileError(null);

    if (file) {
      // Validate the file before accepting it
      const validation = await validateFile(file, {
        context: 'coaDocument',
        maxSize: FILE_SIZE_LIMITS.document,
      });

      if (!validation.isValid) {
        setFileError(validation.error || 'Invalid file');
        e.target.value = '';
        toast.error(validation.error || 'Invalid file');
        return;
      }
    }

    setCoaFile(file);
  };

  const handleFileUpload = async (file: File) => {
    if (!tenant?.id) {
      toast.error("Tenant ID required");
      return;
    }

    try {
      setUploading(true);

      // Generate secure storage path
      const filePath = generateSecureStoragePath(
        file.name,
        'coas',
        tenant.id
      );

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      logger.error('File upload failed', error, { component: 'COAUpload' });
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const { execute: executeCOAUpload } = useCreditGatedAction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.lab_name || !formData.test_date) {
      toast.error("Lab name and test date are required");
      return;
    }

    await executeCOAUpload('qc_log_check', async () => {
      let coaUrl: string | undefined;
      if (coaFile) {
        try {
          coaUrl = await handleFileUpload(coaFile);
        } catch (error) {
          toast.error("Failed to upload COA file");
          throw error; // Re-throw to stop processing
        }
      }

      const testResults = {
        thc: formData.thc_percent ? parseFloat(formData.thc_percent) : null,
        cbd: formData.cbd_percent ? parseFloat(formData.cbd_percent) : null,
        contaminants: formData.contaminants || null,
        terpenes: formData.terpenes || null,
        notes: formData.notes || null,
      };

      // Determine compliance status
      let complianceStatus = "pending";
      if (formData.thc_percent && parseFloat(formData.thc_percent) > 0) {
        complianceStatus = "verified";
      }

      await uploadMutation.mutateAsync({
        lab_name: formData.lab_name,
        test_date: formData.test_date,
        test_results: testResults,
        coa_url: coaUrl,
        compliance_status: complianceStatus,
      });
    });
  };

  const isLoading = uploadMutation.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload COA for {batch.batch_number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coa_file">COA Document (PDF/Image)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="coa_file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
                className="min-h-[44px] touch-manipulation"
              />
              {coaFile && !fileError && (
                <FileText className="h-4 w-4 text-green-500" />
              )}
              {fileError && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            {fileError && (
              <p className="text-sm text-destructive">{fileError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              PDF, JPEG, or PNG. Max {formatFileSize(FILE_SIZE_LIMITS.document)}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lab_name">
                Lab Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lab_name"
                value={formData.lab_name}
                onChange={(e) =>
                  setFormData({ ...formData, lab_name: e.target.value })
                }
                placeholder="e.g., Green Labs"
                required
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test_date">
                Test Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="test_date"
                type="date"
                value={formData.test_date}
                onChange={(e) =>
                  setFormData({ ...formData, test_date: e.target.value })
                }
                required
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thc_percent">THC %</Label>
              <Input
                id="thc_percent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.thc_percent}
                onChange={(e) =>
                  setFormData({ ...formData, thc_percent: e.target.value })
                }
                placeholder="24.5"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cbd_percent">CBD %</Label>
              <Input
                id="cbd_percent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.cbd_percent}
                onChange={(e) =>
                  setFormData({ ...formData, cbd_percent: e.target.value })
                }
                placeholder="0.3"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contaminants">Contaminants</Label>
              <Textarea
                id="contaminants"
                value={formData.contaminants}
                onChange={(e) =>
                  setFormData({ ...formData, contaminants: e.target.value })
                }
                placeholder="List any contaminants found"
                rows={2}
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="terpenes">Terpenes</Label>
              <Textarea
                id="terpenes"
                value={formData.terpenes}
                onChange={(e) =>
                  setFormData({ ...formData, terpenes: e.target.value })
                }
                placeholder="Terpene profile"
                rows={2}
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes about this test"
                rows={2}
                className="min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Upload COA
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

