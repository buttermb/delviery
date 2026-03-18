export interface ReportField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  category: string;
}

export const REPORT_TYPES = {
  pos: 'POS Transactions',
  inventory: 'Inventory',
  sales: 'Sales & Orders',
  shifts: 'POS Shifts',
  customers: 'Customers',
  products: 'Products',
} as const;

export const REPORT_FIELDS: Record<string, ReportField[]> = {
  pos: [
    { id: 'transaction_number', label: 'Transaction #', type: 'text', category: 'Basic' },
    { id: 'created_at', label: 'Date', type: 'date', category: 'Basic' },
    { id: 'total_amount', label: 'Amount', type: 'currency', category: 'Financial' },
    { id: 'payment_method', label: 'Payment Method', type: 'text', category: 'Payment' },
    { id: 'payment_status', label: 'Status', type: 'text', category: 'Payment' },
    { id: 'shift_id', label: 'Shift', type: 'text', category: 'Basic' },
    { id: 'cashier_name', label: 'Cashier', type: 'text', category: 'Basic' },
    { id: 'items_count', label: 'Items Count', type: 'number', category: 'Details' },
    { id: 'subtotal', label: 'Subtotal', type: 'currency', category: 'Financial' },
    { id: 'tax_amount', label: 'Tax', type: 'currency', category: 'Financial' },
    { id: 'discount_amount', label: 'Discount', type: 'currency', category: 'Financial' },
  ],
  shifts: [
    { id: 'shift_number', label: 'Shift #', type: 'text', category: 'Basic' },
    { id: 'cashier_name', label: 'Cashier', type: 'text', category: 'Basic' },
    { id: 'terminal_id', label: 'Terminal', type: 'text', category: 'Basic' },
    { id: 'started_at', label: 'Started', type: 'date', category: 'Timing' },
    { id: 'ended_at', label: 'Ended', type: 'date', category: 'Timing' },
    { id: 'status', label: 'Status', type: 'text', category: 'Basic' },
    { id: 'total_sales', label: 'Total Sales', type: 'currency', category: 'Financial' },
    { id: 'total_transactions', label: 'Transactions', type: 'number', category: 'Activity' },
    { id: 'cash_sales', label: 'Cash Sales', type: 'currency', category: 'Financial' },
    { id: 'card_sales', label: 'Card Sales', type: 'currency', category: 'Financial' },
    { id: 'opening_cash', label: 'Opening Cash', type: 'currency', category: 'Cash Drawer' },
    { id: 'closing_cash', label: 'Closing Cash', type: 'currency', category: 'Cash Drawer' },
    { id: 'cash_difference', label: 'Cash Difference', type: 'currency', category: 'Cash Drawer' },
  ],
  inventory: [
    { id: 'product_name', label: 'Product Name', type: 'text', category: 'Basic' },
    { id: 'sku', label: 'SKU', type: 'text', category: 'Basic' },
    { id: 'quantity_lbs', label: 'Quantity (lbs)', type: 'number', category: 'Stock' },
    { id: 'quantity_units', label: 'Quantity (units)', type: 'number', category: 'Stock' },
    { id: 'reorder_point', label: 'Reorder Point', type: 'number', category: 'Stock' },
    { id: 'unit_cost', label: 'Unit Cost', type: 'currency', category: 'Financial' },
    { id: 'total_value', label: 'Total Value', type: 'currency', category: 'Financial' },
    { id: 'location', label: 'Location', type: 'text', category: 'Basic' },
    { id: 'last_restock_date', label: 'Last Restock', type: 'date', category: 'Activity' },
  ],
  sales: [
    { id: 'order_number', label: 'Order #', type: 'text', category: 'Basic' },
    { id: 'customer_name', label: 'Customer', type: 'text', category: 'Customer' },
    { id: 'created_at', label: 'Order Date', type: 'date', category: 'Timing' },
    { id: 'status', label: 'Status', type: 'text', category: 'Basic' },
    { id: 'total_amount', label: 'Total', type: 'currency', category: 'Financial' },
    { id: 'subtotal', label: 'Subtotal', type: 'currency', category: 'Financial' },
    { id: 'delivery_fee', label: 'Delivery Fee', type: 'currency', category: 'Financial' },
    { id: 'payment_method', label: 'Payment Method', type: 'text', category: 'Payment' },
    { id: 'payment_status', label: 'Payment Status', type: 'text', category: 'Payment' },
    { id: 'delivery_borough', label: 'Borough', type: 'text', category: 'Delivery' },
  ],
  customers: [
    { id: 'full_name', label: 'Name', type: 'text', category: 'Basic' },
    { id: 'email', label: 'Email', type: 'text', category: 'Contact' },
    { id: 'phone', label: 'Phone', type: 'text', category: 'Contact' },
    { id: 'total_orders', label: 'Total Orders', type: 'number', category: 'Activity' },
    { id: 'total_spent', label: 'Total Spent', type: 'currency', category: 'Financial' },
    { id: 'avg_order_value', label: 'Avg Order Value', type: 'currency', category: 'Financial' },
    { id: 'created_at', label: 'Customer Since', type: 'date', category: 'Timing' },
    { id: 'last_order_date', label: 'Last Order', type: 'date', category: 'Activity' },
  ],
  products: [
    { id: 'name', label: 'Product Name', type: 'text', category: 'Basic' },
    { id: 'category', label: 'Category', type: 'text', category: 'Basic' },
    { id: 'price', label: 'Price', type: 'currency', category: 'Pricing' },
    { id: 'stock', label: 'Stock Level', type: 'number', category: 'Inventory' },
    { id: 'total_sold', label: 'Total Sold', type: 'number', category: 'Sales' },
    { id: 'revenue', label: 'Revenue', type: 'currency', category: 'Sales' },
    { id: 'average_rating', label: 'Rating', type: 'number', category: 'Reviews' },
    { id: 'review_count', label: 'Review Count', type: 'number', category: 'Reviews' },
  ],
};

export const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export const SCHEDULE_OPTIONS = [
  { value: 'none', label: 'No Schedule (Manual Only)' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
