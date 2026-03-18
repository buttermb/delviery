-- Add data source configuration fields to custom_reports table
-- This enables custom report queries from multiple data sources

-- Add new columns for data source configuration
ALTER TABLE public.custom_reports
  ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metrics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dimensions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visualization_type TEXT DEFAULT 'table',
  ADD COLUMN IF NOT EXISTS chart_config JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

-- Create index for faster template lookups
CREATE INDEX IF NOT EXISTS idx_custom_reports_is_template
  ON public.custom_reports(is_template) WHERE is_template = true;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_custom_reports_tenant_id
  ON public.custom_reports(tenant_id);

-- Create report_data_sources configuration table for defining available data sources
CREATE TABLE IF NOT EXISTS public.report_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('table', 'view', 'rpc')),
  source_table TEXT,
  source_rpc TEXT,
  available_fields JSONB DEFAULT '[]',
  available_metrics JSONB DEFAULT '[]',
  available_dimensions JSONB DEFAULT '[]',
  requires_tenant_filter BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on report_data_sources (read-only for all authenticated users)
ALTER TABLE public.report_data_sources ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read data sources
CREATE POLICY "Authenticated users can read data sources"
  ON public.report_data_sources
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Grant read access
GRANT SELECT ON public.report_data_sources TO authenticated;

-- Insert default data sources available for custom reports
INSERT INTO public.report_data_sources (name, display_name, description, source_type, source_table, available_fields, available_metrics, available_dimensions) VALUES
-- Orders data source
('orders', 'Orders', 'Customer orders and transactions', 'table', 'orders',
  '[{"id": "id", "label": "Order ID", "type": "text"}, {"id": "created_at", "label": "Order Date", "type": "date"}, {"id": "status", "label": "Status", "type": "text"}, {"id": "total_amount", "label": "Total Amount", "type": "currency"}, {"id": "payment_status", "label": "Payment Status", "type": "text"}, {"id": "payment_method", "label": "Payment Method", "type": "text"}]'::jsonb,
  '[{"id": "total_revenue", "label": "Total Revenue", "aggregation": "sum", "field": "total_amount"}, {"id": "order_count", "label": "Order Count", "aggregation": "count"}, {"id": "avg_order_value", "label": "Average Order Value", "aggregation": "avg", "field": "total_amount"}]'::jsonb,
  '[{"id": "status", "label": "Order Status"}, {"id": "payment_method", "label": "Payment Method"}, {"id": "date", "label": "Date", "date_field": "created_at"}]'::jsonb
),
-- Products data source
('products', 'Products', 'Product catalog and inventory', 'table', 'products',
  '[{"id": "id", "label": "Product ID", "type": "text"}, {"id": "name", "label": "Product Name", "type": "text"}, {"id": "sku", "label": "SKU", "type": "text"}, {"id": "price", "label": "Price", "type": "currency"}, {"id": "stock_quantity", "label": "Stock", "type": "number"}, {"id": "category", "label": "Category", "type": "text"}]'::jsonb,
  '[{"id": "product_count", "label": "Product Count", "aggregation": "count"}, {"id": "total_stock", "label": "Total Stock", "aggregation": "sum", "field": "stock_quantity"}, {"id": "avg_price", "label": "Average Price", "aggregation": "avg", "field": "price"}]'::jsonb,
  '[{"id": "category", "label": "Category"}, {"id": "status", "label": "Status"}]'::jsonb
),
-- Customers data source
('customers', 'Customers', 'Customer records and metrics', 'table', 'customers',
  '[{"id": "id", "label": "Customer ID", "type": "text"}, {"id": "full_name", "label": "Name", "type": "text"}, {"id": "email", "label": "Email", "type": "text"}, {"id": "phone", "label": "Phone", "type": "text"}, {"id": "created_at", "label": "Customer Since", "type": "date"}]'::jsonb,
  '[{"id": "customer_count", "label": "Customer Count", "aggregation": "count"}, {"id": "new_customers", "label": "New Customers", "aggregation": "count", "filter": {"date_range": "period"}}]'::jsonb,
  '[{"id": "date", "label": "Registration Date", "date_field": "created_at"}]'::jsonb
),
-- Wholesale Orders data source
('wholesale_orders', 'Wholesale Orders', 'B2B wholesale order transactions', 'table', 'wholesale_orders',
  '[{"id": "id", "label": "Order ID", "type": "text"}, {"id": "order_number", "label": "Order #", "type": "text"}, {"id": "created_at", "label": "Order Date", "type": "date"}, {"id": "status", "label": "Status", "type": "text"}, {"id": "total_amount", "label": "Total Amount", "type": "currency"}, {"id": "payment_status", "label": "Payment Status", "type": "text"}]'::jsonb,
  '[{"id": "wholesale_revenue", "label": "Wholesale Revenue", "aggregation": "sum", "field": "total_amount"}, {"id": "wholesale_order_count", "label": "Order Count", "aggregation": "count"}, {"id": "avg_wholesale_order", "label": "Avg Order Value", "aggregation": "avg", "field": "total_amount"}]'::jsonb,
  '[{"id": "status", "label": "Order Status"}, {"id": "payment_status", "label": "Payment Status"}, {"id": "date", "label": "Date", "date_field": "created_at"}]'::jsonb
),
-- Wholesale Clients data source
('wholesale_clients', 'Wholesale Clients', 'B2B client accounts', 'table', 'wholesale_clients',
  '[{"id": "id", "label": "Client ID", "type": "text"}, {"id": "business_name", "label": "Business Name", "type": "text"}, {"id": "contact_name", "label": "Contact Name", "type": "text"}, {"id": "email", "label": "Email", "type": "text"}, {"id": "status", "label": "Status", "type": "text"}, {"id": "created_at", "label": "Client Since", "type": "date"}]'::jsonb,
  '[{"id": "client_count", "label": "Client Count", "aggregation": "count"}, {"id": "active_clients", "label": "Active Clients", "aggregation": "count", "filter": {"status": "active"}}]'::jsonb,
  '[{"id": "status", "label": "Client Status"}, {"id": "date", "label": "Registration Date", "date_field": "created_at"}]'::jsonb
),
-- Inventory data source
('inventory', 'Inventory', 'Stock levels and movements', 'table', 'wholesale_inventory',
  '[{"id": "id", "label": "Item ID", "type": "text"}, {"id": "product_name", "label": "Product", "type": "text"}, {"id": "sku", "label": "SKU", "type": "text"}, {"id": "quantity", "label": "Quantity", "type": "number"}, {"id": "unit_cost", "label": "Unit Cost", "type": "currency"}, {"id": "location", "label": "Location", "type": "text"}]'::jsonb,
  '[{"id": "total_items", "label": "Total Items", "aggregation": "count"}, {"id": "total_quantity", "label": "Total Quantity", "aggregation": "sum", "field": "quantity"}, {"id": "total_value", "label": "Total Inventory Value", "aggregation": "sum", "expression": "quantity * unit_cost"}]'::jsonb,
  '[{"id": "location", "label": "Location"}, {"id": "category", "label": "Category"}]'::jsonb
),
-- POS Transactions data source
('pos_transactions', 'POS Transactions', 'Point of sale transaction records', 'table', 'pos_transactions',
  '[{"id": "id", "label": "Transaction ID", "type": "text"}, {"id": "transaction_number", "label": "Transaction #", "type": "text"}, {"id": "created_at", "label": "Date", "type": "date"}, {"id": "total_amount", "label": "Amount", "type": "currency"}, {"id": "payment_method", "label": "Payment Method", "type": "text"}, {"id": "status", "label": "Status", "type": "text"}]'::jsonb,
  '[{"id": "pos_revenue", "label": "POS Revenue", "aggregation": "sum", "field": "total_amount"}, {"id": "transaction_count", "label": "Transaction Count", "aggregation": "count"}, {"id": "avg_transaction", "label": "Avg Transaction", "aggregation": "avg", "field": "total_amount"}]'::jsonb,
  '[{"id": "payment_method", "label": "Payment Method"}, {"id": "status", "label": "Status"}, {"id": "date", "label": "Date", "date_field": "created_at"}]'::jsonb
),
-- POS Shifts data source
('pos_shifts', 'POS Shifts', 'POS shift and drawer management', 'table', 'pos_shifts',
  '[{"id": "id", "label": "Shift ID", "type": "text"}, {"id": "shift_number", "label": "Shift #", "type": "text"}, {"id": "started_at", "label": "Start Time", "type": "date"}, {"id": "ended_at", "label": "End Time", "type": "date"}, {"id": "status", "label": "Status", "type": "text"}, {"id": "total_sales", "label": "Total Sales", "type": "currency"}]'::jsonb,
  '[{"id": "shift_count", "label": "Shift Count", "aggregation": "count"}, {"id": "total_shift_sales", "label": "Total Shift Sales", "aggregation": "sum", "field": "total_sales"}, {"id": "avg_shift_sales", "label": "Avg Shift Sales", "aggregation": "avg", "field": "total_sales"}]'::jsonb,
  '[{"id": "status", "label": "Shift Status"}, {"id": "date", "label": "Date", "date_field": "started_at"}]'::jsonb
),
-- Marketplace Orders data source
('marketplace_orders', 'Marketplace Orders', 'Storefront marketplace orders', 'table', 'marketplace_orders',
  '[{"id": "id", "label": "Order ID", "type": "text"}, {"id": "order_number", "label": "Order #", "type": "text"}, {"id": "created_at", "label": "Order Date", "type": "date"}, {"id": "status", "label": "Status", "type": "text"}, {"id": "total", "label": "Total", "type": "currency"}, {"id": "payment_status", "label": "Payment Status", "type": "text"}]'::jsonb,
  '[{"id": "marketplace_revenue", "label": "Marketplace Revenue", "aggregation": "sum", "field": "total"}, {"id": "marketplace_order_count", "label": "Order Count", "aggregation": "count"}, {"id": "avg_marketplace_order", "label": "Avg Order", "aggregation": "avg", "field": "total"}]'::jsonb,
  '[{"id": "status", "label": "Order Status"}, {"id": "payment_status", "label": "Payment Status"}, {"id": "date", "label": "Date", "date_field": "created_at"}]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Create report_executions table for tracking report generation history
CREATE TABLE IF NOT EXISTS public.report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.custom_reports(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  executed_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  filters JSONB DEFAULT '{}',
  result_summary JSONB DEFAULT '{}',
  row_count INTEGER,
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on report_executions
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

-- Policy for tenant-based access to report executions
CREATE POLICY "Tenant Access" ON public.report_executions
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Grant access
GRANT ALL ON public.report_executions TO authenticated;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON public.report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_tenant_id ON public.report_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_executed_at ON public.report_executions(executed_at DESC);

-- Create function to get available data sources for a tenant
CREATE OR REPLACE FUNCTION public.get_report_data_sources()
RETURNS SETOF public.report_data_sources
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.report_data_sources WHERE is_active = true ORDER BY display_name;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_report_data_sources() TO authenticated;
