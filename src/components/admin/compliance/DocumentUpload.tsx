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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, AlertCircle } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { validateFile, generateSecureStoragePath, FILE_SIZE_LIMITS, formatFileSize } from "@/lib/fileValidation";

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DocumentUpload({
  open,
  onOpenChange,
  onSuccess,
}: DocumentUploadProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    document_type: "license",
    expiration_date: "",
    file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      document_type: string;
      expiration_date: string | null;
      file: File;
    }) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      setUploading(true);
      let fileUrl: string | null = null;

      try {
        // Upload file to Supabase Storage with secure path
        if (data.file) {
          const storagePath = generateSecureStoragePath(
            data.file.name,
            'compliance',
            tenant.id
          );

          const { error: uploadError } = await supabase.storage
            .from("compliance-documents")
            .upload(storagePath, data.file, {
              contentType: data.file.type,
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("compliance-documents")
            .getPublicUrl(storagePath);
          fileUrl = urlData.publicUrl;
        }

        // Save document record
        const { error } = await supabase.from("compliance_documents").insert([
          {
            tenant_id: tenant.id,
            name: data.name,
            document_type: data.document_type,
            file_url: fileUrl,
            expiration_date: data.expiration_date || null,
            status: "active",
            created_by: admin?.id || null,
          },
        ]);

        if (error && error.code !== "42P01") throw error;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code !== "42P01") throw error;
        logger.warn('Compliance documents table does not exist yet', { component: 'DocumentUpload' });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.compliance.documents() });
      toast.success("Document uploaded successfully");
      onOpenChange(false);
      setFormData({
        name: "",
        document_type: "license",
        expiration_date: "",
        file: null,
      });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to upload document', error, { component: 'DocumentUpload' });
      toast.error("Failed to upload document");
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFileError(null);

    if (file) {
      // Validate the file before accepting it
      const validation = await validateFile(file, {
        context: 'complianceDocument',
        maxSize: FILE_SIZE_LIMITS.document,
      });

      if (!validation.isValid) {
        setFileError(validation.error || 'Invalid file');
        e.target.value = '';
        toast.error(validation.error || 'Invalid file');
        return;
      }
    }

    setFormData({ ...formData, file });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.file) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Double-check file validation before upload
    const validation = await validateFile(formData.file, {
      context: 'complianceDocument',
      maxSize: FILE_SIZE_LIMITS.document,
    });

    if (!validation.isValid) {
      setFileError(validation.error || 'Invalid file');
      toast.error(validation.error || 'Invalid file');
      return;
    }

    await uploadMutation.mutateAsync({
      name: formData.name,
      document_type: formData.document_type,
      expiration_date: formData.expiration_date || null,
      file: formData.file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Compliance Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Document Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., State License 2024"
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document_type">Document Type</Label>
            <Select
              value={formData.document_type}
              onValueChange={(value) =>
                setFormData({ ...formData, document_type: value })
              }
            >
              <SelectTrigger className="min-h-[44px] touch-manipulation">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="license">License</SelectItem>
                <SelectItem value="permit">Permit</SelectItem>
                <SelectItem value="certificate">Certificate</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">
              File <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
                required
                className="min-h-[44px] touch-manipulation"
              />
              {fileError && <AlertCircle className="h-4 w-4 text-destructive" />}
            </div>
            {fileError && (
              <p className="text-sm text-destructive">{fileError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              PDF, JPEG, or PNG. Max {formatFileSize(FILE_SIZE_LIMITS.document)}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration_date">Expiration Date (Optional)</Label>
            <Input
              id="expiration_date"
              type="date"
              value={formData.expiration_date}
              onChange={(e) =>
                setFormData({ ...formData, expiration_date: e.target.value })
              }
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading || uploadMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || uploadMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              {(uploading || uploadMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

