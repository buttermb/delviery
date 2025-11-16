-- ===================================================================
-- DISPOSABLE ENCRYPTED MENUS - DATABASE SCHEMA
-- Phase 1: Core Tables for OPSEC Menu System
-- ===================================================================

-- Create enum types
CREATE TYPE menu_status AS ENUM ('active', 'soft_burned', 'hard_burned');
CREATE TYPE menu_access_type AS ENUM ('invite_only', 'shared_link', 'hybrid');
CREATE TYPE whitelist_status AS ENUM ('pending', 'active', 'revoked', 'blocked');
CREATE TYPE security_event_type AS ENUM (
  'failed_access_code',
  'geofence_violation', 
  'screenshot_attempt',
  'new_device_detected',
  'excessive_views',
  'suspicious_ip',
  'link_sharing_detected'
);
CREATE TYPE event_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE burn_type AS ENUM ('soft', 'hard');
CREATE TYPE menu_order_status AS ENUM ('pending', 'confirmed', 'rejected');

-- ===================================================================
-- TABLE: disposable_menus
-- Core menu configuration with encrypted URLs
-- ===================================================================
CREATE TABLE public.disposable_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  encrypted_url_token TEXT UNIQUE NOT NULL,
  access_code_hash TEXT NOT NULL,
  status menu_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  burned_at TIMESTAMPTZ,
  burn_reason TEXT,
  expiration_date TIMESTAMPTZ,
  never_expires BOOLEAN NOT NULL DEFAULT true,
  security_settings JSONB NOT NULL DEFAULT '{}',
  appearance_settings JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  min_order_quantity NUMERIC DEFAULT 5,
  max_order_quantity NUMERIC DEFAULT 50
);

-- ===================================================================
-- TABLE: disposable_menu_products
-- Products included in each menu with optional custom pricing
-- ===================================================================
CREATE TABLE public.disposable_menu_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.wholesale_inventory(id),
  custom_price NUMERIC,
  display_availability BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
-- TABLE: menu_access_whitelist
-- Whitelisted customers with unique access tokens
-- ===================================================================
CREATE TABLE public.menu_access_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.wholesale_clients(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  unique_access_token TEXT UNIQUE NOT NULL,
  status whitelist_status NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_access_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  device_fingerprint TEXT,
  invited_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

-- ===================================================================
-- TABLE: menu_access_logs
-- Comprehensive logging of all access attempts
-- ===================================================================
CREATE TABLE public.menu_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  access_whitelist_id UUID REFERENCES public.menu_access_whitelist(id),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  location JSONB,
  session_duration_seconds INTEGER,
  actions_taken JSONB DEFAULT '[]',
  geofence_pass BOOLEAN,
  time_restriction_pass BOOLEAN,
  access_code_correct BOOLEAN,
  suspicious_flags TEXT[]
);

-- ===================================================================
-- TABLE: menu_security_events
-- Security violations and alerts
-- ===================================================================
CREATE TABLE public.menu_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  access_whitelist_id UUID REFERENCES public.menu_access_whitelist(id),
  event_type security_event_type NOT NULL,
  severity event_severity NOT NULL DEFAULT 'medium',
  event_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ
);

-- ===================================================================
-- TABLE: menu_orders
-- Orders placed through disposable menus
-- ===================================================================
CREATE TABLE public.menu_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  access_whitelist_id UUID NOT NULL REFERENCES public.menu_access_whitelist(id),
  order_data JSONB NOT NULL,
  total_amount NUMERIC NOT NULL,
  delivery_method TEXT,
  payment_method TEXT,
  customer_notes TEXT,
  contact_phone TEXT NOT NULL,
  delivery_address TEXT,
  status menu_order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id)
);

-- ===================================================================
-- TABLE: menu_burn_history
-- Audit trail of burned menus
-- ===================================================================
CREATE TABLE public.menu_burn_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  burn_type burn_type NOT NULL,
  burn_reason TEXT NOT NULL,
  burned_by UUID NOT NULL REFERENCES auth.users(id),
  burned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  regenerated_menu_id UUID REFERENCES public.disposable_menus(id),
  customers_migrated INTEGER NOT NULL DEFAULT 0,
  stats_snapshot JSONB NOT NULL DEFAULT '{}'
);

-- ===================================================================
-- INDEXES for performance
-- ===================================================================
CREATE INDEX idx_disposable_menus_status ON public.disposable_menus(status);
CREATE INDEX idx_disposable_menus_token ON public.disposable_menus(encrypted_url_token);
CREATE INDEX idx_disposable_menus_created_by ON public.disposable_menus(created_by);

CREATE INDEX idx_menu_products_menu ON public.disposable_menu_products(menu_id);
CREATE INDEX idx_menu_products_product ON public.disposable_menu_products(product_id);

CREATE INDEX idx_whitelist_menu ON public.menu_access_whitelist(menu_id);
CREATE INDEX idx_whitelist_token ON public.menu_access_whitelist(unique_access_token);
CREATE INDEX idx_whitelist_customer ON public.menu_access_whitelist(customer_id);
CREATE INDEX idx_whitelist_status ON public.menu_access_whitelist(status);

CREATE INDEX idx_access_logs_menu ON public.menu_access_logs(menu_id);
CREATE INDEX idx_access_logs_time ON public.menu_access_logs(accessed_at DESC);
CREATE INDEX idx_access_logs_whitelist ON public.menu_access_logs(access_whitelist_id);

CREATE INDEX idx_security_events_menu ON public.menu_security_events(menu_id);
CREATE INDEX idx_security_events_severity ON public.menu_security_events(severity, acknowledged);
CREATE INDEX idx_security_events_time ON public.menu_security_events(created_at DESC);

CREATE INDEX idx_menu_orders_menu ON public.menu_orders(menu_id);
CREATE INDEX idx_menu_orders_whitelist ON public.menu_orders(access_whitelist_id);
CREATE INDEX idx_menu_orders_status ON public.menu_orders(status);

CREATE INDEX idx_burn_history_menu ON public.menu_burn_history(menu_id);
CREATE INDEX idx_burn_history_time ON public.menu_burn_history(burned_at DESC);

-- ===================================================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE public.disposable_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposable_menu_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_access_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_burn_history ENABLE ROW LEVEL SECURITY;

-- Policies for disposable_menus
CREATE POLICY "Authenticated users can view all menus"
  ON public.disposable_menus FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create menus"
  ON public.disposable_menus FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update their menus"
  ON public.disposable_menus FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Policies for disposable_menu_products
CREATE POLICY "Authenticated users can view menu products"
  ON public.disposable_menu_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage menu products"
  ON public.disposable_menu_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disposable_menus
      WHERE id = menu_id AND created_by = auth.uid()
    )
  );

-- Policies for menu_access_whitelist
CREATE POLICY "Authenticated users can view whitelist"
  ON public.menu_access_whitelist FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage whitelist"
  ON public.menu_access_whitelist FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disposable_menus
      WHERE id = menu_id AND created_by = auth.uid()
    )
  );

-- Policies for menu_access_logs (public access for edge functions)
CREATE POLICY "Anyone can insert access logs"
  ON public.menu_access_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view access logs"
  ON public.menu_access_logs FOR SELECT
  TO authenticated
  USING (true);

-- Policies for menu_security_events
CREATE POLICY "Anyone can create security events"
  ON public.menu_security_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view security events"
  ON public.menu_security_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can acknowledge events"
  ON public.menu_security_events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (acknowledged_by = auth.uid());

-- Policies for menu_orders (public insert for customer orders)
CREATE POLICY "Anyone can create orders"
  ON public.menu_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all orders"
  ON public.menu_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update orders"
  ON public.menu_orders FOR UPDATE
  TO authenticated
  USING (true);

-- Policies for menu_burn_history
CREATE POLICY "Authenticated users can view burn history"
  ON public.menu_burn_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create burn records"
  ON public.menu_burn_history FOR INSERT
  TO authenticated
  WITH CHECK (burned_by = auth.uid());

-- ===================================================================
-- FUNCTIONS & TRIGGERS
-- ===================================================================

-- Function to auto-update last_access_at
CREATE OR REPLACE FUNCTION update_last_access_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.menu_access_whitelist
  SET 
    last_access_at = NEW.accessed_at,
    view_count = view_count + 1,
    first_access_at = COALESCE(first_access_at, NEW.accessed_at)
  WHERE id = NEW.access_whitelist_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_access_timestamp
  AFTER INSERT ON public.menu_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_last_access_timestamp();

-- Function to update whitelist status on first access
CREATE OR REPLACE FUNCTION activate_whitelist_on_first_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_access_at IS NOT NULL AND OLD.first_access_at IS NULL THEN
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activate_whitelist
  BEFORE UPDATE ON public.menu_access_whitelist
  FOR EACH ROW
  WHEN (NEW.first_access_at IS NOT NULL AND OLD.first_access_at IS NULL)
  EXECUTE FUNCTION activate_whitelist_on_first_access();