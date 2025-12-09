-- Create data_exports table for background jobs
CREATE TABLE IF NOT EXISTS public.data_exports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    data_type text NOT NULL, -- 'orders', 'customers', etc.
    format text NOT NULL DEFAULT 'csv',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    download_url text,
    error_message text,
    row_count integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their tenant's exports"
    ON public.data_exports FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create exports for their tenant"
    ON public.data_exports FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    ));

-- Storage Bucket for Exports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy
CREATE POLICY "Users can read their tenant's export files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] IN (
        SELECT tenant_id::text FROM public.tenant_users WHERE user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_data_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_data_exports_timestamp
    BEFORE UPDATE ON public.data_exports
    FOR EACH ROW
    EXECUTE FUNCTION update_data_exports_updated_at();
