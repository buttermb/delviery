-- Add RLS policies for locations table
CREATE POLICY "Users can view their account locations"
ON public.locations FOR SELECT
USING (true);

CREATE POLICY "Users can insert their account locations"
ON public.locations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their account locations"
ON public.locations FOR UPDATE
USING (true);

CREATE POLICY "Users can delete their account locations"
ON public.locations FOR DELETE
USING (true);

-- Add RLS policies for vendors table
CREATE POLICY "Users can view their account vendors"
ON public.vendors FOR SELECT
USING (true);

CREATE POLICY "Users can insert their account vendors"
ON public.vendors FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their account vendors"
ON public.vendors FOR UPDATE
USING (true);

CREATE POLICY "Users can delete their account vendors"
ON public.vendors FOR DELETE
USING (true);

-- Add RLS policies for fronted_inventory table
CREATE POLICY "Users can view their account fronted inventory"
ON public.fronted_inventory FOR SELECT
USING (true);

CREATE POLICY "Users can insert their account fronted inventory"
ON public.fronted_inventory FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their account fronted inventory"
ON public.fronted_inventory FOR UPDATE
USING (true);

-- Add RLS policies for inventory_locations table
CREATE POLICY "Users can view inventory locations"
ON public.inventory_locations FOR SELECT
USING (true);

CREATE POLICY "Users can insert inventory locations"
ON public.inventory_locations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update inventory locations"
ON public.inventory_locations FOR UPDATE
USING (true);

CREATE POLICY "Users can delete inventory locations"
ON public.inventory_locations FOR DELETE
USING (true);