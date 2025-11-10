/**
 * Tenant Query Utilities - Usage Examples
 * 
 * This file contains practical examples of how to use the tenant isolation utilities.
 * Copy these patterns into your components and pages.
 */

import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  tenantQuery,
  tenantInsert,
  tenantUpdate,
  tenantDelete,
  hasTenantId,
  assertTenantId,
} from "./tenantQueries";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

// ============================================================================
// EXAMPLE 1: List Products (with React Query)
// ============================================================================

export function useProducts() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const { data: products, isLoading, error } = useQuery({
    queryKey: queryKeys.products.list(tenant?.id || ""),
    queryFn: async () => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      const { data, error } = await tenantQuery(supabase, "products", tenant.id)
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Failed to fetch products", error, {
          component: "useProducts",
          tenantId: tenant.id,
        });
        throw error;
      }

      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { products, isLoading, error };
}

// ============================================================================
// EXAMPLE 2: Get Single Product
// ============================================================================

export function useProduct(productId: string) {
  const { tenant } = useTenantAdminAuth();

  const { data: product, isLoading, error } = useQuery({
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

  return { product, isLoading, error };
}

// ============================================================================
// EXAMPLE 3: Create Product (Mutation)
// ============================================================================

export function useCreateProduct() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: {
      name: string;
      description?: string;
      price: number;
      // ... other fields
    }) => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      // Ensure tenant_id is included
      const { data, error } = await tenantInsert(supabase, "products", tenant.id)
        .insert({
          ...productData,
          tenant_id: tenant.id, // Explicitly set (tenantInsert adds it, but being explicit)
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
      // Invalidate products list to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
      toast.success("Product created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create product", {
        description: error.message,
      });
    },
  });
}

// ============================================================================
// EXAMPLE 4: Update Product (Mutation)
// ============================================================================

export function useUpdateProduct() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      updates,
    }: {
      productId: string;
      updates: Partial<{
        name: string;
        description: string;
        price: number;
        status: string;
      }>;
    }) => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

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
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(tenant?.id || "", data.id),
      });
      toast.success("Product updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update product", {
        description: error.message,
      });
    },
  });
}

// ============================================================================
// EXAMPLE 5: Delete Product (Mutation)
// ============================================================================

export function useDeleteProduct() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

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
    onError: (error: Error) => {
      toast.error("Failed to delete product", {
        description: error.message,
      });
    },
  });
}

// ============================================================================
// EXAMPLE 6: Count Products
// ============================================================================

export function useProductCount() {
  const { tenant } = useTenantAdminAuth();

  const { data: count, isLoading } = useQuery({
    queryKey: ["products", "count", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return 0;

      const { count, error } = await tenantQuery(supabase, "products", tenant.id)
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (error) {
        logger.error("Failed to count products", error, {
          component: "useProductCount",
          tenantId: tenant.id,
        });
        return 0;
      }

      return count || 0;
    },
    enabled: !!tenant?.id,
  });

  return { count: count || 0, isLoading };
}

// ============================================================================
// EXAMPLE 7: Filtered Query with Multiple Conditions
// ============================================================================

export function useFilteredProducts(filters: {
  status?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const { tenant } = useTenantAdminAuth();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "filtered", tenant?.id, filters],
    queryFn: async () => {
      if (!tenant?.id) throw new Error("Tenant not loaded");

      let query = tenantQuery(supabase, "products", tenant.id).select("*");

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      if (filters.category) {
        query = query.eq("category_id", filters.category);
      }

      if (filters.minPrice !== undefined) {
        query = query.gte("price", filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        query = query.lte("price", filters.maxPrice);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        logger.error("Failed to fetch filtered products", error, {
          component: "useFilteredProducts",
          tenantId: tenant.id,
          filters,
        });
        throw error;
      }

      return data || [];
    },
    enabled: !!tenant?.id,
  });

  return { products, isLoading };
}

// ============================================================================
// EXAMPLE 8: Type Guard Usage
// ============================================================================

export function processProductData(data: unknown) {
  // Use type guard to ensure tenant_id exists
  if (hasTenantId(data)) {
    // TypeScript now knows data has tenant_id
    console.log("Processing product for tenant:", data.tenant_id);
    return data;
  }

  // Assert if tenant_id is required
  assertTenantId(data, "Product processing");
  return data;
}

// ============================================================================
// EXAMPLE 9: Batch Operations
// ============================================================================

export async function batchCreateProducts(
  tenantId: string,
  products: Array<{ name: string; price: number }>
) {
  if (!tenantId) {
    throw new Error("Tenant ID is required");
  }

  // Ensure all products have tenant_id
  const productsWithTenant = products.map((product) => ({
    ...product,
    tenant_id: tenantId,
  }));

  const { data, error } = await tenantInsert(supabase, "products", tenantId)
    .insert(productsWithTenant)
    .select();

  if (error) {
    logger.error("Failed to batch create products", error, {
      component: "batchCreateProducts",
      tenantId,
      count: products.length,
    });
    throw error;
  }

  return data;
}

// ============================================================================
// EXAMPLE 10: Edge Function Pattern (for reference)
// ============================================================================

/**
 * Example Edge Function pattern for tenant validation
 * This would go in supabase/functions/your-function/index.ts
 * 
 * import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
 * import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
 * 
 * const RequestSchema = z.object({
 *   tenant_id: z.string().uuid(),
 *   product_id: z.string().uuid(),
 * });
 * 
 * serve(async (req) => {
 *   if (req.method === "OPTIONS") {
 *     return new Response(null, { headers: corsHeaders });
 *   }
 * 
 *   try {
 *     const supabase = createClient(
 *       Deno.env.get('SUPABASE_URL')!,
 *       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
 *     );
 * 
 *     const rawBody = await req.json();
 *     const body = RequestSchema.parse(rawBody);
 * 
 *     // Extract and validate user
 *     const authHeader = req.headers.get("Authorization");
 *     if (!authHeader) {
 *       return new Response(
 *         JSON.stringify({ error: "Missing authorization" }),
 *         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
 *       );
 *     }
 * 
 *     const token = authHeader.replace("Bearer ", "");
 *     const { data: { user }, error: authError } = await supabase.auth.getUser(token);
 * 
 *     if (authError || !user) {
 *       return new Response(
 *         JSON.stringify({ error: "Invalid token" }),
 *         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
 *       );
 *     }
 * 
 *     // Validate tenant access
 *     const { data: tenantUser } = await supabase
 *       .from("tenant_users")
 *       .select("tenant_id")
 *       .eq("user_id", user.id)
 *       .eq("tenant_id", body.tenant_id)
 *       .eq("status", "active")
 *       .maybeSingle();
 * 
 *     if (!tenantUser) {
 *       return new Response(
 *         JSON.stringify({ error: "Unauthorized tenant access" }),
 *         { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
 *       );
 *     }
 * 
 *     // All queries must filter by tenant_id
 *     const { data, error } = await supabase
 *       .from("products")
 *       .select("*")
 *       .eq("id", body.product_id)
 *       .eq("tenant_id", body.tenant_id); // ✅ Required!
 * 
 *     if (error) throw error;
 * 
 *     return new Response(
 *       JSON.stringify({ success: true, data }),
 *       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
 *     );
 *   } catch (error) {
 *     // Error handling...
 *   }
 * });
 */

