import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

export const useWholesaleClients = () => {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: ["wholesale-clients", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from('wholesale_clients')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('business_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id
  });
};

export const useWholesaleOrders = () => {
  return useQuery({
    queryKey: ["wholesale-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_orders")
        .select(`
          *,
          client:wholesale_clients(business_name, contact_name),
          runner:wholesale_runners(full_name, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    }
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

export const useWholesaleInventory = (tenantId?: string) => {
  return useQuery({
    queryKey: ["wholesale-inventory", tenantId],
    queryFn: async () => {
      let query = supabase
        .from("wholesale_inventory")
        .select("*");

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.order("product_name");

      if (error) throw error;
      
      // Add source field for consistency with products
      return (data || []).map(item => ({
        ...item,
        source: 'wholesale_inventory' as const,
      }));
    },
    enabled: tenantId !== undefined,
  });
};

/**
 * @deprecated Use useWholesaleCouriers instead - integrates with the main couriers table
 */
export const useWholesaleRunners = () => {
  return useQuery({
    queryKey: ["wholesale-runners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_runners")
        .select("*")
        .order("full_name");

      if (error) throw error;
      return data;
    }
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

export const useWholesalePayments = () => {
  return useQuery({
    queryKey: ["wholesale-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_payments")
        .select(`
          *,
          client:wholesale_clients(business_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    }
  });
};

export const useWholesaleDeliveries = () => {
  return useQuery({
    queryKey: ["wholesale-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_deliveries")
        .select(`
          *,
          order:wholesale_orders(order_number, total_amount),
          runner:wholesale_runners(full_name, phone, vehicle_type)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    }
  });
};

export const useClientDetail = (clientId: string) => {
  return useQuery({
    queryKey: ["wholesale-client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });
};

export const useClientOrders = (clientId: string) => {
  return useQuery({
    queryKey: ["wholesale-client-orders", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_orders")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });
};

export const useClientPayments = (clientId: string) => {
  return useQuery({
    queryKey: ["wholesale-client-payments", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_payments")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });
};
