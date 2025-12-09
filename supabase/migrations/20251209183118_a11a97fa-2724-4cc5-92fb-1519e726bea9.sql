-- Update get_marketplace_store_by_slug to support admin preview of inactive stores
CREATE OR REPLACE FUNCTION public.get_marketplace_store_by_slug(p_slug text)
RETURNS SETOF marketplace_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return store if:
  -- 1. It's active (public access)
  -- 2. OR the current user is a member of the tenant that owns it (admin preview)
  RETURN QUERY
  SELECT ms.* FROM public.marketplace_stores ms
  WHERE ms.slug = p_slug
    AND (
      ms.is_active = true
      OR ms.tenant_id IN (
        SELECT tu.tenant_id 
        FROM public.tenant_users tu 
        WHERE tu.user_id = auth.uid()
      )
    );
END;
$function$;