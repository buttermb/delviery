// @ts-nocheck - Quality control tests table types not yet regenerated
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
import { Loader2, Upload, FileText } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

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

  const uploadMutation = useMutation({
    mutationFn: async (data: {
      lab_name: string;
      test_date: string;
      test_results: any;
      coa_url?: string;
      compliance_status: string;
    }) => {
      const { error } = await supabase
        .from("inventory_batches")
        .update(data)
        .eq("id", batch.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.lists() });
      toast.success("COA uploaded and test results saved");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to upload COA', error, { component: 'COAUpload' });
      toast.error("Failed to upload COA");
    },
  });

  const handleFileUpload = async (file: File) => {
    if (!tenant?.id) {
      toast.error("Tenant ID required");
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${batch.batch_number}-coa-${Date.now()}.${fileExt}`;
      const filePath = `${tenant.id}/coas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, {
          cacheControl: "3600",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.lab_name || !formData.test_date) {
      toast.error("Lab name and test date are required");
      return;
    }

    let coaUrl: string | undefined;
    if (coaFile) {
      try {
        coaUrl = await handleFileUpload(coaFile);
      } catch (error) {
        toast.error("Failed to upload COA file");
        return;
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
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCoaFile(e.target.files?.[0] || null)}
                className="min-h-[44px] touch-manipulation"
              />
              {coaFile && (
                <FileText className="h-4 w-4 text-green-500" />
              )}
            </div>
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

