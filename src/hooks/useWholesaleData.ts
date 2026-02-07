import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

/**
 * Fetch active wholesale clients (excludes soft-deleted)
 */
export const useWholesaleClients = (options?: { includeArchived?: boolean }) => {
  const { tenant } = useTenantAdminAuth();
  const includeArchived = options?.includeArchived ?? false;

  return useQuery({
    queryKey: ["wholesale-clients", tenant?.id, { includeArchived }],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      let query = supabase
        .from('wholesale_clients')
        .select('id, tenant_id, business_name, contact_name, phone, email, outstanding_balance, credit_limit, payment_terms, last_payment_date, status, deleted_at, created_at')
        .eq('tenant_id', tenant.id);

      // Only include active clients by default
      if (!includeArchived) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query.order('business_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
    gcTime: 300_000,
  });
};

export const useWholesaleOrders = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-orders", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from("wholesale_orders")
        .select(`
          id, tenant_id, client_id, runner_id, order_number, status, total_amount, notes, created_at, updated_at,
          client:wholesale_clients(business_name, contact_name),
          runner:wholesale_runners(full_name, phone)
        `)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 15_000,
    gcTime: 120_000,
  });
};

export const useCreateWholesaleOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('wholesale-order-create', {
        body: orderData
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to create wholesale order';
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-orders"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-clients"] });
      showSuccessToast("Order Created", "Wholesale order created successfully");
    },
    onError: (error) => {
      showErrorToast("Order Failed", error instanceof Error ? error.message : "Failed to create order");
    }
  });
};

export const useProcessPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('wholesale-payment-process', {
        body: paymentData
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to process payment';
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-clients"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-payments"] });
      showSuccessToast("Payment Processed", "Payment recorded successfully");
    },
    onError: (error) => {
      showErrorToast("Payment Failed", error instanceof Error ? error.message : "Failed to process payment");
    }
  });
};

export const useAssignDelivery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { order_id: string; runner_id: string }) => {
      const { data: result, error } = await supabase.functions.invoke('wholesale-delivery-assign', {
        body: data
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to assign delivery';
        throw new Error(errorMessage);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-orders"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["runners"] });
      showSuccessToast("Delivery Assigned", "Runner assigned successfully");
    },
    onError: (error) => {
      showErrorToast("Assignment Failed", error instanceof Error ? error.message : "Failed to assign delivery");
    }
  });
};

export const useUpdateDeliveryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { delivery_id: string; status: string; location?: { lat?: number; lng?: number;[key: string]: unknown } | null; notes?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('wholesale-delivery-update', {
        body: data
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to update delivery';
        throw new Error(errorMessage);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["active-deliveries"] });
      showSuccessToast("Status Updated", "Delivery status updated successfully");
    },
    onError: (error) => {
      showErrorToast("Update Failed", error instanceof Error ? error.message : "Failed to update status");
    }
  });
};

/**
 * @deprecated Use useProductsForWholesale instead - products table is the source of truth
 */
export const useWholesaleInventory = (tenantId?: string) => {
  return useQuery({
    queryKey: ["products-inventory", tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, stock_quantity, available_quantity, low_stock_alert, price, wholesale_price, cost_per_unit, image_url, in_stock")
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) throw error;
      
      // Map to legacy format for compatibility
      return (data || []).map(item => ({
        id: item.id,
        product_name: item.name,
        category: item.category,
        quantity_lbs: item.stock_quantity || 0,
        quantity_units: item.available_quantity || 0,
        reorder_point: item.low_stock_alert || 10,
        price_per_lb: item.wholesale_price || item.price || 0,
        cost_per_lb: item.cost_per_unit || 0,
        image_url: item.image_url,
        in_stock: item.in_stock,
        source: 'products' as const,
      }));
    },
    enabled: !!tenantId,
  });
};

/**
 * @deprecated Use useWholesaleCouriers instead - integrates with the main couriers table
 */
export const useWholesaleRunners = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-runners", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("wholesale_runners")
        .select("id, tenant_id, full_name, phone, vehicle_type, is_active, created_at")
        .eq("tenant_id", tenant.id)
        .order("full_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
};

/**
 * Fetch couriers for wholesale deliveries
 * Uses the main couriers table with tenant isolation
 */
export const useWholesaleCouriers = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-couriers", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("couriers")
        .select("id, full_name, phone, vehicle_type, is_online, is_active")
        .eq("tenant_id", tenant.id)
        .order("full_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id
  });
};

/**
 * Fetch products from the main products catalog for wholesale orders
 * Includes wholesale_price field for B2B pricing
 */
export const useProductsForWholesale = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["products-for-wholesale", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, wholesale_price, cost_per_unit, stock_quantity, category, image_url, in_stock")
        .eq("tenant_id", tenant.id)
        .eq("in_stock", true)
        .order("name");

      if (error) throw error;
      
      // Map to consistent format for wholesale orders
      return (data || []).map(product => ({
        id: product.id,
        product_name: product.name,
        base_price: product.wholesale_price || product.price || 0,
        retail_price: product.price || 0,
        cost_per_unit: product.cost_per_unit || 0,
        quantity_available: product.stock_quantity || 0,
        category: product.category,
        image_url: product.image_url,
        source: 'products' as const,
      }));
    },
    enabled: !!tenant?.id
  });
};

export interface WholesalePaymentWithClient {
  id: string;
  client_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number: string;
  notes: string;
  status: string;
  created_at: string;
  client?: { business_name: string } | null;
}

export const useWholesalePayments = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-payments", tenant?.id],
    queryFn: async (): Promise<WholesalePaymentWithClient[]> => {
      if (!tenant?.id) throw new Error('No tenant context');

      // Use JOIN to fetch client data in a single query (eliminates N+1 pattern)
      // @ts-expect-error - Supabase type instantiation depth issue
      const { data, error } = await supabase
        .from("wholesale_payments")
        .select("id, client_id, amount, payment_method, payment_date, reference_number, notes, status, created_at, client:wholesale_clients(business_name)")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as WholesalePaymentWithClient[];
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
    gcTime: 300_000,
  });
};

export const useWholesaleDeliveries = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-deliveries", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from("wholesale_deliveries")
        .select(`
          id, tenant_id, order_id, runner_id, status, pickup_location, delivery_location, notes, created_at, updated_at,
          order:wholesale_orders(order_number, total_amount),
          runner:wholesale_runners(full_name, phone, vehicle_type)
        `)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
    staleTime: 15_000,
    gcTime: 120_000,
  });
};

export const useClientDetail = (clientId: string) => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-client", clientId, tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from("wholesale_clients")
        .select("id, tenant_id, business_name, contact_name, phone, email, address, outstanding_balance, credit_limit, payment_terms, last_payment_date, notes, status, deleted_at, created_at, updated_at")
        .eq("id", clientId)
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !!tenant?.id,
    staleTime: 30_000,
    gcTime: 300_000,
  });
};

export const useClientOrders = (clientId: string) => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-client-orders", clientId, tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from("wholesale_orders")
        .select("id, order_number, status, total_amount, notes, created_at")
        .eq("client_id", clientId)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!tenant?.id,
    staleTime: 15_000,
    gcTime: 120_000,
  });
};

export const useClientPayments = (clientId: string) => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-client-payments", clientId, tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase
        .from("wholesale_payments")
        .select("id, client_id, amount, payment_method, payment_date, reference_number, notes, status, created_at")
        .eq("client_id", clientId)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(20) as any);

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!tenant?.id,
    staleTime: 30_000,
    gcTime: 300_000,
  });
};
