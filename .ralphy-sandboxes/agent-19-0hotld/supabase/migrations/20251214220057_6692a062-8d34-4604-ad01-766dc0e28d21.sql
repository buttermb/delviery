-- Add tenant_id column to collection_activities
ALTER TABLE public.collection_activities 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_collection_activities_tenant 
ON public.collection_activities(tenant_id);

-- Enable RLS
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "tenant_isolation_select" ON public.collection_activities;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.collection_activities;

-- Create RLS policies using security definer function
CREATE POLICY "tenant_isolation_select" ON public.collection_activities
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "tenant_isolation_insert" ON public.collection_activities
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids_safe(auth.uid())));