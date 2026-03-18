/**
 * Vendors with Statistics Hook
 *
 * Extends vendor data with product counts and aggregate ratings.
 * Used in ProductForm vendor dropdown to show vendor info.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface VendorWithStats {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  license_number: string | null;
  payment_terms: string | null;
  lead_time_days: number | null;
  status: string | null;
  notes: string | null;
  // Computed stats
  product_count: number;
  avg_rating: number | null;
  rating_count: number;
}

// ============================================================================
// Hook: useVendorsWithStats
// ============================================================================

export function useVendorsWithStats() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: [...queryKeys.vendors.list(tenantId ?? ''), 'with-stats'],
    queryFn: async (): Promise<VendorWithStats[]> => {
      if (!tenantId) {
        return [];
      }

      // Fetch vendors
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, name, contact_name, contact_email, contact_phone, address, city, state, zip_code, license_number, payment_terms, lead_time_days, status, notes')
        .eq('account_id', tenantId)
        .order('name');

      if (vendorsError) {
        logger.error('Failed to fetch vendors', vendorsError, {
          component: 'useVendorsWithStats',
          tenantId,
        });
        throw vendorsError;
      }

      if (!vendors || vendors.length === 0) {
        return [];
      }

      // Fetch product counts for each vendor by vendor_name
      const vendorNames = vendors.map((v) => v.name).filter(Boolean);
      const { data: productCounts, error: productError } = await supabase
        .from('products')
        .select('vendor_name')
        .eq('tenant_id', tenantId)
        .in('vendor_name', vendorNames);

      if (productError) {
        logger.warn('Failed to fetch product counts', productError, {
          component: 'useVendorsWithStats',
        });
      }

      // Count products per vendor
      const productCountMap = new Map<string, number>();
      if (productCounts) {
        for (const product of productCounts) {
          if (product.vendor_name) {
            productCountMap.set(
              product.vendor_name,
              (productCountMap.get(product.vendor_name) ?? 0) + 1
            );
          }
        }
      }

      // Fetch aggregate ratings for all vendors
      const vendorIds = vendors.map((v) => v.id);
      const { data: ratings, error: ratingsError } = await supabase
        .from('vendor_ratings')
        .select('vendor_id, overall_score')
        .eq('tenant_id', tenantId)
        .in('vendor_id', vendorIds);

      if (ratingsError) {
        logger.warn('Failed to fetch vendor ratings', ratingsError, {
          component: 'useVendorsWithStats',
        });
      }

      // Calculate average ratings per vendor
      const ratingMap = new Map<string, { total: number; count: number }>();
      if (ratings) {
        for (const rating of ratings) {
          const r = rating as unknown as { vendor_id: string; overall_score: number };
          const existing = ratingMap.get(r.vendor_id) || { total: 0, count: 0 };
          ratingMap.set(r.vendor_id, {
            total: existing.total + r.overall_score,
            count: existing.count + 1,
          });
        }
      }

      // Combine data
      return vendors.map((vendor) => {
        const ratingData = ratingMap.get(vendor.id);
        const avgRating = ratingData
          ? Math.round((ratingData.total / ratingData.count) * 10) / 10
          : null;

        return {
          id: vendor.id,
          name: vendor.name,
          contact_name: vendor.contact_name,
          contact_email: vendor.contact_email,
          contact_phone: vendor.contact_phone,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          zip_code: vendor.zip_code,
          license_number: vendor.license_number,
          payment_terms: vendor.payment_terms,
          lead_time_days: (vendor as unknown as Record<string, unknown>).lead_time_days as number | null || null,
          status: vendor.status,
          notes: vendor.notes,
          product_count: productCountMap.get(vendor.name) ?? 0,
          avg_rating: avgRating,
          rating_count: ratingData?.count ?? 0,
        };
      });
    },
    enabled: !!tenantId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// ============================================================================
// Hook: useVendorDetails
// ============================================================================

/**
 * Fetch single vendor details for auto-populating form fields
 */
export function useVendorDetails(vendorName: string | null | undefined) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.vendors.detail(tenantId ?? '', vendorName ?? ''),
    queryFn: async (): Promise<VendorWithStats | null> => {
      if (!tenantId || !vendorName) {
        return null;
      }

      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('id, name, contact_name, contact_email, contact_phone, address, city, state, zip_code, license_number, payment_terms, lead_time_days, status, notes')
        .eq('account_id', tenantId)
        .eq('name', vendorName)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch vendor details', error, {
          component: 'useVendorDetails',
          vendorName,
        });
        throw error;
      }

      if (!vendor) {
        return null;
      }

      // Fetch product count
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('vendor_name', vendorName);

      // Fetch ratings
      const { data: ratings } = await supabase
        .from('vendor_ratings')
        .select('overall_score')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendor.id);

      const avgRating =
        ratings && ratings.length > 0
          ? Math.round(
              (ratings.reduce((sum: number, r: { overall_score: number }) => sum + r.overall_score, 0) / ratings.length) * 10
            ) / 10
          : null;

      return {
        id: vendor.id,
        name: vendor.name,
        contact_name: vendor.contact_name,
        contact_email: vendor.contact_email,
        contact_phone: vendor.contact_phone,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        zip_code: vendor.zip_code,
        license_number: vendor.license_number,
        payment_terms: vendor.payment_terms,
        lead_time_days: (vendor as unknown as Record<string, unknown>).lead_time_days as number | null || null,
        status: vendor.status,
        notes: vendor.notes,
        product_count: productCount ?? 0,
        avg_rating: avgRating,
        rating_count: ratings?.length ?? 0,
      };
    },
    enabled: !!tenantId && !!vendorName,
  });
}
