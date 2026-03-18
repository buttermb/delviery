-- ============================================================================
-- Migration: Fix Disposable Menu Products Foreign Key
-- Description: Changes disposable_menu_products.product_id to reference
--              products table instead of wholesale_inventory
-- ============================================================================

-- ============================================================================
-- 1. DROP EXISTING FOREIGN KEY
-- ============================================================================
-- The old FK referenced wholesale_inventory which is a different table than
-- where products are actually created (products table).

ALTER TABLE public.disposable_menu_products
    DROP CONSTRAINT IF EXISTS disposable_menu_products_product_id_fkey;

-- ============================================================================
-- 2. CLEAN UP ORPHANED RECORDS
-- ============================================================================
-- Remove any menu_products that reference products not in the products table
-- This handles data that was created with the old FK

DELETE FROM public.disposable_menu_products dmp
WHERE NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = dmp.product_id
);

-- Also remove any that reference wholesale_inventory but not products
-- (This is the problematic case we're fixing)
DELETE FROM public.disposable_menu_products dmp
WHERE dmp.product_id IN (
    SELECT wi.id FROM public.wholesale_inventory wi
    WHERE NOT EXISTS (
        SELECT 1 FROM public.products p WHERE p.id = wi.id
    )
);

-- ============================================================================
-- 3. ADD NEW FOREIGN KEY TO PRODUCTS TABLE
-- ============================================================================
-- Now reference the products table where products are actually created

ALTER TABLE public.disposable_menu_products
    ADD CONSTRAINT disposable_menu_products_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. ADD INDEX FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_disposable_menu_products_product_id
    ON public.disposable_menu_products(product_id);

-- ============================================================================
-- 5. UPDATE SYNC FUNCTION TO USE CORRECT TABLE
-- ============================================================================
-- The edge function sync-product-to-menu already queries the products table,
-- but let's create a helper function to ensure correct behavior

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
    -- Get current user's tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User not associated with a tenant');
    END IF;

    -- Verify menu ownership
    SELECT tenant_id INTO v_menu_tenant_id
    FROM public.disposable_menus
    WHERE id = p_menu_id;

    IF v_menu_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Menu not found');
    END IF;

    IF v_menu_tenant_id != v_tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Menu belongs to different tenant');
    END IF;

    -- Verify product ownership (from products table, not wholesale_inventory)
    SELECT tenant_id INTO v_product_tenant_id
    FROM public.products
    WHERE id = p_product_id;

    IF v_product_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    IF v_product_tenant_id != v_tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Product belongs to different tenant');
    END IF;

    -- Upsert into disposable_menu_products
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

-- ============================================================================
-- 6. ADD UNIQUE CONSTRAINT IF NOT EXISTS
-- ============================================================================
-- Ensure we have the constraint for the upsert to work
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

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.sync_product_to_disposable_menu(UUID, UUID, NUMERIC, BOOLEAN, INTEGER) TO authenticated;

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.sync_product_to_disposable_menu IS
'Syncs a product to a disposable menu. Creates or updates the menu_product entry with optional custom_price, display_availability, and display_order.';

COMMENT ON TABLE public.disposable_menu_products IS
'Products included in disposable menus. References products table (not wholesale_inventory) for proper tenant isolation and data consistency.';
