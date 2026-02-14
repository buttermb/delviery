-- Hard-wire calls to public.encrypt_menu_text/jsonb/numeric to avoid search_path resolution issues
CREATE OR REPLACE FUNCTION public.encrypt_disposable_menu(menu_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,extensions'
AS $function$
BEGIN
  -- Encrypt menu data using fully qualified helper functions
  UPDATE public.disposable_menus
  SET
    encrypted_name = public.encrypt_menu_text(name::text),
    encrypted_description = public.encrypt_menu_text(description::text),
    encrypted_security_settings = public.encrypt_menu_jsonb(security_settings),
    encrypted_appearance_settings = public.encrypt_menu_jsonb(appearance_settings),
    encrypted_min_order_quantity = public.encrypt_menu_numeric(min_order_quantity),
    encrypted_max_order_quantity = public.encrypt_menu_numeric(max_order_quantity),
    is_encrypted = true,
    encryption_version = 1
  WHERE id = menu_id;
  
  -- Encrypt product prices with fully qualified helper and correct WHERE clause
  UPDATE public.disposable_menu_products
  SET
    encrypted_custom_price = public.encrypt_menu_numeric(custom_price),
    is_encrypted = true
  WHERE public.disposable_menu_products.menu_id = encrypt_disposable_menu.menu_id;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to encrypt menu %: %', menu_id, SQLERRM;
END;
$function$;

COMMENT ON FUNCTION public.encrypt_disposable_menu(uuid) IS 'Encrypts disposable menu data and products using pgcrypto-backed helpers.';