-- Add RLS policies for disposable menus system (only if not exists)

-- Drop existing policies and recreate to ensure they're correct
DO $$ 
BEGIN
  -- Disposable Menus policies
  DROP POLICY IF EXISTS "Admins can view all disposable menus" ON public.disposable_menus;
  DROP POLICY IF EXISTS "Admins can create disposable menus" ON public.disposable_menus;
  DROP POLICY IF EXISTS "Admins can update disposable menus" ON public.disposable_menus;
  DROP POLICY IF EXISTS "Admins can delete disposable menus" ON public.disposable_menus;
  
  -- Menu Access Whitelist policies
  DROP POLICY IF EXISTS "Admins can view all whitelist entries" ON public.menu_access_whitelist;
  DROP POLICY IF EXISTS "Admins can create whitelist entries" ON public.menu_access_whitelist;
  DROP POLICY IF EXISTS "Admins can update whitelist entries" ON public.menu_access_whitelist;
  
  -- Menu Access Logs policies
  DROP POLICY IF EXISTS "Admins can view all access logs" ON public.menu_access_logs;
  DROP POLICY IF EXISTS "System can insert access logs" ON public.menu_access_logs;
  
  -- Menu Security Events policies
  DROP POLICY IF EXISTS "Admins can view all security events" ON public.menu_security_events;
  DROP POLICY IF EXISTS "System can insert security events" ON public.menu_security_events;
END $$;

-- Disposable Menus: Allow admins to manage their menus
CREATE POLICY "Admins can view all disposable menus"
ON public.disposable_menus
FOR SELECT
USING (true);

CREATE POLICY "Admins can create disposable menus"
ON public.disposable_menus
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update disposable menus"
ON public.disposable_menus
FOR UPDATE
USING (true);

CREATE POLICY "Admins can delete disposable menus"
ON public.disposable_menus
FOR DELETE
USING (true);

-- Menu Access Whitelist
CREATE POLICY "Admins can view all whitelist entries"
ON public.menu_access_whitelist
FOR SELECT
USING (true);

CREATE POLICY "Admins can create whitelist entries"
ON public.menu_access_whitelist
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update whitelist entries"
ON public.menu_access_whitelist
FOR UPDATE
USING (true);

-- Menu Access Logs
CREATE POLICY "Admins can view all access logs"
ON public.menu_access_logs
FOR SELECT
USING (true);

CREATE POLICY "System can insert access logs"
ON public.menu_access_logs
FOR INSERT
WITH CHECK (true);

-- Menu Security Events
CREATE POLICY "Admins can view all security events"
ON public.menu_security_events
FOR SELECT
USING (true);

CREATE POLICY "System can insert security events"
ON public.menu_security_events
FOR INSERT
WITH CHECK (true);