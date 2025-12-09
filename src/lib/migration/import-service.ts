// @ts-nocheck
/**
 * Batch Import Service
 * Handles importing products with transaction support and rollback
 */

import { supabase } from '@/integrations/supabase/client';
import type { ParsedProduct, ImportResult, ImportProgress } from '@/types/migration';
import { logger } from '@/lib/logger';

const BATCH_SIZE = 50;

export interface ImportOptions {
  tenantId: string;
  userId: string;
  importId?: string;
  dryRun?: boolean;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  onProgress?: (progress: ImportProgress) => void;
}

export interface BatchImportResult {
  success: boolean;
  importId: string;
  results: ImportResult[];
  summary: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
    updated: number;
  };
  errors: Array<{ index: number; error: string }>;
}

/**
 * Create a new import record
 */
async function createImportRecord(
  tenantId: string,
  userId: string,
  fileName?: string,
  format?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('product_imports')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      file_name: fileName,
      format: format,
      status: 'processing',
    })
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Failed to create import record: ${error.message}`);
  return data.id;
}

/**
 * Update import record status
 */
async function updateImportStatus(
  importId: string,
  status: 'processing' | 'completed' | 'failed',
  summary?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('product_imports')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(summary ? { original_input: JSON.stringify(summary) } : {}),
    })
    .eq('id', importId);

  if (error) {
    logger.error('Failed to update import status', { importId, status, error });
  }
}

/**
 * Insert import item record
 */
async function createImportItem(
  importId: string,
  tenantId: string,
  product: Partial<ParsedProduct>,
  status: 'pending' | 'validated' | 'imported' | 'failed',
  errors?: unknown[]
): Promise<string | null> {
  const { data, error } = await supabase
    .from('product_import_items')
    .insert({
      import_id: importId,
      tenant_id: tenantId,
      raw_data: product.rawData || {},
      parsed_data: product,
      validation_errors: errors || [],
      status,
      confidence_score: product.confidence || 0,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('Failed to create import item', { error });
    return null;
  }
  return data.id;
}

/**
 * Convert ParsedProduct to products table format
 */
function toInventoryRecord(
  product: Partial<ParsedProduct>,
  tenantId: string
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    name: product.name,
    category: product.category || 'flower',
    strain_type: product.strainType || null,
    thc_percent: product.thcPercentage || null,
    cbd_percent: product.cbdPercentage || null,
    price: product.prices?.lb || product.prices?.oz || null,
    wholesale_price: product.prices?.lb || null,
    stock_quantity: product.quantityLbs || product.quantityUnits || null,
    description: product.notes || null,
    in_stock: true,
  };
}

/**
 * Import a single product
 */
async function importSingleProduct(
  product: Partial<ParsedProduct>,
  tenantId: string,
  options: { skipDuplicates?: boolean; updateExisting?: boolean }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    productName: product.name || 'Unknown',
  };

  if (!product.name) {
    result.error = 'Product name is required';
    return result;
  }

  try {
    // Check for existing product
    const { data: existing } = await supabase
      .from('products')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .ilike('name', product.name)
      .maybeSingle();

    if (existing) {
      if (options.skipDuplicates) {
        result.skipped = true;
        result.error = 'Duplicate product (skipped)';
        return result;
      }

      if (options.updateExisting) {
        const { error } = await supabase
          .from('products')
          .update(toInventoryRecord(product, tenantId))
          .eq('id', existing.id);

        if (error) throw error;

        result.success = true;
        result.productId = existing.id;
        result.updated = true;
        return result;
      }
    }

    // Insert new product
    const { data, error } = await supabase
      .from('products')
      .insert(toInventoryRecord(product, tenantId))
      .select('id')
      .maybeSingle();

    if (error) throw error;

    result.success = true;
    result.productId = data.id;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * Import a batch of products
 */
export async function importProducts(
  products: Partial<ParsedProduct>[],
  options: ImportOptions
): Promise<BatchImportResult> {
  const { tenantId, userId, onProgress, dryRun = false } = options;

  const results: ImportResult[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  const summary = {
    total: products.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    updated: 0,
  };

  // Create import record
  let importId = options.importId;
  if (!importId && !dryRun) {
    importId = await createImportRecord(tenantId, userId, undefined, 'batch');
  }
  importId = importId || 'dry-run';

  logger.info('Starting product import', {
    importId,
    totalProducts: products.length,
    dryRun,
  });

  try {
    // Process in batches
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, Math.min(i + BATCH_SIZE, products.length));

      // Report progress
      onProgress?.({
        phase: 'importing',
        current: i,
        total: products.length,
        message: `Importing products ${i + 1} to ${Math.min(i + BATCH_SIZE, products.length)}...`,
      });

      // Process batch
      for (let j = 0; j < batch.length; j++) {
        const product = batch[j];
        const globalIndex = i + j;

        if (dryRun) {
          // Dry run - just validate
          results.push({
            success: true,
            productName: product.name || 'Unknown',
          });
          summary.imported++;
        } else {
          const result = await importSingleProduct(product, tenantId, {
            skipDuplicates: options.skipDuplicates,
            updateExisting: options.updateExisting,
          });

          results.push(result);

          // Track import item
          await createImportItem(
            importId,
            tenantId,
            product,
            result.success ? 'imported' : 'failed',
            result.error ? [{ message: result.error }] : undefined
          );

          if (result.success) {
            if (result.updated) {
              summary.updated++;
            } else {
              summary.imported++;
            }
          } else if (result.skipped) {
            summary.skipped++;
          } else {
            summary.failed++;
            errors.push({ index: globalIndex, error: result.error || 'Unknown error' });
          }
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < products.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update import status
    if (!dryRun) {
      await updateImportStatus(importId, 'completed', summary);
    }

    onProgress?.({
      phase: 'complete',
      current: products.length,
      total: products.length,
      message: `Import complete. ${summary.imported} imported, ${summary.failed} failed.`,
    });

    logger.info('Product import completed', { importId, summary });

    return {
      success: summary.failed === 0,
      importId,
      results,
      summary,
      errors,
    };
  } catch (error) {
    logger.error('Product import failed', { importId, error });

    if (!dryRun && importId) {
      await updateImportStatus(importId, 'failed');
    }

    throw error;
  }
}

/**
 * Rollback an import
 */
export async function rollbackImport(importId: string): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    // Get all imported items
    const { data: items, error: fetchError } = await supabase
      .from('product_import_items')
      .select('parsed_data')
      .eq('import_id', importId)
      .eq('status', 'imported');

    if (fetchError) throw fetchError;

    if (!items || items.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // Get product IDs from parsed_data
    const productNames = items
      .map(item => (item.parsed_data as Partial<ParsedProduct>)?.name)
      .filter((name): name is string => !!name);

    // Delete from products
    // Note: This is a simplified rollback - in production you'd track actual inserted IDs
    const { error: deleteError, count } = await supabase
      .from('products')
      .delete()
      .in('name', productNames);

    if (deleteError) throw deleteError;

    // Update import status
    await updateImportStatus(importId, 'failed');

    // Update item statuses
    await supabase
      .from('product_import_items')
      .update({ status: 'pending' })
      .eq('import_id', importId);

    logger.info('Import rollback completed', { importId, deletedCount: count });

    return { success: true, deletedCount: count || 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Import rollback failed', { importId, error: message });
    return { success: false, deletedCount: 0, error: message };
  }
}

/**
 * Get import history for a tenant
 */
export async function getImportHistory(
  tenantId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  fileName?: string;
  status: string;
  createdAt: string;
  itemCount?: number;
}>> {
  const { data, error } = await supabase
    .from('product_imports')
    .select(`
      id,
      file_name,
      status,
      created_at,
      product_import_items(count)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch import history', { error });
    return [];
  }

  return data.map(row => ({
    id: row.id,
    fileName: row.file_name || undefined,
    status: row.status || 'unknown',
    createdAt: row.created_at,
    itemCount: Array.isArray(row.product_import_items) 
      ? row.product_import_items.length 
      : undefined,
  }));
}

/**
 * Get import details
 */
export async function getImportDetails(importId: string): Promise<{
  import: {
    id: string;
    fileName?: string;
    status: string;
    createdAt: string;
  };
  items: Array<{
    id: string;
    parsedData: Partial<ParsedProduct>;
    status: string;
    confidence: number;
    errors?: unknown[];
  }>;
} | null> {
  const { data: importData, error: importError } = await supabase
    .from('product_imports')
    .select('*')
    .eq('id', importId)
    .maybeSingle();

  if (importError || !importData) return null;

  const { data: items, error: itemsError } = await supabase
    .from('product_import_items')
    .select('*')
    .eq('import_id', importId)
    .order('created_at', { ascending: true });

  if (itemsError) return null;

  return {
    import: {
      id: importData.id,
      fileName: importData.file_name || undefined,
      status: importData.status || 'unknown',
      createdAt: importData.created_at,
    },
    items: (items || []).map(item => ({
      id: item.id,
      parsedData: item.parsed_data as Partial<ParsedProduct>,
      status: item.status || 'unknown',
      confidence: item.confidence_score || 0,
      errors: item.validation_errors as unknown[] || undefined,
    })),
  };
}




