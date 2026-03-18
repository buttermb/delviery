-- Create storage bucket for inventory images
-- Public bucket so product/inventory images can be displayed on storefronts
-- File path convention: {tenant_id}/{product_id}-{timestamp}.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-images',
  'inventory-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for inventory-images bucket
-- Tenant isolation: files stored under {tenant_id}/ prefix

-- Public read access (images displayed on storefronts)
CREATE POLICY "Public can view inventory images"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory-images');

-- Authenticated tenant members can upload images to their tenant folder
CREATE POLICY "Tenant members can upload inventory images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inventory-images' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Authenticated tenant members can update images in their tenant folder
CREATE POLICY "Tenant members can update inventory images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inventory-images' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Authenticated tenant members can delete images in their tenant folder
CREATE POLICY "Tenant members can delete inventory images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'inventory-images' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
