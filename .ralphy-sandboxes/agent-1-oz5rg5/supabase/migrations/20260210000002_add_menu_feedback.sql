/**
 * Menu Feedback Table
 * Collects optional feedback from customers post-order
 * Links feedback to orders and customers for menu optimization
 */

-- Create menu_feedback table
CREATE TABLE IF NOT EXISTS public.menu_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.menu_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_menu_feedback_tenant_id ON public.menu_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_feedback_menu_id ON public.menu_feedback(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_feedback_order_id ON public.menu_feedback(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_feedback_customer_id ON public.menu_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_menu_feedback_created_at ON public.menu_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_menu_feedback_rating ON public.menu_feedback(rating);

-- Composite index for aggregate rating per menu
CREATE INDEX IF NOT EXISTS idx_menu_feedback_menu_rating ON public.menu_feedback(menu_id, rating);

-- Enable Row Level Security
ALTER TABLE public.menu_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenants can view their own feedback
CREATE POLICY "Tenants can view own menu feedback"
  ON public.menu_feedback
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Tenants can insert feedback for their menus
CREATE POLICY "Tenants can insert menu feedback"
  ON public.menu_feedback
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Allow anonymous/public feedback submission for menus
-- This is useful for customers submitting feedback without authentication
CREATE POLICY "Public can submit feedback for accessible menus"
  ON public.menu_feedback
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.disposable_menus
      WHERE id = menu_id
      AND status = 'active'
    )
  );

-- RLS Policy: Tenants can update their own feedback
CREATE POLICY "Tenants can update own menu feedback"
  ON public.menu_feedback
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Tenants can delete their own feedback
CREATE POLICY "Tenants can delete own menu feedback"
  ON public.menu_feedback
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.menu_feedback IS 'Optional feedback collected from customers after placing orders on menus';
COMMENT ON COLUMN public.menu_feedback.id IS 'Unique identifier for the feedback entry';
COMMENT ON COLUMN public.menu_feedback.tenant_id IS 'Tenant that owns this feedback record';
COMMENT ON COLUMN public.menu_feedback.menu_id IS 'Menu that received the feedback';
COMMENT ON COLUMN public.menu_feedback.order_id IS 'Order associated with the feedback (optional)';
COMMENT ON COLUMN public.menu_feedback.customer_id IS 'Customer who provided the feedback (optional for anonymous)';
COMMENT ON COLUMN public.menu_feedback.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN public.menu_feedback.comment IS 'Optional text comment from the customer';
COMMENT ON COLUMN public.menu_feedback.created_at IS 'When the feedback was submitted';
