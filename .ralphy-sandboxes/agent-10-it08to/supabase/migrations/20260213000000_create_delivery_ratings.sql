-- Create delivery_ratings table for customer delivery experience feedback
CREATE TABLE IF NOT EXISTS public.delivery_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  delivery_id uuid,
  runner_id uuid,
  customer_id uuid,
  tracking_token text,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant users can view their tenant's ratings
CREATE POLICY "Tenant users can view delivery ratings"
  ON public.delivery_ratings
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- RLS: Allow insert for authenticated users (customers submitting ratings)
CREATE POLICY "Authenticated users can create delivery ratings"
  ON public.delivery_ratings
  FOR INSERT
  WITH CHECK (true);

-- RLS: Allow public insert via tracking token (unauthenticated customers)
CREATE POLICY "Public can create delivery ratings with tracking token"
  ON public.delivery_ratings
  FOR INSERT
  WITH CHECK (tracking_token IS NOT NULL);

-- Indexes for performance
CREATE INDEX idx_delivery_ratings_tenant ON public.delivery_ratings(tenant_id);
CREATE INDEX idx_delivery_ratings_order ON public.delivery_ratings(order_id);
CREATE INDEX idx_delivery_ratings_runner ON public.delivery_ratings(runner_id);
CREATE INDEX idx_delivery_ratings_customer ON public.delivery_ratings(customer_id);
CREATE INDEX idx_delivery_ratings_created ON public.delivery_ratings(created_at DESC);
CREATE INDEX idx_delivery_ratings_tracking ON public.delivery_ratings(tracking_token);

-- Updated timestamp trigger
CREATE TRIGGER update_delivery_ratings_updated_at
  BEFORE UPDATE ON public.delivery_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
