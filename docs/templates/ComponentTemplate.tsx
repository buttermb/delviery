/**
 * Component Template
 * 
 * Copy this template when creating new components.
 * Follows all established rules and best practices.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Types
import type { Product } from "@/types/product";

// Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hooks
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { usePermissions } from "@/hooks/usePermissions";

// Utilities
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";
import { tenantQuery } from "@/lib/utils/tenantQueries";
import { supabase } from "@/integrations/supabase/client";

interface ComponentNameProps {
  // Define props here
  productId?: string;
  onClose?: () => void;
}

export const ComponentName = ({ productId, onClose }: ComponentNameProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const { checkPermission } = usePermissions();

  // State
  const [loading, setLoading] = useState(false);

  // Query
  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.products.detail(tenant?.id || "", productId || ""),
    queryFn: async () => {
      if (!tenant?.id || !productId) throw new Error("Missing tenant or productId");

      const { data, error } = await tenantQuery(supabase, "products", tenant.id)
        .select("*")
        .eq("id", productId)
        .single();

      if (error) {
        logger.error("Failed to fetch product", error, {
          component: "ComponentName",
          tenantId: tenant.id,
          productId,
        });
        throw error;
      }

      return data;
    },
    enabled: !!tenant?.id && !!productId,
  });

  // Mutation
  const updateProduct = useMutation({
    mutationFn: async (updates: Partial<Product>) => {
      if (!tenant?.id || !productId) throw new Error("Missing tenant or productId");

      const { data, error } = await tenantQuery(supabase, "products", tenant.id)
        .update(updates)
        .eq("id", productId)
        .select()
        .single();

      if (error) {
        logger.error("Failed to update product", error, {
          component: "ComponentName",
          tenantId: tenant.id,
          productId,
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
      toast.success("Product updated successfully");
    },
    onError: (error: unknown) => {
      logger.error("Update failed", error, { component: "ComponentName" });
      toast.error("Failed to update product");
    },
  });

  // Event handlers
  const handleSave = useCallback(async () => {
    if (!checkPermission("products:edit")) {
      toast.error("No permission to edit products");
      return;
    }

    try {
      setLoading(true);
      await updateProduct.mutateAsync({ name: "Updated Name" });
    } catch {
      // Error handled in mutation
    } finally {
      setLoading(false);
    }
  }, [checkPermission, updateProduct]);

  const handleNavigate = useCallback(() => {
    if (!tenant?.slug) return;
    navigate(`/${tenant.slug}/admin/products`);
  }, [navigate, tenant?.slug]);

  // Loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Error state
  if (!product) {
    return <div>Product not found</div>;
  }

  // Render
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p>Price: ${product.price}</p>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={loading || updateProduct.isPending}
            >
              {loading || updateProduct.isPending ? "Saving..." : "Save"}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleNavigate}
            >
              View All Products
            </Button>
            
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

