import { logger } from '@/lib/logger';
/**
 * Barcode Storage Utilities
 * Handles barcode image generation and storage in Supabase Storage
 */

import { supabase } from '@/integrations/supabase/client';

export interface BarcodeGenerationResult {
  barcode_url: string;
  sku: string;
  is_fallback?: boolean;
}

export interface BarcodeGenerationError {
  success: false;
  error: string;
  sku: string;
}

/**
 * Generate and store barcode image for a product
 * Returns the barcode URL or throws an error with details
 */
export async function generateAndStoreBarcode(
  sku: string,
  tenantId: string
): Promise<{ url: string; isFallback: boolean }> {
  // Call Edge Function to generate and store barcode
  const { data, error } = await supabase.functions.invoke<BarcodeGenerationResult>(
    'generate-product-barcode',
    {
      body: {
        sku,
        tenant_id: tenantId,
      },
    }
  );

  if (error) {
    logger.error('Barcode generation failed', error, {
      component: 'barcodeStorage',
      sku,
      tenantId,
    });
    throw new Error(`Barcode generation failed: ${error.message || 'Unknown error'}`);
  }

  // Check for error in response body (some edge functions return 200 with error)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    const errorMessage = typeof data.error === 'string' ? data.error : 'Barcode generation failed';
    logger.error('Barcode generation returned error in response', { error: errorMessage, sku, tenantId }, {
      component: 'barcodeStorage',
    });
    throw new Error(errorMessage);
  }

  if (!data?.barcode_url) {
    throw new Error('Barcode generation returned no URL');
  }

  return {
    url: data.barcode_url,
    isFallback: data.is_fallback || false,
  };
}

/**
 * Generate and store barcode - safe version that returns null on error
 * Use this when barcode is optional and shouldn't block the operation
 */
export async function generateAndStoreBarcodeOptional(
  sku: string,
  tenantId: string
): Promise<string> {
  try {
    const result = await generateAndStoreBarcode(sku, tenantId);
    return result.url;
  } catch (error) {
    logger.warn('Optional barcode generation failed, continuing without barcode', error, {
      component: 'barcodeStorage',
      sku,
      tenantId,
    });
    return '';
  }
}

/**
 * Get barcode URL from storage
 */
export function getBarcodeUrl(tenantId: string, sku: string): string {
  const bucketName = 'product-barcodes';
  const storagePath = `${tenantId}/barcodes/${sku}.png`;
  
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

/**
 * Delete barcode from storage
 */
export async function deleteBarcode(
  tenantId: string,
  sku: string
): Promise<void> {
  try {
    const bucketName = 'product-barcodes';
    const storagePath = `${tenantId}/barcodes/${sku}.png`;

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([storagePath]);

    if (error) {
      logger.error('Failed to delete barcode', error, {
        component: 'barcodeStorage',
        sku,
        tenantId,
      });
    }
  } catch (error) {
    logger.error('Barcode deletion error', error, {
      component: 'barcodeStorage',
    });
  }
}

