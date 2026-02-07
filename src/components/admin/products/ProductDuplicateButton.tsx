import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Copy from "lucide-react/dist/esm/icons/copy";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductDuplicateButtonProps {
  product: Product;
  variant?: 'button' | 'dropdown';
  onSuccess?: (newProduct: Product) => void;
}

/**
 * Generates a unique SKU for the duplicated product.
 * Takes the original SKU and appends "-COPY" or "-COPY-{n}" if copies already exist.
 */
function generateDuplicateSku(originalSku: string | null): string {
  if (!originalSku) {
    // Generate a timestamp-based SKU if no original SKU
    const timestamp = Date.now().toString(36).toUpperCase();
    return `COPY-${timestamp}`;
  }

  // Check if SKU already ends with -COPY or -COPY-{n}
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

    // SKU is unique
    if (!data) {
      return candidateSku;
    }

    // Try next candidate
    const baseSkuWithoutCounter = baseSku.replace(/-\d+$/, '');
    candidateSku = `${baseSkuWithoutCounter}-${counter}`;
    counter++;
  }

  // Fallback to timestamp-based SKU
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${baseSku}-${timestamp}`;
}

export function ProductDuplicateButton({
  product,
  variant = 'button',
  onSuccess,
}: ProductDuplicateButtonProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) {
        throw new Error('Tenant not found');
      }

      // Generate a unique SKU for the duplicate
      const baseSku = generateDuplicateSku(product.sku);
      const uniqueSku = await ensureUniqueSku(baseSku, tenant.id);

      // Create duplicate product data (exclude id, created_at, updated_at)
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
        batch_number: null, // Don't copy batch number - it should be unique
        cost_per_unit: product.cost_per_unit,
        wholesale_price: product.wholesale_price,
        retail_price: product.retail_price,
        available_quantity: 0, // Start with 0 quantity for duplicated product
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

      return data;
    },
    onSuccess: (newProduct) => {
      // Invalidate product queries to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      toast.success('Product duplicated', {
        description: `Created "${newProduct.name}" with SKU: ${newProduct.sku}`,
      });

      onSuccess?.(newProduct);
    },
    onError: (error: Error) => {
      logger.error('Product duplication failed', { error: error.message });
      toast.error('Failed to duplicate product', {
        description: error.message,
      });
    },
  });

  const handleDuplicate = () => {
    duplicateMutation.mutate();
  };

  if (variant === 'dropdown') {
    return (
      <DropdownMenuItem
        onClick={handleDuplicate}
        disabled={duplicateMutation.isPending}
      >
        {duplicateMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Copy className="mr-2 h-4 w-4" />
        )}
        {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDuplicate}
      disabled={duplicateMutation.isPending}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {duplicateMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {isHovered && (
        <span className="ml-2">
          {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
        </span>
      )}
    </Button>
  );
}
