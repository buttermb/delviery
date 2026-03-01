import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import {
  validateImageDimensions,
  IMAGE_DIMENSION_CONSTRAINTS,
} from "@/lib/utils/validation";

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface ProductFormData {
  images?: string[];
  [key: string]: unknown;
}

interface ImagesStepProps {
  formData: ProductFormData;
  updateFormData: (data: Partial<ProductFormData>) => void;
}

export function ImagesStep({ formData, updateFormData }: ImagesStepProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [additionalPreviews, setAdditionalPreviews] = useState<string[]>([]);
  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (mainPreview && mainPreview.startsWith('blob:')) {
        URL.revokeObjectURL(mainPreview);
      }
      additionalPreviews.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only on unmount; refs to blob URLs are captured at unmount time
  }, []);

  const validateFileSize = useCallback((file: File): boolean => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`Maximum file size is ${MAX_FILE_SIZE_MB}MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return false;
    }
    return true;
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadImage = useCallback(async (file: File, isMain = false) => {
    // Client-side 2MB validation
    if (!validateFileSize(file)) return;

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    if (isMain) {
      setMainPreview(previewUrl);
    } else {
      setAdditionalPreviews((prev) => [...prev, previewUrl]);
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      // Validate image dimensions before upload
      const dimensionResult = await validateImageDimensions(
        file,
        IMAGE_DIMENSION_CONSTRAINTS.productImage
      );

      if (!dimensionResult.valid) {
        toast.error(dimensionResult.error || 'Invalid image dimensions');
        // Clean up preview on validation failure
        if (isMain) {
          URL.revokeObjectURL(previewUrl);
          setMainPreview(null);
        } else {
          setAdditionalPreviews((prev) => {
            const idx = prev.indexOf(previewUrl);
            if (idx >= 0) {
              URL.revokeObjectURL(previewUrl);
              return prev.filter((_, i) => i !== idx);
            }
            return prev;
          });
        }
        return;
      }

      setUploadProgress(30);

      logger.debug("Image dimensions validated", {
        width: dimensionResult.width,
        height: dimensionResult.height,
        component: 'ImagesStep'
      });

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      logger.debug("Uploading product image", { fileName, filePath, isMain, component: 'ImagesStep' });

      setUploadProgress(50);

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress(80);

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      logger.debug("Product image uploaded successfully", { publicUrl, isMain, component: 'ImagesStep' });

      setUploadProgress(100);

      // Update form data — replace preview with actual URL
      if (isMain) {
        URL.revokeObjectURL(previewUrl);
        setMainPreview(null);
        updateFormData({ image_url: publicUrl });
      } else {
        setAdditionalPreviews((prev) => {
          const idx = prev.indexOf(previewUrl);
          if (idx >= 0) {
            URL.revokeObjectURL(previewUrl);
            return prev.filter((_, i) => i !== idx);
          }
          return prev;
        });
        const currentImages = formData.images ?? [];
        updateFormData({ images: [...currentImages, publicUrl] });
      }

      toast.success('Image uploaded successfully');
    } catch (error: unknown) {
      logger.error("Product image upload error", error instanceof Error ? error : new Error(String(error)), { component: 'ImagesStep' });
      // Clean up preview on error
      if (isMain) {
        URL.revokeObjectURL(previewUrl);
        setMainPreview(null);
      } else {
        setAdditionalPreviews((prev) => {
          const idx = prev.indexOf(previewUrl);
          if (idx >= 0) {
            URL.revokeObjectURL(previewUrl);
            return prev.filter((_, i) => i !== idx);
          }
          return prev;
        });
      }
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  }, [formData.images, updateFormData, validateFileSize]);

  const handleDrop = useCallback(
    (e: React.DragEvent, isMain = false) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        uploadImage(files[0], isMain);
      }
    },
    [uploadImage]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isMain = false) => {
    const files = e.target.files;
    if (files && files[0]) {
      uploadImage(files[0], isMain);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const removeMainImage = () => {
    if (mainPreview) {
      URL.revokeObjectURL(mainPreview);
      setMainPreview(null);
    }
    updateFormData({ image_url: "" });
  };

  const removeImage = (index: number) => {
    const currentImages = formData.images ?? [];
    updateFormData({ images: currentImages.filter((_, i: number) => i !== index) });
  };

  // Display URL: prefer local preview during upload, then saved URL
  const mainDisplayUrl = mainPreview || (formData.image_url as string);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Product Images</h2>
        <p className="text-muted-foreground">
          Upload high-quality images of your product
        </p>
      </div>

      {/* Main Image */}
      <div>
        <Label>Main Product Image *</Label>
        <Card
          className={`mt-3 border-2 border-dashed transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={(e) => handleDrop(e, true)}
        >
          {mainDisplayUrl ? (
            <div className="relative group">
              <img
                src={mainDisplayUrl}
                alt="Main product image"
                className="w-full h-64 object-cover rounded-lg"
                loading="lazy"
              />
              {uploading && mainPreview && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3 rounded-lg" role="presentation">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                  <Progress value={uploadProgress} className="w-48" />
                  <span className="text-sm text-white">Uploading... {uploadProgress}%</span>
                </div>
              )}
              {(!uploading || !mainPreview) && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" role="presentation">
                  <Button
                    type="button"
                    onClick={removeMainImage}
                    variant="destructive"
                    size="sm"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center">
              {uploading ? (
                <>
                  <Loader2 className="mx-auto h-12 w-12 text-primary mb-4 animate-spin" />
                  <p className="text-lg font-medium mb-2">Uploading...</p>
                  <Progress value={uploadProgress} className="w-48 mx-auto" />
                </>
              ) : (
                <>
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Drag & Drop Image Here</p>
                  <p className="text-sm text-muted-foreground mb-4">or</p>
                  <label htmlFor="main-image">
                    <Button variant="outline" disabled={uploading} asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Browse Files
                      </span>
                    </Button>
                  </label>
                  <input
                    id="main-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, true)}
                  />
                  <p className="text-xs text-muted-foreground mt-4">
                    Min: 400x400px, Max: 4096x4096px, JPG/PNG/WebP, Max {MAX_FILE_SIZE_MB}MB
                  </p>
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Additional Images */}
      <div>
        <Label>Additional Images (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Upload up to 5 additional product photos
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {formData.images?.map((img: string, index: number) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={img}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove image ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {/* Show uploading previews for additional images */}
          {additionalPreviews.map((previewUrl, index) => (
            <div key={`preview-${index}`} className="relative aspect-square">
              <img
                src={previewUrl}
                alt={`Uploading ${index + 1}`}
                className="w-full h-full object-cover rounded-lg opacity-60"
                loading="lazy"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <Progress value={uploadProgress} className="w-3/4 h-1.5" />
              </div>
            </div>
          ))}
          {(formData.images?.length ?? 0) + additionalPreviews.length < 5 && (
            <label htmlFor="additional-images">
              <Card className="aspect-square flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors border-2 border-dashed">
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Add</p>
                </div>
              </Card>
              <input
                id="additional-images"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, false)}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
