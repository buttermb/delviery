import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface VendorWithStats {
    id: string;
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    website?: string | null;
    license_number: string | null;
    notes: string | null;
    status: string | null;
    account_id: string;
    created_at: string | null;
    updated_at: string | null;
    // Stats from POs
    total_orders: number;
    total_spent: number;
    last_order_date: string | null;
}

export interface VendorOrder {
    id: string;
    po_number: string | null;
    status: string | null;
    total: number | null;
    expected_delivery_date: string | null;
    created_at: string | null;
    notes: string | null;
}

export function useVendorsWithStats() {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: queryKeys.vendorOrdersHook.list(tenant?.id, { withStats: true }),
        queryFn: async () => {
            if (!tenant?.id) return [];

            // Get vendors
            const { data: vendors, error: vendorsError } = await supabase
                .from('vendors')
                .select('*')
                .eq('account_id', tenant.id)
                .order('name');

            if (vendorsError) {
                logger.error('Failed to fetch vendors', vendorsError, { component: 'useVendorsWithStats' });
                throw vendorsError;
            }

            if (!vendors || vendors.length === 0) {
                return [];
            }

            // Get purchase order stats per vendor
            const vendorIds = vendors.map(v => v.id);
            const { data: purchaseOrders, error: poError } = await supabase
                .from('purchase_orders')
                .select('vendor_id, total, created_at')
                .eq('tenant_id', tenant.id)
                .in('vendor_id', vendorIds);

            if (poError) {
                logger.error('Failed to fetch purchase orders for vendors', poError, { component: 'useVendorsWithStats' });
                // Continue without stats if PO fetch fails
            }

            // Aggregate stats per vendor
            const statsMap = new Map<string, { totalOrders: number; totalSpent: number; lastOrderDate: string | null }>();

            if (purchaseOrders) {
                for (const po of purchaseOrders) {
                    const existing = statsMap.get(po.vendor_id) || { totalOrders: 0, totalSpent: 0, lastOrderDate: null };
                    existing.totalOrders += 1;
                    existing.totalSpent += Number(po.total || 0);
                    if (po.created_at && (!existing.lastOrderDate || po.created_at > existing.lastOrderDate)) {
                        existing.lastOrderDate = po.created_at;
                    }
                    statsMap.set(po.vendor_id, existing);
                }
            }

            // Combine vendors with stats
            return vendors.map(vendor => {
                const stats = statsMap.get(vendor.id) || { totalOrders: 0, totalSpent: 0, lastOrderDate: null };
                return {
                    ...vendor,
                    total_orders: stats.totalOrders,
                    total_spent: stats.totalSpent,
                    last_order_date: stats.lastOrderDate,
                } as unknown as VendorWithStats;
            });
        },
        enabled: !!tenant?.id,
        staleTime: 30000, // 30 seconds
    });
}

export function useVendorOrders(vendorId: string | null) {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: queryKeys.vendors.orders(tenant?.id ?? '', vendorId ?? ''),
        queryFn: async () => {
            if (!tenant?.id || !vendorId) return [];

            const { data, error } = await supabase
                .from('purchase_orders')
                .select('id, po_number, status, total, expected_delivery_date, created_at, notes')
                .eq('tenant_id', tenant.id)
                .eq('vendor_id', vendorId)
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Failed to fetch vendor orders', error, { component: 'useVendorOrders', vendorId });
                throw error;
            }

            return (data ?? []) as VendorOrder[];
        },
        enabled: !!tenant?.id && !!vendorId,
        staleTime: 30000, // 30 seconds
    });
}
