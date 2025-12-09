-- Fix generate_store_token function to use schema-qualified gen_random_bytes
CREATE OR REPLACE FUNCTION public.generate_store_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.encrypted_url_token IS NULL THEN
    -- Use schema-qualified call to extensions.gen_random_bytes
    NEW.encrypted_url_token := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;