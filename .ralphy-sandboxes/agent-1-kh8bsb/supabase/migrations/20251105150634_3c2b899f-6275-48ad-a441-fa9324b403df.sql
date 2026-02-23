-- Insert Workflow Templates
-- Pre-built workflow templates that users can clone and customize

INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  actions,
  is_active
) 
SELECT 
  t.id as tenant_id,
  'Auto-Assign Courier on New Order',
  'Automatically assigns the nearest available courier when a new order is created',
  'database_event',
  '{"table_name": "orders", "event_type": "INSERT"}'::jsonb,
  '[
    {
      "id": "action-1",
      "type": "assign_courier",
      "config": {
        "order_id": "{{trigger.new_data.id}}",
        "selection_method": "nearest"
      }
    },
    {
      "id": "action-2", 
      "type": "send_sms",
      "config": {
        "to": "{{trigger.new_data.customer_phone}}",
        "message": "Your order has been assigned to a courier and will be delivered soon!"
      }
    }
  ]'::jsonb,
  false
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_definitions wd 
  WHERE wd.tenant_id = t.id 
  AND wd.name = 'Auto-Assign Courier on New Order'
);

INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  actions,
  is_active
)
SELECT
  t.id as tenant_id,
  'Low Inventory Alert',
  'Sends notification when inventory levels fall below reorder point',
  'database_event',
  '{"table_name": "wholesale_inventory", "event_type": "UPDATE"}'::jsonb,
  '[
    {
      "id": "action-1",
      "type": "send_email",
      "config": {
        "to": "inventory@company.com",
        "subject": "Low Inventory Alert: {{trigger.new_data.product_name}}",
        "body": "Product {{trigger.new_data.product_name}} is running low. Current: {{trigger.new_data.quantity_lbs}} lbs. Reorder point: {{trigger.new_data.reorder_point}} lbs."
      }
    },
    {
      "id": "action-2",
      "type": "database_query",
      "config": {
        "table": "inventory_alerts",
        "operation": "insert",
        "data": {
          "product_id": "{{trigger.new_data.id}}",
          "alert_type": "low_stock",
          "message": "Inventory below reorder point"
        }
      }
    }
  ]'::jsonb,
  false
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_definitions wd
  WHERE wd.tenant_id = t.id
  AND wd.name = 'Low Inventory Alert'
);

INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  actions,
  is_active
)
SELECT
  t.id as tenant_id,
  'Order Status Update Notification',
  'Notifies customer when order status changes',
  'database_event',
  '{"table_name": "orders", "event_type": "UPDATE"}'::jsonb,
  '[
    {
      "id": "action-1",
      "type": "send_sms",
      "config": {
        "to": "{{trigger.new_data.customer_phone}}",
        "message": "Order Update: Your order status is now {{trigger.new_data.status}}"
      }
    }
  ]'::jsonb,
  false
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_definitions wd
  WHERE wd.tenant_id = t.id
  AND wd.name = 'Order Status Update Notification'
);