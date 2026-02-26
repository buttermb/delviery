/**
 * Unified Storefront Customer Profile Hook
 *
 * Provides access to customer data from the unified customers table,
 * linking storefront customers to the admin customer hub.
 *
 * Features:
 * - Unified customer record retrieval
 * - Browsing history tracking
 * - Wishlist management
 * - Customer preferences
 * - Order history from same orders table
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export interface UnifiedCustomerProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  customer_type: string | null;
  status: string | null;
  loyalty_points: number;
  loyalty_tier: string | null;
  total_spent: number;
  last_purchase_at: string | null;
  referral_source: string | null;
  created_at: string;
  updated_at: string | null;
  // Preferences
  preferences: CustomerPreferences | null;
  // Stats from admin
  order_count: number;
  average_order_value: number;
}

export interface CustomerPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  marketing_emails: boolean;
  preferred_delivery_time: string | null;
  dietary_preferences: string[];
  favorite_categories: string[];
}

export interface BrowsingHistoryItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  product_price: number;
  viewed_at: string;
}

export interface WishlistItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  product_price: number;
  added_at: string;
  in_stock: boolean;
}

interface UseStorefrontCustomerProfileOptions {
  enabled?: boolean;
}

export function useStorefrontCustomerProfile(options: UseStorefrontCustomerProfileOptions = {}) {
  const { customer, tenant } = useCustomerAuth();
  const _queryClient = useQueryClient();
  const { enabled = true } = options;

  const customerEmail = customer?.email;
  const tenantId = tenant?.id;

  // Fetch unified customer profile from customers table
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: [...queryKeys.customers.all, 'storefront-profile', tenantId, customerEmail],
    queryFn: async (): Promise<UnifiedCustomerProfile | null> => {
      if (!customerEmail || !tenantId) return null;

      // Get customer record from unified customers table
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select(`
          id,
          email,
          first_name,
          last_name,
          phone,
          customer_type,
          status,
          loyalty_points,
          loyalty_tier,
          total_spent,
          last_purchase_at,
          referral_source,
          created_at,
          updated_at
        `)
        .eq('tenant_id', tenantId)
        .eq('email', customerEmail.toLowerCase())
        .is('deleted_at', null)
        .maybeSingle();

      if (customerError) {
        logger.error('Failed to fetch customer profile', customerError, {
          component: 'useStorefrontCustomerProfile',
          tenantId,
          customerEmail,
        });
        throw customerError;
      }

      if (!customerData) {
        // Customer may not exist in unified table yet - return minimal profile
        return null;
      }

      // Get order count and average order value
      const { data: orderStats, error: orderError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerData.id);

      if (orderError) {
        logger.warn('Failed to fetch order stats', orderError, {
          component: 'useStorefrontCustomerProfile',
          customerId: customerData.id,
        });
      }

      const orderCount = orderStats?.length ?? 0;
      const totalOrderValue = orderStats?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) ?? 0;
      const averageOrderValue = orderCount > 0 ? totalOrderValue / orderCount : 0;

      // Get customer preferences (stored in customer_preferences table if exists)
      const { data: preferencesData } = await supabase
        .from('customer_preferences')
        .select('*')
        .eq('customer_id', customerData.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      interface PreferencesRow {
        email_notifications?: boolean;
        sms_notifications?: boolean;
        marketing_emails?: boolean;
        preferred_delivery_time?: string | null;
        dietary_preferences?: string[];
        favorite_categories?: string[];
      }

      const prefs = preferencesData as PreferencesRow | null;
      const preferences: CustomerPreferences = prefs ? {
        email_notifications: prefs.email_notifications ?? true,
        sms_notifications: prefs.sms_notifications ?? false,
        marketing_emails: prefs.marketing_emails ?? true,
        preferred_delivery_time: prefs.preferred_delivery_time ?? null,
        dietary_preferences: prefs.dietary_preferences ?? [],
        favorite_categories: prefs.favorite_categories ?? [],
      } : {
        email_notifications: true,
        sms_notifications: false,
        marketing_emails: true,
        preferred_delivery_time: null,
        dietary_preferences: [],
        favorite_categories: [],
      };

      return {
        id: customerData.id,
        email: customerData.email,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        phone: customerData.phone,
        customer_type: customerData.customer_type,
        status: customerData.status,
        loyalty_points: customerData.loyalty_points ?? 0,
        loyalty_tier: customerData.loyalty_tier,
        total_spent: Number(customerData.total_spent ?? 0),
        last_purchase_at: customerData.last_purchase_at,
        referral_source: customerData.referral_source,
        created_at: customerData.created_at,
        updated_at: customerData.updated_at,
        preferences,
        order_count: orderCount,
        average_order_value: averageOrderValue,
      };
    },
    enabled: enabled && !!customerEmail && !!tenantId,
    staleTime: 60000, // 1 minute
  });

  // Fetch browsing history
  const {
    data: browsingHistory = [],
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: [...queryKeys.customers.all, 'browsing-history', tenantId, profile?.id],
    queryFn: async (): Promise<BrowsingHistoryItem[]> => {
      if (!profile?.id || !tenantId) return [];

      const { data, error } = await supabase
        .from('customer_browsing_history')
        .select(`
          id,
          product_id,
          viewed_at,
          products:product_id (
            name,
            image_url,
            price
          )
        `)
        .eq('customer_id', profile.id)
        .eq('tenant_id', tenantId)
        .order('viewed_at', { ascending: false })
        .limit(20);

      if (error) {
        logger.warn('Failed to fetch browsing history', error, {
          component: 'useStorefrontCustomerProfile',
          customerId: profile.id,
        });
        return [];
      }

      interface BrowsingRow {
        id: string;
        product_id: string;
        viewed_at: string;
        products: { name: string; image_url: string | null; price: number | null } | null;
      }

      return (data ?? []).map((item: BrowsingRow) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name ?? 'Unknown Product',
        product_image: item.products?.image_url ?? null,
        product_price: Number(item.products?.price) || 0,
        viewed_at: item.viewed_at,
      }));
    },
    enabled: enabled && !!profile?.id && !!tenantId,
    staleTime: 30000,
  });

  // Fetch wishlist
  const {
    data: wishlist = [],
    isLoading: isLoadingWishlist,
    refetch: refetchWishlist,
  } = useQuery({
    queryKey: [...queryKeys.customers.all, 'wishlist', tenantId, profile?.id],
    queryFn: async (): Promise<WishlistItem[]> => {
      if (!profile?.id || !tenantId) return [];

      const { data, error } = await supabase
        .from('customer_wishlist')
        .select(`
          id,
          product_id,
          created_at,
          products:product_id (
            name,
            image_url,
            price,
            stock_quantity
          )
        `)
        .eq('customer_id', profile.id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch wishlist', error, {
          component: 'useStorefrontCustomerProfile',
          customerId: profile.id,
        });
        return [];
      }

      interface WishlistRow {
        id: string;
        product_id: string;
        created_at: string;
        products: { name: string; image_url: string | null; price: number | null; stock_quantity: number | null } | null;
      }

      return (data ?? []).map((item: WishlistRow) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name ?? 'Unknown Product',
        product_image: item.products?.image_url ?? null,
        product_price: Number(item.products?.price) || 0,
        added_at: item.created_at,
        in_stock: Number(item.products?.stock_quantity) > 0,
      }));
    },
    enabled: enabled && !!profile?.id && !!tenantId,
    staleTime: 30000,
  });

  // Track product view mutation
  const trackProductViewMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!profile?.id || !tenantId) {
        throw new Error('Customer profile not loaded');
      }

      const { error } = await supabase
        .from('customer_browsing_history')
        .upsert({
          customer_id: profile.id,
          tenant_id: tenantId,
          product_id: productId,
          viewed_at: new Date().toISOString(),
        }, {
          onConflict: 'customer_id,product_id,tenant_id',
        });

      if (error) {
        logger.error('Failed to track product view', error, {
          component: 'useStorefrontCustomerProfile',
          productId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      refetchHistory();
    },
  });

  // Add to wishlist mutation
  const addToWishlistMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!profile?.id || !tenantId) {
        throw new Error('Customer profile not loaded');
      }

      const { error } = await supabase
        .from('customer_wishlist')
        .insert({
          customer_id: profile.id,
          tenant_id: tenantId,
          product_id: productId,
        });

      if (error) {
        if (error.code === '23505') {
          // Already in wishlist
          toast.info('Already in wishlist');
          return;
        }
        logger.error('Failed to add to wishlist', error, {
          component: 'useStorefrontCustomerProfile',
          productId,
        });
        throw error;
      }

      toast.success('Added to wishlist');
    },
    onSuccess: () => {
      refetchWishlist();
    },
  });

  // Remove from wishlist mutation
  const removeFromWishlistMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!profile?.id || !tenantId) {
        throw new Error('Customer profile not loaded');
      }

      const { error } = await supabase
        .from('customer_wishlist')
        .delete()
        .eq('customer_id', profile.id)
        .eq('tenant_id', tenantId)
        .eq('product_id', productId);

      if (error) {
        logger.error('Failed to remove from wishlist', error, {
          component: 'useStorefrontCustomerProfile',
          productId,
        });
        throw error;
      }

      toast.success('Removed from wishlist');
    },
    onSuccess: () => {
      refetchWishlist();
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<CustomerPreferences>) => {
      if (!profile?.id || !tenantId) {
        throw new Error('Customer profile not loaded');
      }

      const { error } = await supabase
        .from('customer_preferences')
        .upsert({
          customer_id: profile.id,
          tenant_id: tenantId,
          ...updates,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'customer_id,tenant_id',
        });

      if (error) {
        logger.error('Failed to update preferences', error, {
          component: 'useStorefrontCustomerProfile',
        });
        throw error;
      }

      toast.success('Preferences updated');
    },
    onSuccess: () => {
      refetchProfile();
    },
  });

  // Check if product is in wishlist
  const isInWishlist = (productId: string): boolean => {
    return wishlist.some((item) => item.product_id === productId);
  };

  // Toggle wishlist
  const toggleWishlist = async (productId: string) => {
    if (isInWishlist(productId)) {
      await removeFromWishlistMutation.mutateAsync(productId);
    } else {
      await addToWishlistMutation.mutateAsync(productId);
    }
  };

  return {
    // Profile data
    profile,
    isLoadingProfile,
    profileError,
    refetchProfile,

    // Browsing history
    browsingHistory,
    isLoadingHistory,
    refetchHistory,
    trackProductView: trackProductViewMutation.mutate,
    isTrackingView: trackProductViewMutation.isPending,

    // Wishlist
    wishlist,
    isLoadingWishlist,
    refetchWishlist,
    addToWishlist: addToWishlistMutation.mutate,
    removeFromWishlist: removeFromWishlistMutation.mutate,
    toggleWishlist,
    isInWishlist,
    isUpdatingWishlist: addToWishlistMutation.isPending || removeFromWishlistMutation.isPending,

    // Preferences
    updatePreferences: updatePreferencesMutation.mutate,
    isUpdatingPreferences: updatePreferencesMutation.isPending,

    // Helpers
    fullName: profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
      : customer?.email ?? 'Guest',
    isFromStorefront: profile?.referral_source === 'storefront',
    hasProfile: !!profile,
  };
}
