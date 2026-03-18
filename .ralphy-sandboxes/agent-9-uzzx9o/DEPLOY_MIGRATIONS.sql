-- ============================================================================
-- FLORAIQ CRITICAL FIXES - DATABASE MIGRATIONS
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mtvwmyerntkhrcdnhahp/sql/new
-- ============================================================================

-- ============================================================================
-- Migration 1: Products Auto-Sync Trigger (Clean, de-duplicated)
-- ============================================================================

-- Remove any previous trigger and function versions
DROP TRIGGER IF EXISTS trigger_auto_sync_product_on_insert ON public.products;
DROP TRIGGER IF EXISTS trigger_auto_sync_product_on_update ON public.products;
DROP FUNCTION IF EXISTS public.auto_sync_product_to_marketplace();

-- Single, final function
CREATE OR REPLACE FUNCTION public.auto_sync_product_to_marketplace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    -- Find the marketplace store for this tenant
    SELECT id INTO v_store_id
    FROM public.marketplace_stores
    WHERE tenant_id = NEW.tenant_id
    LIMIT 1;

    IF v_store_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.marketplace_product_settings (
        store_id,
        product_id,
        is_visible,
        display_order
    )
    VALUES (
        v_store_id,
        NEW.id,
        COALESCE(NEW.menu_visibility, true),
        0
    )
    ON CONFLICT (store_id, product_id) DO UPDATE SET
        is_visible = COALESCE(EXCLUDED.is_visible, marketplace_product_settings.is_visible),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_sync_product_to_marketplace failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Re-create triggers
CREATE TRIGGER trigger_auto_sync_product_on_insert
    AFTER INSERT ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_product_to_marketplace();

CREATE TRIGGER trigger_auto_sync_product_on_update
    AFTER UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        OLD.in_stock IS DISTINCT FROM NEW.in_stock
        OR OLD.menu_visibility IS DISTINCT FROM NEW.menu_visibility
        OR OLD.name IS DISTINCT FROM NEW.name
    )
    EXECUTE FUNCTION public.auto_sync_product_to_marketplace();

GRANT EXECUTE ON FUNCTION public.auto_sync_product_to_marketplace() TO authenticated;

-- One-time backfill
DO $$
DECLARE
    v_synced INTEGER := 0;
BEGIN
    INSERT INTO public.marketplace_product_settings (store_id, product_id, is_visible, display_order)
    SELECT
        ms.id,
        p.id,
        COALESCE(p.menu_visibility, true),
        0
    FROM public.products p
    INNER JOIN public.marketplace_stores ms ON ms.tenant_id = p.tenant_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.marketplace_product_settings mps
        WHERE mps.store_id = ms.id AND mps.product_id = p.id
    )
    ON CONFLICT (store_id, product_id) DO NOTHING;

    GET DIAGNOSTICS v_synced = ROW_COUNT;
    RAISE NOTICE 'Synced % existing products to marketplace_product_settings', v_synced;
END;
$$;

COMMENT ON FUNCTION public.auto_sync_product_to_marketplace IS
'Automatically syncs products to marketplace_product_settings when products are created or updated.';

-- ============================================================================
-- Migration 2: Fix Disposable Menu Products Foreign Key
-- ============================================================================

ALTER TABLE public.disposable_menu_products
    DROP CONSTRAINT IF EXISTS disposable_menu_products_product_id_fkey;

-- Clean up orphaned records
DELETE FROM public.disposable_menu_products dmp
WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = dmp.product_id
);

DELETE FROM public.disposable_menu_products dmp
WHERE dmp.product_id IN (
    SELECT wi.id FROM public.wholesale_inventory wi
    WHERE NOT EXISTS (
        SELECT 1 FROM public.products p WHERE p.id = wi.id
    )
);

-- Add new FK to products table
ALTER TABLE public.disposable_menu_products
    ADD CONSTRAINT disposable_menu_products_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_disposable_menu_products_product_id
    ON public.disposable_menu_products(product_id);

-- Sync function for menu products
CREATE OR REPLACE FUNCTION public.sync_product_to_disposable_menu(
    p_menu_id UUID,
    p_product_id UUID,
    p_custom_price NUMERIC DEFAULT NULL,
    p_display_availability BOOLEAN DEFAULT true,
    p_display_order INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_menu_tenant_id UUID;
    v_product_tenant_id UUID;
    v_menu_product_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User not associated with a tenant');
    END IF;

    SELECT tenant_id INTO v_menu_tenant_id
    FROM public.disposable_menus
    WHERE id = p_menu_id;

    IF v_menu_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Menu not found');
    END IF;

    IF v_menu_tenant_id != v_tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Menu belongs to different tenant');
    END IF;

    SELECT tenant_id INTO v_product_tenant_id
    FROM public.products
    WHERE id = p_product_id;

    IF v_product_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    IF v_product_tenant_id != v_tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Product belongs to different tenant');
    END IF;

    INSERT INTO public.disposable_menu_products (
        menu_id,
        product_id,
        custom_price,
        display_availability,
        display_order
    ) VALUES (
        p_menu_id,
        p_product_id,
        p_custom_price,
        p_display_availability,
        p_display_order
    )
    ON CONFLICT (menu_id, product_id)
    DO UPDATE SET
        custom_price = COALESCE(EXCLUDED.custom_price, disposable_menu_products.custom_price),
        display_availability = EXCLUDED.display_availability,
        display_order = EXCLUDED.display_order
    RETURNING id INTO v_menu_product_id;

    RETURN jsonb_build_object(
        'success', true,
        'menu_product_id', v_menu_product_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Add unique constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_menu_product'
        AND conrelid = 'public.disposable_menu_products'::regclass
    ) THEN
        ALTER TABLE public.disposable_menu_products
            ADD CONSTRAINT unique_menu_product UNIQUE (menu_id, product_id);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_product_to_disposable_menu(UUID, UUID, NUMERIC, BOOLEAN, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.sync_product_to_disposable_menu IS
'Syncs a product to a disposable menu with optional custom_price, display_availability, and display_order.';

COMMENT ON TABLE public.disposable_menu_products IS
'Products included in disposable menus. References products table for proper tenant isolation.';

-- ============================================================================
-- DONE! Both migrations applied successfully.
-- ============================================================================
