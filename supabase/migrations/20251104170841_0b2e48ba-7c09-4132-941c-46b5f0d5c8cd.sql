-- Create inventory alerts table for low stock notifications
CREATE TABLE IF NOT EXISTS public.inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES wholesale_inventory(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'reorder_needed', 'expiring_soon')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  current_quantity NUMERIC NOT NULL,
  reorder_point NUMERIC,
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_inventory_alerts_unresolved ON inventory_alerts(is_resolved, created_at DESC) WHERE is_resolved = false;
CREATE INDEX idx_inventory_alerts_product ON inventory_alerts(product_id);

-- Enable RLS
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for authenticated users" ON inventory_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON inventory_alerts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON inventory_alerts
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Function to automatically create alerts when inventory is low
CREATE OR REPLACE FUNCTION check_inventory_levels()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for out of stock
  IF NEW.quantity_lbs = 0 OR NEW.quantity_units = 0 THEN
    INSERT INTO inventory_alerts (product_id, product_name, alert_type, severity, current_quantity, reorder_point, message)
    VALUES (
      NEW.id,
      NEW.product_name,
      'out_of_stock',
      'critical',
      NEW.quantity_lbs,
      NEW.reorder_point,
      format('%s is out of stock! Immediate action required.', NEW.product_name)
    )
    ON CONFLICT DO NOTHING;
  
  -- Check for low stock (below reorder point)
  ELSIF NEW.quantity_lbs <= NEW.reorder_point AND NEW.reorder_point > 0 THEN
    INSERT INTO inventory_alerts (product_id, product_name, alert_type, severity, current_quantity, reorder_point, message)
    VALUES (
      NEW.id,
      NEW.product_name,
      'reorder_needed',
      'warning',
      NEW.quantity_lbs,
      NEW.reorder_point,
      format('%s is below reorder point (%s lbs). Current: %s lbs', NEW.product_name, NEW.reorder_point, NEW.quantity_lbs)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS inventory_level_check ON wholesale_inventory;
CREATE TRIGGER inventory_level_check
  AFTER INSERT OR UPDATE OF quantity_lbs, quantity_units
  ON wholesale_inventory
  FOR EACH ROW
  EXECUTE FUNCTION check_inventory_levels();

-- Function to resolve alerts
CREATE OR REPLACE FUNCTION resolve_inventory_alert(alert_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE inventory_alerts
  SET is_resolved = true, resolved_at = now()
  WHERE id = alert_id;
END;
$$ LANGUAGE plpgsql;

-- Add suppliers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wholesale_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wholesale_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON wholesale_suppliers
  FOR ALL USING (auth.role() = 'authenticated');