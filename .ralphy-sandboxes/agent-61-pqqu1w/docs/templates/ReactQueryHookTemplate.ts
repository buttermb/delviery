/**
 * React Query Hook Template
 * 
 * Copy this template when creating new React Query hooks.
 * Follows all established rules and best practices.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Types
import type { Product } from "@/types/product";

// Hooks
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { usePermissions } from "@/hooks/usePermissions";

// Utilities
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";
import { tenantQuery, tenantInsert, tenantUpdate, tenantDelete } from "@/lib/utils/tenantQueries";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch a list of products
 */
export function useProducts(filters?: { status?: string; category?: string }) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.products.list(tenant?.id || "", filters),
    queryFn: async () => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      let query = tenantQuery(supabase, "products", tenant.id).select("*");

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.category) {
        query = query.eq("category_id", filters.category);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        logger.error("Failed to fetch products", error, {
          component: "useProducts",
          tenantId: tenant.id,
          filters,
        });
        throw error;
      }

      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single product
 */
export function useProduct(productId: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.products.detail(tenant?.id || "", productId),
    queryFn: async () => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      const { data, error } = await tenantQuery(supabase, "products", tenant.id)
        .select("*")
        .eq("id", productId)
        .single();

      if (error) {
        logger.error("Failed to fetch product", error, {
          component: "useProduct",
          tenantId: tenant.id,
          productId,
        });
        throw error;
      }

      return data;
    },
    enabled: !!tenant?.id && !!productId,
  });
}

/**
 * Hook to create a product
 */
export function useCreateProduct() {
  const { tenant } = useTenantAdminAuth();
  const { checkPermission } = usePermissions();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: Omit<Product, "id" | "tenant_id" | "created_at" | "updated_at">) => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      if (!checkPermission("products:create")) {
        throw new Error("No permission to create products");
      }

      const { data, error } = await tenantInsert(supabase, "products", tenant.id)
        .insert({
          ...productData,
          tenant_id: tenant.id,
        })
        .select()
        .single();

      if (error) {
        logger.error("Failed to create product", error, {
          component: "useCreateProduct",
          tenantId: tenant.id,
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
      toast.success("Product created successfully");
    },
    onError: (error: unknown) => {
      logger.error("Create product failed", error, { component: "useCreateProduct" });
      toast.error("Failed to create product");
    },
  });
}

/**
 * Hook to update a product
 */
export function useUpdateProduct() {
  const { tenant } = useTenantAdminAuth();
  const { checkPermission } = usePermissions();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, updates }: { productId: string; updates: Partial<Product> }) => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      if (!checkPermission("products:edit")) {
        throw new Error("No permission to edit products");
      }

      const { data, error } = await tenantUpdate(supabase, "products", tenant.id)
        .update(updates)
        .eq("id", productId)
        .select()
        .single();

      if (error) {
        logger.error("Failed to update product", error, {
          component: "useUpdateProduct",
          tenantId: tenant.id,
          productId,
        });
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(tenant?.id || "", data.id),
      });
      toast.success("Product updated successfully");
    },
    onError: (error: unknown) => {
      logger.error("Update product failed", error, { component: "useUpdateProduct" });
      toast.error("Failed to update product");
    },
  });
}

/**
 * Hook to delete a product
 */
export function useDeleteProduct() {
  const { tenant } = useTenantAdminAuth();
  const { checkPermission } = usePermissions();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      if (!checkPermission("products:delete")) {
        throw new Error("No permission to delete products");
      }

      const { error } = await tenantDelete(supabase, "products", tenant.id)
        .eq("id", productId);

      if (error) {
        logger.error("Failed to delete product", error, {
          component: "useDeleteProduct",
          tenantId: tenant.id,
          productId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
      toast.success("Product deleted successfully");
    },
    onError: (error: unknown) => {
      logger.error("Delete product failed", error, { component: "useDeleteProduct" });
      toast.error("Failed to delete product");
    },
  });
}

