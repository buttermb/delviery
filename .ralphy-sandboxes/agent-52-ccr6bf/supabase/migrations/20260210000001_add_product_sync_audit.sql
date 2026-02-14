-- Product Sync Audit Table
-- Tracks all product changes that are synced from admin to storefront
-- Enables audit trail and change tracking

-- Create product_sync_audit table
CREATE TABLE IF NOT EXISTS product_sync_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Change details
    field_changed text NOT NULL,
    old_value jsonb,
    new_value jsonb,

    -- Sync metadata
    sync_source text NOT NULL DEFAULT 'admin_update', -- 'admin_update', 'realtime', 'import', 'api'
    sync_status text NOT NULL DEFAULT 'success', -- 'success', 'pending', 'failed'
    sync_started_at timestamptz NOT NULL DEFAULT now(),
    sync_completed_at timestamptz,

    -- User who made the change
    changed_by uuid REFERENCES auth.users(id),

    -- Error tracking
    error_message text,
    retry_count int DEFAULT 0,

    -- Affected destinations
    affected_storefronts jsonb DEFAULT '[]'::jsonb, -- Array of storefront IDs
    affected_menus jsonb DEFAULT '[]'::jsonb, -- Array of menu IDs

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Indexes for common queries
    CONSTRAINT valid_sync_status CHECK (sync_status IN ('success', 'pending', 'failed'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_sync_audit_tenant
    ON product_sync_audit(tenant_id);

CREATE INDEX IF NOT EXISTS idx_product_sync_audit_product
    ON product_sync_audit(product_id);

CREATE INDEX IF NOT EXISTS idx_product_sync_audit_created
    ON product_sync_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_sync_audit_status
    ON product_sync_audit(sync_status)
    WHERE sync_status = 'pending' OR sync_status = 'failed';

CREATE INDEX IF NOT EXISTS idx_product_sync_audit_changed_by
    ON product_sync_audit(changed_by);

-- Enable RLS
ALTER TABLE product_sync_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Tenant isolation
CREATE POLICY "Users can view their tenant's product sync audit"
    ON product_sync_audit
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert product sync audit for their tenant"
    ON product_sync_audit
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- Super admins can view all
CREATE POLICY "Super admins can view all product sync audit"
    ON product_sync_audit
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admin_users
            WHERE id = auth.uid()
        )
    );

-- Add comment for documentation
COMMENT ON TABLE product_sync_audit IS
    'Tracks all product changes synced from admin to storefront for audit trail';

COMMENT ON COLUMN product_sync_audit.field_changed IS
    'The product field that was changed (e.g., price, name, description, image_url, stock_quantity)';

COMMENT ON COLUMN product_sync_audit.sync_source IS
    'Source of the sync: admin_update (manual), realtime (database trigger), import (bulk), api (external)';

-- Create a function to automatically log product changes
CREATE OR REPLACE FUNCTION log_product_sync_audit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    changed_field text;
    old_val jsonb;
    new_val jsonb;
BEGIN
    -- Only log on UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Check each important field for changes

        -- Name
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'name',
                to_jsonb(OLD.name), to_jsonb(NEW.name),
                auth.uid(), 'admin_update', now()
            );
        END IF;

        -- Description
        IF OLD.description IS DISTINCT FROM NEW.description THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'description',
                to_jsonb(OLD.description), to_jsonb(NEW.description),
                auth.uid(), 'admin_update', now()
            );
        END IF;

        -- Wholesale price
        IF OLD.wholesale_price IS DISTINCT FROM NEW.wholesale_price THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'wholesale_price',
                to_jsonb(OLD.wholesale_price), to_jsonb(NEW.wholesale_price),
                auth.uid(), 'admin_update', now()
            );
        END IF;

        -- Retail price
        IF OLD.retail_price IS DISTINCT FROM NEW.retail_price THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'retail_price',
                to_jsonb(OLD.retail_price), to_jsonb(NEW.retail_price),
                auth.uid(), 'admin_update', now()
            );
        END IF;

        -- Image URL
        IF OLD.image_url IS DISTINCT FROM NEW.image_url THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'image_url',
                to_jsonb(OLD.image_url), to_jsonb(NEW.image_url),
                auth.uid(), 'admin_update', now()
            );
        END IF;

        -- Available quantity (stock)
        IF OLD.available_quantity IS DISTINCT FROM NEW.available_quantity THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'available_quantity',
                to_jsonb(OLD.available_quantity), to_jsonb(NEW.available_quantity),
                auth.uid(), 'admin_update', now()
            );
        END IF;

        -- Menu visibility
        IF OLD.menu_visibility IS DISTINCT FROM NEW.menu_visibility THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'menu_visibility',
                to_jsonb(OLD.menu_visibility), to_jsonb(NEW.menu_visibility),
                auth.uid(), 'admin_update', now()
            );
        END IF;

        -- Category
        IF OLD.category IS DISTINCT FROM NEW.category THEN
            INSERT INTO product_sync_audit (
                tenant_id, product_id, field_changed,
                old_value, new_value, changed_by, sync_source, sync_completed_at
            ) VALUES (
                NEW.tenant_id, NEW.id, 'category',
                to_jsonb(OLD.category), to_jsonb(NEW.category),
                auth.uid(), 'admin_update', now()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger on products table
DROP TRIGGER IF EXISTS trg_product_sync_audit ON products;
CREATE TRIGGER trg_product_sync_audit
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION log_product_sync_audit();

-- Grant permissions
GRANT SELECT, INSERT ON product_sync_audit TO authenticated;
