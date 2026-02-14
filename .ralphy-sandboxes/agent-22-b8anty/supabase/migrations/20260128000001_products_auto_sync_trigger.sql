-- ============================================================================
-- Migration: Products Auto-Sync Trigger (Clean, de-duplicated)
-- Description: Automatically syncs products to marketplace_product_settings
--              when products are created or updated
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
