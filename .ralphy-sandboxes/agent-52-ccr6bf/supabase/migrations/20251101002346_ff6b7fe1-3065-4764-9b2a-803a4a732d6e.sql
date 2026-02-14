-- Add RLS policies for disposable_menus table to protect access codes

-- Drop existing policies if any
DROP POLICY IF EXISTS "Menu creators can view own menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Admins can view all menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Admins can manage all menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Menu creators can insert menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Menu creators can update own menus" ON public.disposable_menus;
DROP POLICY IF EXISTS "Menu creators can delete own menus" ON public.disposable_menus;

-- Enable RLS on disposable_menus if not already enabled
ALTER TABLE public.disposable_menus ENABLE ROW LEVEL SECURITY;

-- Policy: Menu creators can view their own menus
CREATE POLICY "Menu creators can view own menus"
ON public.disposable_menus
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Policy: Admins can view all menus
CREATE POLICY "Admins can view all menus"
ON public.disposable_menus
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Menu creators can insert menus
CREATE POLICY "Menu creators can insert menus"
ON public.disposable_menus
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Policy: Menu creators can update their own menus
CREATE POLICY "Menu creators can update own menus"
ON public.disposable_menus
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- Policy: Menu creators can delete their own menus
CREATE POLICY "Menu creators can delete own menus"
ON public.disposable_menus
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Policy: Admins can manage all menus
CREATE POLICY "Admins can manage all menus"
ON public.disposable_menus
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));