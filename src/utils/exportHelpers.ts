import { format } from 'date-fns';

/**
 * Export data to CSV format
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export access logs to CSV
 */
export const exportAccessLogs = (logs: any[]) => {
  const formattedLogs = logs.map(log => ({
    'Access Time': format(new Date(log.accessed_at), 'yyyy-MM-dd HH:mm:ss'),
    'Customer': log.customer_name || 'Unknown',
    'Phone': log.customer_phone || 'N/A',
    'IP Address': log.ip_address || 'Unknown',
    'Location': log.location || 'Unknown',
    'Device': log.device_info || 'Unknown',
    'Duration (seconds)': log.duration_seconds || 0,
    'Actions': log.actions_taken || 'View',
    'Menu': log.menu_name || 'Unknown'
  }));

  exportToCSV(formattedLogs, 'menu_access_logs');
};

/**
 * Export security events to CSV
 */
export const exportSecurityEvents = (events: any[]) => {
  const formattedEvents = events.map(event => ({
    'Time': format(new Date(event.created_at), 'yyyy-MM-dd HH:mm:ss'),
    'Menu': event.menu_name || 'Unknown',
    'Event Type': event.event_type,
    'Severity': event.severity,
    'Description': event.description,
    'Customer': event.metadata?.customer_name || 'Unknown',
    'IP Address': event.metadata?.ip_address || 'Unknown',
    'Location': event.metadata?.location || 'Unknown'
  }));

  exportToCSV(formattedEvents, 'security_events');
};

/**
 * Export menu analytics to CSV
 */
export const exportMenuAnalytics = (menu: any, logs: any[], orders: any[]) => {
  const analytics = {
    'Menu Name': menu.name,
    'Created': format(new Date(menu.created_at), 'yyyy-MM-dd HH:mm:ss'),
    'Status': menu.status,
    'Total Views': logs.length,
    'Unique Visitors': new Set(logs.map(l => l.customer_id || l.ip_address)).size,
    'Total Orders': orders.length,
    'Total Revenue': orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0).toFixed(2),
    'Conversion Rate': logs.length > 0 ? ((orders.length / logs.length) * 100).toFixed(2) + '%' : '0%',
    'Average Order Value': orders.length > 0 
      ? (orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) / orders.length).toFixed(2)
      : '0'
  };

  exportToCSV([analytics], `menu_analytics_${menu.name.replace(/\s+/g, '_')}`);
};

/**
 * Export orders to CSV
 */
export const exportOrders = (orders: any[]) => {
  const formattedOrders = orders.map(order => ({
    'Order ID': order.id,
    'Date': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
    'Customer': order.customer_name || 'Unknown',
    'Phone': order.customer_phone || 'N/A',
    'Menu': order.menu_name || 'Unknown',
    'Items': order.items_count || 0,
    'Total Amount': parseFloat(order.total_amount || 0).toFixed(2),
    'Status': order.status,
    'Delivery Method': order.delivery_method || 'N/A',
    'Payment Method': order.payment_method || 'N/A'
  }));

  exportToCSV(formattedOrders, 'menu_orders');
};
