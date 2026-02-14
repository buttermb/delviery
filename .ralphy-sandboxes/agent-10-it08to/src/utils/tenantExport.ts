/**
 * Tenant Export Utilities
 * Functions to export tenant data to various formats
 */

export function exportTenantsToCSV(tenants: any[]) {
  const headers = ['Business Name', 'Owner Email', 'Plan', 'Status', 'MRR', 'Created At'];
  const rows = tenants.map(t => [
    t.business_name,
    t.owner_email,
    t.subscription_plan,
    t.subscription_status,
    t.mrr || 0,
    t.created_at
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenants-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTenantsToJSON(tenants: any[]) {
  const jsonContent = JSON.stringify(tenants, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenants-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
