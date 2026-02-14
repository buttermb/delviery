import { logger } from '@/lib/logger';
import { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import Upload from "lucide-react/dist/esm/icons/upload";
import X from "lucide-react/dist/esm/icons/x";
import ImageIcon from "lucide-react/dist/esm/icons/image";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Star from "lucide-react/dist/esm/icons/star";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  validateImageDimensions,
  IMAGE_DIMENSION_CONSTRAINTS,
} from '@/lib/utils/validation';
import {
  validateFile,
  ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
} from '@/lib/fileValidation';

/**
 * Single image item in the uploader (exported for external use)
 */
export interface ImageItem {
  id: string;
  url: string;
  isMain: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
}

interface ProductImageUploaderProps {
  /**
   * Current main product image URL
   */
  mainImage?: string;
  /**
   * Array of additional image URLs
   */
  additionalImages?: string[];
  /**
   * Called when the main image changes
   */
  onMainImageChange: (url: string | undefined) => void;
  /**
   * Called when additional images change
   */
  onAdditionalImagesChange: (urls: string[]) => void;
  /**
   * Maximum number of additional images allowed
   */
  maxAdditionalImages?: number;
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
  /**
   * Custom class name
   */
  className?: string;
}

/**
 * ProductImageUploader - Drag-drop image upload component for products
 *
 * Features:
 * - Drag and drop support for single and multiple files
 * - Main image with overlay controls
 * - Additional images grid with reordering
 * - Image dimension validation (400x400 min, 4096x4096 max)
 * - File type validation (JPEG, PNG, WebP, GIF)
 * - Max file size: 10MB
 * - Upload progress indicators
 * - Set any image as main
 * - Remove images with confirmation
 */
export function ProductImageUploader({
  mainImage,
  additionalImages = [],
  onMainImageChange,
  onAdditionalImagesChange,
  maxAdditionalImages = 5,
  disabled = false,
  className,
}: ProductImageUploaderProps) {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  const hasMainImage = Boolean(mainImage);
  const canAddMoreImages = additionalImages.length < maxAdditionalImages;

  /**
   * Upload a single file to Supabase storage
   */
  const uploadFile = useCallback(
    async (file: File, isMain: boolean): Promise<string | null> => {
      const uploadId = `${file.name}-${Date.now()}`;

      try {
        // Validate file using security validation
        const fileValidation = await validateFile(file, {
          context: 'productImage',
          maxSize: FILE_SIZE_LIMITS.image,
          allowedTypes: [...ALLOWED_MIME_TYPES.productImage],
        });

        if (!fileValidation.isValid) {
          toast({
            title: 'Invalid file',
            description: fileValidation.error,
            variant: 'destructive',
          });
          return null;
        }

        // Validate image dimensions
        const dimensionResult = await validateImageDimensions(
          file,
          IMAGE_DIMENSION_CONSTRAINTS.productImage
        );

        if (!dimensionResult.valid) {
          toast({
            title: 'Invalid image dimensions',
            description: dimensionResult.error,
            variant: 'destructive',
          });
          return null;
        }

        logger.debug('Image validated', {
          width: dimensionResult.width,
          height: dimensionResult.height,
          size: file.size,
          component: 'ProductImageUploader',
        });

        // Start upload tracking
        setUploadingFiles((prev) => new Map(prev).set(uploadId, 0));

        // Generate unique filename
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        const fileName = `${timestamp}-${random}.${fileExt}`;
        const filePath = `product-images/${fileName}`;

        logger.debug('Uploading product image', {
          fileName,
          filePath,
          isMain,
          component: 'ProductImageUploader',
        });

        // Simulate progress (Supabase doesn't provide upload progress)
        const progressInterval = setInterval(() => {
          setUploadingFiles((prev) => {
            const current = prev.get(uploadId) || 0;
            if (current < 90) {
              const newMap = new Map(prev);
              newMap.set(uploadId, current + 10);
              return newMap;
            }
            return prev;
          });
        }, 200);

        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        clearInterval(progressInterval);

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(filePath);

        logger.debug('Product image uploaded successfully', {
          publicUrl,
          isMain,
          component: 'ProductImageUploader',
        });

        // Complete progress
        setUploadingFiles((prev) => {
          const newMap = new Map(prev);
          newMap.set(uploadId, 100);
          return newMap;
        });

        // Clean up progress after a short delay
        setTimeout(() => {
          setUploadingFiles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(uploadId);
            return newMap;
          });
        }, 500);

        return publicUrl;
      } catch (error) {
        logger.error(
          'Product image upload error',
          error instanceof Error ? error : new Error(String(error)),
          { component: 'ProductImageUploader' }
        );

        toast({
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
          variant: 'destructive',
        });

        // Clean up progress
        setUploadingFiles((prev) => {
          const newMap = new Map(prev);
          newMap.delete(uploadId);
          return newMap;
        });

        return null;
      }
    },
    [toast]
  );

  /**
   * Handle file selection from input or drag-drop
   */
  const handleFiles = useCallback(
    async (files: FileList | null, forceAdditional = false) => {
      if (!files || files.length === 0 || disabled) return;

      const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (fileArray.length === 0) {
        toast({
          title: 'Invalid files',
          description: 'Please select image files only',
          variant: 'destructive',
        });
        return;
      }

      // Process each file
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const isMain = !forceAdditional && !hasMainImage && i === 0;

        // Check if we can add more images
        if (!isMain && additionalImages.length >= maxAdditionalImages) {
          toast({
            title: 'Maximum images reached',
            description: `You can only upload ${maxAdditionalImages} additional images`,
            variant: 'destructive',
          });
          break;
        }

        const url = await uploadFile(file, isMain);

        if (url) {
          if (isMain) {
            onMainImageChange(url);
          } else {
            onAdditionalImagesChange([...additionalImages, url]);
          }
        }
      }
    },
    [
      disabled,
      hasMainImage,
      additionalImages,
      maxAdditionalImages,
      uploadFile,
      onMainImageChange,
      onAdditionalImagesChange,
      toast,
    ]
  );

  /**
   * Handle drag events
   */
  const handleDrag = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true);
      } else if (e.type === 'dragleave') {
        setDragActive(false);
      }
    },
    [disabled]
  );

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent, forceAdditional = false) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled) return;

      handleFiles(e.dataTransfer.files, forceAdditional);
    },
    [disabled, handleFiles]
  );

  /**
   * Remove the main image
   */
  const removeMainImage = useCallback(() => {
    onMainImageChange(undefined);
    toast({ title: 'Main image removed' });
  }, [onMainImageChange, toast]);

  /**
   * Remove an additional image by index
   */
  const removeAdditionalImage = useCallback(
    (index: number) => {
      const newImages = additionalImages.filter((_, i) => i !== index);
      onAdditionalImagesChange(newImages);
      toast({ title: 'Image removed' });
    },
    [additionalImages, onAdditionalImagesChange, toast]
  );

  /**
   * Set an additional image as the main image
   */
  const setAsMainImage = useCallback(
    (index: number) => {
      const newMainImage = additionalImages[index];
      const newAdditionalImages = [...additionalImages];
      newAdditionalImages.splice(index, 1);

      // If there was a main image, add it to additional images
      if (mainImage) {
        newAdditionalImages.unshift(mainImage);
      }

      onMainImageChange(newMainImage);
      onAdditionalImagesChange(newAdditionalImages);
      toast({ title: 'Main image updated' });
    },
    [mainImage, additionalImages, onMainImageChange, onAdditionalImagesChange, toast]
  );

  /**
   * Handle image reordering via drag and drop
   */
  const handleImageDragStart = useCallback((e: React.DragEvent, imageId: string) => {
    setDraggedImageId(imageId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleImageDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedImageId) return;

      const sourceIndex = additionalImages.findIndex((_, i) => `additional-${i}` === draggedImageId);
      if (sourceIndex === -1 || sourceIndex === targetIndex) {
        setDraggedImageId(null);
        return;
      }

      const newImages = [...additionalImages];
      const [movedImage] = newImages.splice(sourceIndex, 1);
      newImages.splice(targetIndex, 0, movedImage);

      onAdditionalImagesChange(newImages);
      setDraggedImageId(null);
    },
    [draggedImageId, additionalImages, onAdditionalImagesChange]
  );

  const isUploading = uploadingFiles.size > 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Main Image Upload Area */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Main Product Image</label>
          {hasMainImage && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              Primary display image
            </span>
          )}
        </div>

        <Card
          className={cn(
            'relative border-2 border-dashed transition-all duration-200 overflow-hidden',
            dragActive && !hasMainImage && 'border-primary bg-primary/5 scale-[1.01]',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && !hasMainImage && 'cursor-pointer hover:border-primary/50 hover:bg-muted/50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={(e) => handleDrop(e, false)}
          onClick={!hasMainImage && !disabled ? () => fileInputRef.current?.click() : undefined}
        >
          {hasMainImage ? (
            <div className="relative group">
              <img
                src={mainImage}
                alt="Main product image"
                className="w-full h-64 object-cover"
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={disabled || isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMainImage();
                  }}
                  disabled={disabled || isUploading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              {isUploading ? (
                <>
                  <Loader2 className="mx-auto h-12 w-12 text-primary mb-4 animate-spin" />
                  <p className="text-lg font-medium mb-2">Uploading...</p>
                  <Progress
                    value={Array.from(uploadingFiles.values())[0] || 0}
                    className="w-48 mx-auto"
                  />
                </>
              ) : (
                <>
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {dragActive ? 'Drop image here' : 'Drag & drop image here'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">or</p>
                  <Button type="button" variant="outline" disabled={disabled}>
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Min: 400×400px • Max: 4096×4096px • JPG, PNG, WebP • Max 10MB
                  </p>
                </>
              )}
            </div>
          )}
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, false);
            // Reset input to allow selecting the same file again
            e.target.value = '';
          }}
          disabled={disabled}
        />
      </div>

      {/* Additional Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Additional Images</label>
          <span className="text-xs text-muted-foreground">
            {additionalImages.length} / {maxAdditionalImages} images
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Drag to reorder • Click star to set as main image
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Existing additional images */}
          {additionalImages.map((img, index) => (
            <div
              key={`additional-${index}`}
              draggable
              onDragStart={(e) => handleImageDragStart(e, `additional-${index}`)}
              onDragOver={handleImageDragOver}
              onDrop={(e) => handleImageDrop(e, index)}
              className={cn(
                'relative group aspect-square rounded-lg overflow-hidden border-2 border-transparent transition-all',
                draggedImageId === `additional-${index}` && 'opacity-50 border-dashed border-primary'
              )}
            >
              <img
                src={img}
                alt={`Product image ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Drag handle indicator */}
              <div className="absolute top-1 left-1 p-1 rounded bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <GripVertical className="h-3 w-3 text-white" />
              </div>

              {/* Action buttons */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAsMainImage(index)}
                  disabled={disabled || isUploading}
                  title="Set as main image"
                >
                  <Star className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeAdditionalImage(index)}
                  disabled={disabled || isUploading}
                  title="Remove image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add more images button */}
          {canAddMoreImages && (
            <Card
              className={cn(
                'aspect-square flex items-center justify-center border-2 border-dashed transition-all cursor-pointer',
                dragActive && 'border-primary bg-primary/5',
                disabled && 'opacity-50 cursor-not-allowed',
                !disabled && 'hover:border-primary/50 hover:bg-muted/50'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, true)}
              onClick={!disabled ? () => additionalFileInputRef.current?.click() : undefined}
            >
              <div className="text-center p-2">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 mx-auto text-primary animate-spin" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Add</p>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        <input
          ref={additionalFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files, true);
            e.target.value = '';
          }}
          disabled={disabled}
        />
      </div>

      {/* Upload status message */}
      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading {uploadingFiles.size} file{uploadingFiles.size > 1 ? 's' : ''}...
        </div>
      )}

      {/* Help text */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium mb-1">Image guidelines</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Use high-quality product photos with good lighting</li>
            <li>Square images (1:1 ratio) work best for product cards</li>
            <li>The main image appears in search results and product listings</li>
            <li>Additional images show on the product detail page</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
