-- Allow Platform Admins to view and manage all payouts
CREATE POLICY "Platform Admins can view all payouts"
ON public.marketplace_payouts
FOR SELECT
USING (public.is_platform_admin());

CREATE POLICY "Platform Admins can update payouts"
ON public.marketplace_payouts
FOR UPDATE
USING (public.is_platform_admin());

-- Also generic policy for viewing any table if robust admin is needed, 
-- but explicit is better for now.
