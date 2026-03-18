-- ============================================================================
-- PRODUCT_VIDEOS TABLE: Video support for products
-- ============================================================================
-- Provides a dedicated table for storing video references per product with
-- ordering, thumbnail support, duration metadata, and file information.
-- References public.products (the main retail products table).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create the product_videos table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  video_order INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'video/mp4',
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_videos_product_id
  ON public.product_videos (product_id);

CREATE INDEX IF NOT EXISTS idx_product_videos_tenant_id
  ON public.product_videos (tenant_id);

CREATE INDEX IF NOT EXISTS idx_product_videos_order
  ON public.product_videos (product_id, video_order);

-- ---------------------------------------------------------------------------
-- 3. Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------

-- Authenticated users can view product videos within their tenant
DROP POLICY IF EXISTS "Authenticated users can view product videos" ON public.product_videos;
CREATE POLICY "Authenticated users can view product videos"
  ON public.product_videos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = product_videos.tenant_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- Block anonymous access
DROP POLICY IF EXISTS "Block anonymous access to product videos" ON public.product_videos;
CREATE POLICY "Block anonymous access to product videos"
  ON public.product_videos
  FOR SELECT
  TO anon
  USING (false);

-- Admins can manage product videos (insert, update, delete)
DROP POLICY IF EXISTS "Admins can manage product videos" ON public.product_videos;
CREATE POLICY "Admins can manage product videos"
  ON public.product_videos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
        AND user_roles.tenant_id = product_videos.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.product_videos IS 'Video files associated with products, with ordering and metadata';
COMMENT ON COLUMN public.product_videos.product_id IS 'FK to products table';
COMMENT ON COLUMN public.product_videos.tenant_id IS 'FK to tenants table for multi-tenant isolation';
COMMENT ON COLUMN public.product_videos.title IS 'Optional display title for the video';
COMMENT ON COLUMN public.product_videos.file_path IS 'Storage path or URL for the video file';
COMMENT ON COLUMN public.product_videos.thumbnail_path IS 'Storage path or URL for the video thumbnail';
COMMENT ON COLUMN public.product_videos.video_order IS 'Display order (0-based)';
COMMENT ON COLUMN public.product_videos.duration_seconds IS 'Video duration in seconds';
COMMENT ON COLUMN public.product_videos.file_size_bytes IS 'Video file size in bytes';
COMMENT ON COLUMN public.product_videos.mime_type IS 'Video MIME type (e.g. video/mp4)';
