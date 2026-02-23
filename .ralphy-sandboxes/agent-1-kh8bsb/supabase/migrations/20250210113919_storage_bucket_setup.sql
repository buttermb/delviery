-- ============================================
-- STORAGE BUCKET SETUP FOR PRODUCT BARCODES
-- Note: Storage buckets are created via Supabase Dashboard or API
-- This migration documents the required configuration
-- ============================================

-- Storage bucket configuration:
-- Name: product-barcodes
-- Public: true (barcodes need to be publicly accessible)
-- File size limit: 1MB
-- Allowed MIME types: image/svg+xml, image/png

-- RLS Policies for product-barcodes bucket
-- These will be created automatically when the bucket is created via Edge Function
-- But we document them here for reference:

-- Policy: Allow authenticated users to upload barcodes for their tenant
-- CREATE POLICY "Users can upload barcodes for their tenant"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'product-barcodes' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM public.tenants
--     WHERE id IN (
--       SELECT tenant_id FROM public.tenant_users
--       WHERE user_id = auth.uid() AND status = 'active'
--     )
--   )
-- );

-- Policy: Allow public read access to barcodes
-- CREATE POLICY "Public can read barcodes"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'product-barcodes');

-- Policy: Allow authenticated users to update/delete their tenant's barcodes
-- CREATE POLICY "Users can manage barcodes for their tenant"
-- ON storage.objects FOR UPDATE
-- TO authenticated
-- USING (
--   bucket_id = 'product-barcodes' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM public.tenants
--     WHERE id IN (
--       SELECT tenant_id FROM public.tenant_users
--       WHERE user_id = auth.uid() AND status = 'active'
--     )
--   )
-- );

-- CREATE POLICY "Users can delete barcodes for their tenant"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (
--   bucket_id = 'product-barcodes' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM public.tenants
--     WHERE id IN (
--       SELECT tenant_id FROM public.tenant_users
--       WHERE user_id = auth.uid() AND status = 'active'
--     )
--   )
-- );

-- Note: The Edge Function will create the bucket automatically if it doesn't exist
-- RLS policies should be configured via Supabase Dashboard or via API after bucket creation

