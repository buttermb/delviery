/**
 * Report Data Sources Configuration
 * Defines available data sources for custom report queries
 */

export interface DataSourceField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
}

export interface DataSourceMetric {
  id: string;
  label: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max';
  field?: string;
  expression?: string;
  filter?: Record<string, unknown>;
}

export interface DataSourceDimension {
  id: string;
  label: string;
  date_field?: string;
}

export interface ReportDataSource {
  id: string;
  name: string;
  display_name: string;
  description: string;
  source_type: 'table' | 'view' | 'rpc';
  source_table: string | null;
  source_rpc: string | null;
  available_fields: DataSourceField[];
  available_metrics: DataSourceMetric[];
  available_dimensions: DataSourceDimension[];
  requires_tenant_filter: boolean;
  is_active: boolean;
}

export interface ReportConfig {
  name: string;
  description?: string;
  data_sources: string[];
  metrics: string[];
  dimensions: string[];
  filters: ReportFilter[];
  date_range: DateRangeConfig;
  visualization_type: VisualizationType;
  chart_config?: ChartConfig;
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | null;
  data_source: string;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'is_null'
  | 'is_not_null'
  | 'in'
  | 'not_in';

export interface DateRangeConfig {
  preset?: DateRangePreset;
  start_date?: string;
  end_date?: string;
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export type VisualizationType =
  | 'table'
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'area_chart'
  | 'metric_cards';

export interface ChartConfig {
  x_axis?: string;
  y_axis?: string;
  group_by?: string;
  stack?: boolean;
  colors?: string[];
  show_legend?: boolean;
  show_labels?: boolean;
}

/**
 * Default data sources available for all tenants
 * These match the database seed data in the migration
 */
export const DEFAULT_DATA_SOURCES: Omit<ReportDataSource, 'id' | 'is_active'>[] = [
  {
    name: 'orders',
    display_name: 'Orders',
    description: 'Customer orders and transactions',
    source_type: 'table',
    source_table: 'orders',
    source_rpc: null,
    requires_tenant_filter: true,
    available_fields: [
      { id: 'id', label: 'Order ID', type: 'text' },
      { id: 'created_at', label: 'Order Date', type: 'date' },
      { id: 'status', label: 'Status', type: 'text' },
      { id: 'total_amount', label: 'Total Amount', type: 'currency' },
      { id: 'payment_status', label: 'Payment Status', type: 'text' },
      { id: 'payment_method', label: 'Payment Method', type: 'text' },
    ],
    available_metrics: [
      { id: 'total_revenue', label: 'Total Revenue', aggregation: 'sum', field: 'total_amount' },
      { id: 'order_count', label: 'Order Count', aggregation: 'count' },
      { id: 'avg_order_value', label: 'Average Order Value', aggregation: 'avg', field: 'total_amount' },
    ],
    available_dimensions: [
      { id: 'status', label: 'Order Status' },
      { id: 'payment_method', label: 'Payment Method' },
      { id: 'date', label: 'Date', date_field: 'created_at' },
    ],
  },
  {
    name: 'products',
    display_name: 'Products',
    description: 'Product catalog and inventory',
    source_type: 'table',
    source_table: 'products',
    source_rpc: null,
    requires_tenant_filter: true,
    available_fields: [
      { id: 'id', label: 'Product ID', type: 'text' },
      { id: 'name', label: 'Product Name', type: 'text' },
      { id: 'sku', label: 'SKU', type: 'text' },
      { id: 'price', label: 'Price', type: 'currency' },
      { id: 'stock_quantity', label: 'Stock', type: 'number' },
      { id: 'category', label: 'Category', type: 'text' },
    ],
    available_metrics: [
      { id: 'product_count', label: 'Product Count', aggregation: 'count' },
      { id: 'total_stock', label: 'Total Stock', aggregation: 'sum', field: 'stock_quantity' },
      { id: 'avg_price', label: 'Average Price', aggregation: 'avg', field: 'price' },
    ],
    available_dimensions: [
      { id: 'category', label: 'Category' },
      { id: 'status', label: 'Status' },
    ],
  },
  {
    name: 'customers',
    display_name: 'Customers',
    description: 'Customer records and metrics',
    source_type: 'table',
    source_table: 'customers',
    source_rpc: null,
    requires_tenant_filter: true,
    available_fields: [
      { id: 'id', label: 'Customer ID', type: 'text' },
      { id: 'full_name', label: 'Name', type: 'text' },
      { id: 'email', label: 'Email', type: 'text' },
      { id: 'phone', label: 'Phone', type: 'text' },
      { id: 'created_at', label: 'Customer Since', type: 'date' },
    ],
    available_metrics: [
      { id: 'customer_count', label: 'Customer Count', aggregation: 'count' },
    ],
    available_dimensions: [
      { id: 'date', label: 'Registration Date', date_field: 'created_at' },
    ],
  },
  {
    name: 'wholesale_orders',
    display_name: 'Wholesale Orders',
    description: 'B2B wholesale order transactions',
    source_type: 'table',
    source_table: 'wholesale_orders',
    source_rpc: null,
    requires_tenant_filter: true,
    available_fields: [
      { id: 'id', label: 'Order ID', type: 'text' },
      { id: 'order_number', label: 'Order #', type: 'text' },
      { id: 'created_at', label: 'Order Date', type: 'date' },
      { id: 'status', label: 'Status', type: 'text' },
      { id: 'total_amount', label: 'Total Amount', type: 'currency' },
      { id: 'payment_status', label: 'Payment Status', type: 'text' },
    ],
    available_metrics: [
      { id: 'wholesale_revenue', label: 'Wholesale Revenue', aggregation: 'sum', field: 'total_amount' },
      { id: 'wholesale_order_count', label: 'Order Count', aggregation: 'count' },
      { id: 'avg_wholesale_order', label: 'Avg Order Value', aggregation: 'avg', field: 'total_amount' },
    ],
    available_dimensions: [
      { id: 'status', label: 'Order Status' },
      { id: 'payment_status', label: 'Payment Status' },
      { id: 'date', label: 'Date', date_field: 'created_at' },
    ],
  },
  {
    name: 'wholesale_clients',
    display_name: 'Wholesale Clients',
    description: 'B2B client accounts',
    source_type: 'table',
    source_table: 'wholesale_clients',
    source_rpc: null,
    requires_tenant_filter: true,
    available_fields: [
      { id: 'id', label: 'Client ID', type: 'text' },
      { id: 'business_name', label: 'Business Name', type: 'text' },
      { id: 'contact_name', label: 'Contact Name', type: 'text' },
      { id: 'email', label: 'Email', type: 'text' },
      { id: 'status', label: 'Status', type: 'text' },
      { id: 'created_at', label: 'Client Since', type: 'date' },
    ],
    available_metrics: [
      { id: 'client_count', label: 'Client Count', aggregation: 'count' },
    ],
    available_dimensions: [
      { id: 'status', label: 'Client Status' },
      { id: 'date', label: 'Registration Date', date_field: 'created_at' },
    ],
  },
  {
    name: 'pos_transactions',
    display_name: 'POS Transactions',
    description: 'Point of sale transaction records',
    source_type: 'table',
    source_table: 'pos_transactions',
    source_rpc: null,
    requires_tenant_filter: true,
    available_fields: [
      { id: 'id', label: 'Transaction ID', type: 'text' },
      { id: 'transaction_number', label: 'Transaction #', type: 'text' },
      { id: 'created_at', label: 'Date', type: 'date' },
      { id: 'total_amount', label: 'Amount', type: 'currency' },
      { id: 'payment_method', label: 'Payment Method', type: 'text' },
      { id: 'status', label: 'Status', type: 'text' },
    ],
    available_metrics: [
      { id: 'pos_revenue', label: 'POS Revenue', aggregation: 'sum', field: 'total_amount' },
      { id: 'transaction_count', label: 'Transaction Count', aggregation: 'count' },
      { id: 'avg_transaction', label: 'Avg Transaction', aggregation: 'avg', field: 'total_amount' },
    ],
    available_dimensions: [
      { id: 'payment_method', label: 'Payment Method' },
      { id: 'status', label: 'Status' },
      { id: 'date', label: 'Date', date_field: 'created_at' },
    ],
  },
  {
    name: 'marketplace_orders',
    display_name: 'Marketplace Orders',
    description: 'Storefront marketplace orders',
    source_type: 'table',
    source_table: 'marketplace_orders',
    source_rpc: null,
    requires_tenant_filter: false, // Uses store_id instead
    available_fields: [
      { id: 'id', label: 'Order ID', type: 'text' },
      { id: 'order_number', label: 'Order #', type: 'text' },
      { id: 'created_at', label: 'Order Date', type: 'date' },
      { id: 'status', label: 'Status', type: 'text' },
      { id: 'total', label: 'Total', type: 'currency' },
      { id: 'payment_status', label: 'Payment Status', type: 'text' },
    ],
    available_metrics: [
      { id: 'marketplace_revenue', label: 'Marketplace Revenue', aggregation: 'sum', field: 'total' },
      { id: 'marketplace_order_count', label: 'Order Count', aggregation: 'count' },
      { id: 'avg_marketplace_order', label: 'Avg Order', aggregation: 'avg', field: 'total' },
    ],
    available_dimensions: [
      { id: 'status', label: 'Order Status' },
      { id: 'payment_status', label: 'Payment Status' },
      { id: 'date', label: 'Date', date_field: 'created_at' },
    ],
  },
];

/**
 * Date range presets with their labels
 */
export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

/**
 * Visualization types with their labels and icons
 */
export const VISUALIZATION_TYPES: { value: VisualizationType; label: string; icon: string }[] = [
  { value: 'table', label: 'Data Table', icon: 'table' },
  { value: 'bar_chart', label: 'Bar Chart', icon: 'bar-chart' },
  { value: 'line_chart', label: 'Line Chart', icon: 'line-chart' },
  { value: 'pie_chart', label: 'Pie Chart', icon: 'pie-chart' },
  { value: 'area_chart', label: 'Area Chart', icon: 'area-chart' },
  { value: 'metric_cards', label: 'Metric Cards', icon: 'layout-grid' },
];

/**
 * Filter operators with their labels
 */
export const FILTER_OPERATORS: { value: FilterOperator; label: string; applicableTo: string[] }[] = [
  { value: 'equals', label: 'Equals', applicableTo: ['text', 'number', 'date', 'boolean'] },
  { value: 'not_equals', label: 'Not Equals', applicableTo: ['text', 'number', 'date', 'boolean'] },
  { value: 'contains', label: 'Contains', applicableTo: ['text'] },
  { value: 'not_contains', label: 'Does Not Contain', applicableTo: ['text'] },
  { value: 'greater_than', label: 'Greater Than', applicableTo: ['number', 'date', 'currency'] },
  { value: 'less_than', label: 'Less Than', applicableTo: ['number', 'date', 'currency'] },
  { value: 'greater_or_equal', label: 'Greater or Equal', applicableTo: ['number', 'date', 'currency'] },
  { value: 'less_or_equal', label: 'Less or Equal', applicableTo: ['number', 'date', 'currency'] },
  { value: 'is_null', label: 'Is Empty', applicableTo: ['text', 'number', 'date', 'currency'] },
  { value: 'is_not_null', label: 'Is Not Empty', applicableTo: ['text', 'number', 'date', 'currency'] },
  { value: 'in', label: 'Is One Of', applicableTo: ['text', 'number'] },
  { value: 'not_in', label: 'Is Not One Of', applicableTo: ['text', 'number'] },
];

/**
 * Helper function to get operators for a field type
 */
export function getOperatorsForFieldType(fieldType: string): { value: FilterOperator; label: string }[] {
  return FILTER_OPERATORS
    .filter((op) => op.applicableTo.includes(fieldType))
    .map(({ value, label }) => ({ value, label }));
}
