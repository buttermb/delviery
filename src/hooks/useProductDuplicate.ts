import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { logActivity, EntityType } from '@/lib/activityLog';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

/**
 * Generates a unique SKU for the duplicated product.
 * Takes the original SKU and appends "-COPY" or "-COPY-{n}" if copies already exist.
 */
function generateDuplicateSku(originalSku: string | null): string {
  if (!originalSku) {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `COPY-${timestamp}`;
  }

  const copyPattern = /-COPY(-\d+)?$/;
  const baseSku = originalSku.replace(copyPattern, '');

  return `${baseSku}-COPY`;
}

/**
 * Checks if a SKU already exists for the tenant and returns a unique one.
 */
async function ensureUniqueSku(
  baseSku: string,
  tenantId: string
): Promise<string> {
  let candidateSku = baseSku;
  let counter = 1;
  const maxAttempts = 100;

  while (counter <= maxAttempts) {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('sku', candidateSku)
      .maybeSingle();

    if (error) {
      logger.error('Error checking SKU uniqueness', { error: error.message, sku: candidateSku });
      throw error;
    }

    if (!data) {
      return candidateSku;
    }

    const baseSkuWithoutCounter = baseSku.replace(/-\d+$/, '');
    candidateSku = `${baseSkuWithoutCounter}-${counter}`;
    counter++;
  }

  const timestamp = Date.now().toString(36).toUpperCase();
  return `${baseSku}-${timestamp}`;
}

interface UseProductDuplicateOptions {
  onSuccess?: (newProduct: Product) => void;
}

export function useProductDuplicate(options?: UseProductDuplicateOptions) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const duplicateMutation = useMutation({
    mutationFn: async (product: Product) => {
      if (!tenant?.id) {
        throw new Error('Tenant not found');
      }

      if (!admin?.userId) {
        throw new Error('User not found');
      }

      const baseSku = generateDuplicateSku(product.sku);
      const uniqueSku = await ensureUniqueSku(baseSku, tenant.id);

      const duplicateData = {
        tenant_id: tenant.id,
        name: `${product.name} (Copy)`,
        sku: uniqueSku,
        category: product.category,
        vendor_name: product.vendor_name,
        strain_name: product.strain_name,
        strain_type: product.strain_type,
        thc_percent: product.thc_percent,
        cbd_percent: product.cbd_percent,
        batch_number: null,
        cost_per_unit: product.cost_per_unit,
        wholesale_price: product.wholesale_price,
        retail_price: product.retail_price,
        available_quantity: 0,
        description: product.description,
        image_url: product.image_url,
        low_stock_alert: product.low_stock_alert,
        price: product.price,
        thca_percentage: product.thca_percentage,
        fronted_quantity: 0,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('products')
        .insert(duplicateData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to duplicate product', { error: error.message, productId: product.id });
        throw error;
      }

      // Log duplication to activity_log
      await logActivity(
        tenant.id,
        admin.userId,
        'created',
        EntityType.PRODUCT,
        data.id,
        {
          action: 'duplicated',
          source_product_id: product.id,
          source_product_name: product.name,
          new_product_name: data.name,
          new_sku: data.sku,
        }
      );

      return data;
    },
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      toast.success('Product duplicated', {
        description: `Created "${newProduct.name}" with SKU: ${newProduct.sku}`,
      });

      options?.onSuccess?.(newProduct);
    },
    onError: (error: Error) => {
      logger.error('Product duplication failed', { error: error.message });
      toast.error('Failed to duplicate product', {
        description: error.message,
      });
    },
  });

  return {
    duplicateProduct: duplicateMutation.mutate,
    duplicateProductAsync: duplicateMutation.mutateAsync,
    isPending: duplicateMutation.isPending,
  };
}
