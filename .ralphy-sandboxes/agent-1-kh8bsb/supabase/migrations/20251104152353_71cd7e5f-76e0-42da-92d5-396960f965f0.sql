-- Payment Schedules for tracking scheduled payments
CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.wholesale_clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Collection Activities for tracking collection efforts
CREATE TABLE IF NOT EXISTS public.collection_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.wholesale_clients(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  amount NUMERIC,
  notes TEXT,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;

-- Simplified RLS Policies (authenticated users can manage)
CREATE POLICY "Authenticated users can view payment schedules"
  ON public.payment_schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create payment schedules"
  ON public.payment_schedules FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payment schedules"
  ON public.payment_schedules FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete payment schedules"
  ON public.payment_schedules FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view collection activities"
  ON public.collection_activities FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create collection activities"
  ON public.collection_activities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_schedules_client_id ON public.payment_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_date ON public.payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_status ON public.payment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_collection_activities_client_id ON public.collection_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_collection_activities_created_at ON public.collection_activities(created_at);