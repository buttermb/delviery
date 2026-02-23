/**
 * Export Tenants Utility
 * Export tenant data to CSV or JSON
 */

import { exportToCSV, exportToJSON } from '@/lib/utils/exportData';

export interface TenantExportData {
  id: string;
  business_name: string;
  slug: string;
  owner_email: string;
  owner_name: string;
  phone: string;
  subscription_plan: string;
  subscription_status: string;
  mrr: number;
  created_at: string;
  last_activity_at: string;
  customers: number;
  menus: number;
  products: number;
}

/**
 * Export tenants to CSV
 */
export async function exportTenantsToCSV(tenants: any[]): Promise<void> {
  const data = tenants.map((tenant) => ({
    'Business Name': tenant.business_name,
    'Owner Email': tenant.owner_email,
    'Owner Name': tenant.owner_name || '',
    'Phone': tenant.phone || '',
    'Plan': tenant.subscription_plan,
    'Status': tenant.subscription_status,
    'MRR': tenant.mrr || 0,
    'Customers': tenant.usage?.customers || 0,
    'Menus': tenant.usage?.menus || 0,
    'Products': tenant.usage?.products || 0,
    'Created': new Date(tenant.created_at).toLocaleDateString(),
    'Last Activity': tenant.last_activity_at
      ? new Date(tenant.last_activity_at).toLocaleDateString()
      : 'Never',
  }));

  exportToCSV(data, `tenants-export-${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Export tenants to JSON
 */
export async function exportTenantsToJSON(tenants: any[]): Promise<void> {
  const data = tenants.map((tenant) => ({
    id: tenant.id,
    business_name: tenant.business_name,
    slug: tenant.slug,
    owner_email: tenant.owner_email,
    owner_name: tenant.owner_name,
    phone: tenant.phone,
    subscription_plan: tenant.subscription_plan,
    subscription_status: tenant.subscription_status,
    mrr: tenant.mrr || 0,
    limits: tenant.limits,
    usage: tenant.usage,
    features: tenant.features,
    created_at: tenant.created_at,
    last_activity_at: tenant.last_activity_at,
  }));

  exportToJSON(data, `tenants-export-${new Date().toISOString().split('T')[0]}.json`);
}

