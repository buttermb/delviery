import { format } from 'date-fns';

/**
 * Export utilities for disposable menus analytics
 */

// Convert array of objects to CSV
const arrayToCSV = (data: Record<string, unknown>[], headers: string[]): string => {
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      const escaped = String(value ?? '').replace(/"/g, '""');
      return escaped.includes(',') ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

// Download CSV file
const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/**
 * Export access logs to CSV
 */
export const exportAccessLogs = (logs: Array<Record<string, unknown> & { whitelist?: Record<string, unknown> }>) => {
  const data = logs.map(log => ({
    menu_name: log.menu_name || 'N/A',
    customer_name: log.whitelist?.customer_name || 'Anonymous',
    customer_phone: log.whitelist?.customer_phone || 'N/A',
    accessed_at: format(new Date(String(log.accessed_at)), 'yyyy-MM-dd HH:mm:ss'),
    ip_address: log.ip_address || 'Unknown',
    user_agent: log.user_agent || 'Unknown',
    device_fingerprint: log.device_fingerprint || 'N/A',
    access_code_correct: log.access_code_correct ? 'Yes' : 'No',
    action: log.action || 'viewed'
  }));

  const headers = [
    'menu_name',
    'customer_name',
    'customer_phone',
    'accessed_at',
    'ip_address',
    'user_agent',
    'device_fingerprint',
    'access_code_correct',
    'action'
  ];

  const csv = arrayToCSV(data, headers);
  const filename = `access-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
  downloadCSV(csv, filename);
};

/**
 * Export orders to CSV
 */
export const exportOrders = (orders: Array<Record<string, unknown> & { whitelist?: Record<string, unknown> }>) => {
  const data = orders.map(order => ({
    menu_name: order.menu_name || 'N/A',
    order_id: order.id,
    customer_name: order.whitelist?.customer_name || 'N/A',
    customer_phone: order.whitelist?.customer_phone || order.contact_phone || 'N/A',
    total_amount: parseFloat(String(order.total_amount ?? 0)).toFixed(2),
    status: order.status || 'pending',
    delivery_method: order.delivery_method || 'N/A',
    special_instructions: order.special_instructions ?? '',
    created_at: format(new Date(String(order.created_at)), 'yyyy-MM-dd HH:mm:ss'),
    order_items: JSON.stringify(order.order_items ?? [])
  }));

  const headers = [
    'menu_name',
    'order_id',
    'customer_name',
    'customer_phone',
    'total_amount',
    'status',
    'delivery_method',
    'special_instructions',
    'created_at',
    'order_items'
  ];

  const csv = arrayToCSV(data, headers);
  const filename = `orders-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
  downloadCSV(csv, filename);
};

/**
 * Export menu analytics summary to CSV
 */
export const exportMenuAnalytics = (menu: Record<string, unknown>, accessLogs: Array<Record<string, unknown>>, orders: Array<Record<string, unknown>>) => {
  const totalViews = accessLogs.length;
  const uniqueVisitors = new Set(accessLogs.map(log => log.access_whitelist_id || log.ip_address)).size;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(String(order.total_amount ?? 0)), 0);
  const conversionRate = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(2) : '0.00';
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00';

  const data = [{
    menu_name: menu.name,
    menu_id: menu.id,
    status: menu.status,
    created_at: format(new Date(String(menu.created_at)), 'yyyy-MM-dd HH:mm:ss'),
    total_views: totalViews,
    unique_visitors: uniqueVisitors,
    total_orders: totalOrders,
    total_revenue: totalRevenue.toFixed(2),
    conversion_rate: `${conversionRate}%`,
    avg_order_value: avgOrderValue,
    screenshot_protection: menu.screenshot_protection_enabled ? 'Yes' : 'No',
    device_locking: menu.device_locking_enabled ? 'Yes' : 'No',
    geofencing: menu.geofence_enabled ? 'Yes' : 'No',
    expiration_date: menu.expiration_date ? format(new Date(String(menu.expiration_date)), 'yyyy-MM-dd') : 'Never'
  }];

  const headers = [
    'menu_name',
    'menu_id',
    'status',
    'created_at',
    'total_views',
    'unique_visitors',
    'total_orders',
    'total_revenue',
    'conversion_rate',
    'avg_order_value',
    'screenshot_protection',
    'device_locking',
    'geofencing',
    'expiration_date'
  ];

  const csv = arrayToCSV(data, headers);
  const filename = `menu-analytics-${String(menu.name).replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
  downloadCSV(csv, filename);
};

/**
 * Export security events to CSV
 */
export const exportSecurityEvents = (events: Array<Record<string, unknown> & { menu?: Record<string, unknown>; whitelist?: Record<string, unknown> }>) => {
  const data = events.map(event => ({
    menu_name: event.menu?.name || 'N/A',
    event_type: event.event_type || 'unknown',
    severity: event.severity || 'low',
    description: event.description ?? '',
    customer_name: event.whitelist?.customer_name || 'N/A',
    ip_address: event.ip_address || 'Unknown',
    device_fingerprint: event.device_fingerprint || 'N/A',
    blocked: event.blocked ? 'Yes' : 'No',
    resolved: event.resolved ? 'Yes' : 'No',
    created_at: format(new Date(String(event.created_at)), 'yyyy-MM-dd HH:mm:ss'),
    details: JSON.stringify(event.metadata || {})
  }));

  const headers = [
    'menu_name',
    'event_type',
    'severity',
    'description',
    'customer_name',
    'ip_address',
    'device_fingerprint',
    'blocked',
    'resolved',
    'created_at',
    'details'
  ];

  const csv = arrayToCSV(data, headers);
  const filename = `security-events-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
  downloadCSV(csv, filename);
};

/**
 * Export whitelist to CSV
 */
export const exportWhitelist = (whitelist: Array<Record<string, unknown>>, menuName: string) => {
  const data = whitelist.map(entry => ({
    customer_name: entry.customer_name || 'N/A',
    customer_phone: entry.customer_phone || 'N/A',
    customer_email: entry.customer_email || 'N/A',
    status: entry.status || 'pending',
    invited_at: format(new Date(String(entry.invited_at)), 'yyyy-MM-dd HH:mm:ss'),
    first_access_at: entry.first_access_at ? format(new Date(String(entry.first_access_at)), 'yyyy-MM-dd HH:mm:ss') : 'Never',
    last_access_at: entry.last_access_at ? format(new Date(String(entry.last_access_at)), 'yyyy-MM-dd HH:mm:ss') : 'Never',
    view_count: entry.view_count ?? 0,
    unique_access_token: entry.unique_access_token
  }));

  const headers = [
    'customer_name',
    'customer_phone',
    'customer_email',
    'status',
    'invited_at',
    'first_access_at',
    'last_access_at',
    'view_count',
    'unique_access_token'
  ];

  const csv = arrayToCSV(data, headers);
  const filename = `whitelist-${menuName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
  downloadCSV(csv, filename);
};
