-- PHASE 7 (continued): Fix the specific 11 functions missing search_path

ALTER FUNCTION public.calculate_next_retry_delay(integer, jsonb) SET search_path = public;
ALTER FUNCTION public.decrement_giveaway_entries(uuid, uuid, integer) SET search_path = public;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public;
ALTER FUNCTION public.generate_po_number() SET search_path = public;
ALTER FUNCTION public.generate_ticket_number() SET search_path = public;
ALTER FUNCTION public.generate_transfer_number() SET search_path = public;
ALTER FUNCTION public.increment_giveaway_entries(uuid, uuid, integer) SET search_path = public;
ALTER FUNCTION public.is_error_retryable(text, jsonb) SET search_path = public;
ALTER FUNCTION public.set_po_number() SET search_path = public;
ALTER FUNCTION public.set_ticket_number() SET search_path = public;
ALTER FUNCTION public.set_transfer_number() SET search_path = public;

-- All functions now have search_path = public set for security