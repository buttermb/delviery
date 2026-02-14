-- Marketplace Analytics RPC

CREATE OR REPLACE FUNCTION get_marketplace_analytics(p_store_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_revenue NUMERIC;
  v_total_orders INTEGER;
  v_active_customers INTEGER;
  v_recent_sales JSONB;
  v_chart_data JSONB;
  v_tenant_id UUID;
BEGIN
  -- Get tenant id from profile
  SELECT tenant_id INTO v_tenant_id FROM marketplace_profiles WHERE id = p_store_id;

  -- Total Revenue (Paid orders)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_revenue
  FROM marketplace_orders
  WHERE seller_tenant_id = v_tenant_id
  AND payment_status = 'paid';

  -- Total Orders
  SELECT COUNT(*)
  INTO v_total_orders
  FROM marketplace_orders
  WHERE seller_tenant_id = v_tenant_id;

  -- Active Customers (Unique Emails)
  SELECT COUNT(DISTINCT customer_email)
  INTO v_active_customers
  FROM marketplace_orders
  WHERE seller_tenant_id = v_tenant_id;

  -- Recent Sales (Last 5)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'order_number', order_number,
      'customer_name', customer_name,
      'customer_email', customer_email,
      'total_amount', total_amount,
      'status', status,
      'payment_status', payment_status,
      'created_at', created_at
    )
  )
  INTO v_recent_sales
  FROM (
    SELECT * FROM marketplace_orders
    WHERE seller_tenant_id = v_tenant_id
    ORDER BY created_at DESC
    LIMIT 5
  ) recent;

  -- Chart Data (Last 30 days revenue)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', to_char(day, 'Mon DD'),
      'revenue', COALESCE(daily_revenue, 0)
    )
  )
  INTO v_chart_data
  FROM (
    SELECT
      day::date,
      SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as daily_revenue
    FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day'::interval) day
    LEFT JOIN marketplace_orders mo ON date_trunc('day', mo.created_at) = day
      AND mo.seller_tenant_id = v_tenant_id
    GROUP BY day
    ORDER BY day
  ) chart;

  RETURN jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_orders', v_total_orders,
    'active_customers', v_active_customers,
    'recent_sales', COALESCE(v_recent_sales, '[]'::jsonb),
    'chart_data', COALESCE(v_chart_data, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
