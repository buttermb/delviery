/**
 * Complete Image Processing System
 * Handles upload, optimization, watermarking, and multiple sizes
 */

import { supabase } from '@/integrations/supabase/client';

export interface ImageSizes {
  thumb: string;   // 200x200
  medium: string;  // 400x400
  large: string;  // 800x800
  full: string;   // 1200x1200
}

export interface ImageUploadResult {
  id: string;
  sizes: ImageSizes;
  dimensions: { width: number; height: number };
  optimized_size_bytes: number;
  original_size_bytes: number;
}

/**
 * Upload and process product image with multiple sizes
 */
export async function uploadProductImage(
  file: File,
  productId: string,
  isPrimary: boolean = false,
  imageOrder: number = 0
): Promise<ImageUploadResult> {
  const originalSize = file.size;
  
  // Create unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  // Upload original to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(`originals/${fileName}`, file, {
      contentType: file.type,
      cacheControl: '3600',
    });

  if (uploadError) throw uploadError;

  // Get original URL
  const { data: { publicUrl: originalUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(`originals/${fileName}`);

  // Process image through edge function for optimization
  const { data: processedData, error: processError } = await supabase.functions.invoke('process-product-image', {
    body: {
      original_url: originalUrl,
      product_id: productId,
      file_name: fileName,
    },
  });

  if (processError) {
    console.error('Image processing error:', processError);
    // Fallback: use original URL for all sizes
    const fallbackSizes: ImageSizes = {
      thumb: originalUrl,
      medium: originalUrl,
      large: originalUrl,
      full: originalUrl,
    };
    
    return {
      id: '', // Will be created after insert
      sizes: fallbackSizes,
      dimensions: { width: 0, height: 0 },
      optimized_size_bytes: originalSize,
      original_size_bytes: originalSize,
    };
  }

  // Create image record in database
  const { data: imageData, error: imageError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      is_primary: isPrimary,
      image_order: imageOrder,
      original_filename: file.name,
      file_path: fileName,
      sizes: processedData?.sizes || {},
      original_size_bytes: originalSize,
      optimized_size_bytes: processedData?.optimized_size || originalSize,
      dimensions: processedData?.dimensions || { width: 0, height: 0 },
    })
    .select()
    .single();

  if (imageError) throw imageError;

  return {
    id: imageData.id,
    sizes: processedData?.sizes || {
      thumb: originalUrl,
      medium: originalUrl,
      large: originalUrl,
      full: originalUrl,
    },
    dimensions: processedData?.dimensions || { width: 0, height: 0 },
    optimized_size_bytes: processedData?.optimized_size || originalSize,
    original_size_bytes: originalSize,
  };
}

/**
 * Get optimized image URL for a specific size
 */
export function getProductImageUrl(
  image: { sizes?: ImageSizes; file_path?: string },
  size: keyof ImageSizes = 'medium'
): string {
  // If sizes object exists, use it
  if (image.sizes && image.sizes[size]) {
    return image.sizes[size];
  }
  
  // Fallback to file_path with size prefix
  if (image.file_path) {
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(`${size}/${image.file_path}`);
    return publicUrl;
  }
  
  return '';
}

/**
 * Set primary image (ensures only one primary)
 */
export async function setPrimaryProductImage(
  productId: string,
  imageId: string
): Promise<void> {
  // Use database function to ensure only one primary
  const { error } = await supabase.rpc('set_primary_product_image', {
    p_product_id: productId,
    p_image_id: imageId,
  });

  if (error) throw error;
}

/**
 * Reorder product images
 */
export async function reorderProductImages(
  productId: string,
  imageIds: string[]
): Promise<void> {
  const updates = imageIds.map((id, index) => ({
    id,
    image_order: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('product_images')
      .update({ image_order: update.image_order })
      .eq('id', update.id)
      .eq('product_id', productId);

    if (error) throw error;
  }
}

/**
 * Delete product image
 */
export async function deleteProductImage(imageId: string): Promise<void> {
  // Get image record first
  const { data: image, error: fetchError } = await supabase
    .from('product_images')
    .select('file_path, sizes')
    .eq('id', imageId)
    .single();

  if (fetchError) throw fetchError;

  // Delete from storage (all sizes)
  if (image.file_path) {
    const sizes = ['originals', 'thumb', 'medium', 'large', 'full'];
    for (const size of sizes) {
      await supabase.storage
        .from('product-images')
        .remove([`${size}/${image.file_path}`]);
    }
  }

  // Delete database record
  const { error } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId);

  if (error) throw error;
}

