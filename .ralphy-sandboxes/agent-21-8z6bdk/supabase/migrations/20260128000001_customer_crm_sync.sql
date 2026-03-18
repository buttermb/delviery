-- ============================================================================
-- CUSTOMER-CRM SYNC INTEGRATION
-- Connects unified contacts to CRM activity timeline for customer update syncing
-- ============================================================================

-- ============================================================================
-- 1. EXTEND CRM ACTIVITY LOG FOR CUSTOMER REFERENCES
-- ============================================================================

-- Add contact_id column to allow logging activities for contacts
ALTER TABLE public.crm_activity_log
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add metadata column for storing additional context about activities
ALTER TABLE public.crm_activity_log
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for contact-based lookups
CREATE INDEX IF NOT EXISTS idx_crm_activity_log_contact_id
ON public.crm_activity_log(contact_id)
WHERE contact_id IS NOT NULL;

-- ============================================================================
-- 2. CRM-CUSTOMER LINK TABLE
-- Links contacts to CRM clients for bidirectional sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  crm_client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,

  -- Sync metadata
  sync_enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  -- Ensure unique link per contact-client pair within an account
  CONSTRAINT unique_contact_crm_link UNIQUE(account_id, contact_id, crm_client_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_crm_customer_links_account ON public.crm_customer_links(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_links_tenant ON public.crm_customer_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_links_contact ON public.crm_customer_links(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_links_client ON public.crm_customer_links(crm_client_id);

-- Enable RLS
ALTER TABLE public.crm_customer_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy for crm_customer_links
CREATE POLICY "Users can manage CRM customer links for their account"
ON public.crm_customer_links FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================================================
-- 3. FUNCTION TO LOG CUSTOMER ACTIVITY TO CRM TIMELINE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_customer_crm_activity(
  p_contact_id UUID,
  p_activity_type TEXT,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_performed_by_user_id UUID DEFAULT NULL
)
RETURNS SETOF public.crm_activity_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_user_email TEXT;
  v_result public.crm_activity_log;
BEGIN
  -- Get performer name from user ID
  IF p_performed_by_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = p_performed_by_user_id;
  ELSE
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    p_performed_by_user_id := auth.uid();
  END IF;

  -- Find all CRM links for this contact and log activity to each linked CRM client
  FOR v_link IN
    SELECT ccl.account_id, ccl.crm_client_id
    FROM crm_customer_links ccl
    WHERE ccl.contact_id = p_contact_id
      AND ccl.sync_enabled = true
  LOOP
    INSERT INTO crm_activity_log (
      account_id,
      client_id,
      contact_id,
      activity_type,
      description,
      reference_id,
      reference_type,
      metadata,
      performed_by_user_id,
      performed_by_name
    ) VALUES (
      v_link.account_id,
      v_link.crm_client_id,
      p_contact_id,
      p_activity_type,
      p_description,
      p_reference_id,
      p_reference_type,
      p_metadata,
      p_performed_by_user_id,
      v_user_email
    )
    RETURNING * INTO v_result;

    -- Update last_synced_at on the link
    UPDATE crm_customer_links
    SET last_synced_at = NOW()
    WHERE contact_id = p_contact_id
      AND crm_client_id = v_link.crm_client_id;

    RETURN NEXT v_result;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_customer_crm_activity TO authenticated;

-- ============================================================================
-- 4. TRIGGER FUNCTION TO AUTO-SYNC CONTACT UPDATES TO CRM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_contact_update_to_crm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes JSONB;
  v_description TEXT;
  v_activity_type TEXT;
BEGIN
  -- Only sync if contact has CRM type or is linked to a CRM client
  IF NOT EXISTS (
    SELECT 1 FROM crm_customer_links WHERE contact_id = NEW.id AND sync_enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Build changes object for metadata
  v_changes := '{}'::jsonb;

  IF TG_OP = 'INSERT' THEN
    v_activity_type := 'customer_created';
    v_description := 'Customer ' || COALESCE(NEW.name, NEW.first_name || ' ' || NEW.last_name, NEW.email, 'Unknown') || ' was created';
    v_changes := jsonb_build_object(
      'name', COALESCE(NEW.name, NEW.first_name || ' ' || NEW.last_name),
      'email', NEW.email,
      'phone', NEW.phone
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_activity_type := 'customer_updated';

    -- Track specific field changes
    IF OLD.name IS DISTINCT FROM NEW.name OR OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name THEN
      v_changes := v_changes || jsonb_build_object('name', jsonb_build_object(
        'old', COALESCE(OLD.name, OLD.first_name || ' ' || OLD.last_name),
        'new', COALESCE(NEW.name, NEW.first_name || ' ' || NEW.last_name)
      ));
    END IF;

    IF OLD.email IS DISTINCT FROM NEW.email THEN
      v_changes := v_changes || jsonb_build_object('email', jsonb_build_object('old', OLD.email, 'new', NEW.email));
    END IF;

    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      v_changes := v_changes || jsonb_build_object('phone', jsonb_build_object('old', OLD.phone, 'new', NEW.phone));
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;

    IF OLD.loyalty_points IS DISTINCT FROM NEW.loyalty_points THEN
      v_changes := v_changes || jsonb_build_object('loyalty_points', jsonb_build_object('old', OLD.loyalty_points, 'new', NEW.loyalty_points));
    END IF;

    IF OLD.loyalty_tier IS DISTINCT FROM NEW.loyalty_tier THEN
      v_changes := v_changes || jsonb_build_object('loyalty_tier', jsonb_build_object('old', OLD.loyalty_tier, 'new', NEW.loyalty_tier));
    END IF;

    IF OLD.lifetime_value IS DISTINCT FROM NEW.lifetime_value THEN
      v_changes := v_changes || jsonb_build_object('lifetime_value', jsonb_build_object('old', OLD.lifetime_value, 'new', NEW.lifetime_value));
    END IF;

    IF OLD.total_orders IS DISTINCT FROM NEW.total_orders THEN
      v_changes := v_changes || jsonb_build_object('total_orders', jsonb_build_object('old', OLD.total_orders, 'new', NEW.total_orders));
    END IF;

    -- Skip if no tracked changes
    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    v_description := 'Customer ' || COALESCE(NEW.name, NEW.first_name || ' ' || NEW.last_name, NEW.email, 'Unknown') || ' was updated';
  END IF;

  -- Log the activity
  PERFORM log_customer_crm_activity(
    NEW.id,
    v_activity_type,
    v_description,
    NEW.id,
    'contact',
    jsonb_build_object('changes', v_changes)
  );

  RETURN NEW;
END;
$$;

-- Create trigger for contact updates (fires after insert/update)
DROP TRIGGER IF EXISTS trigger_sync_contact_to_crm ON public.contacts;
CREATE TRIGGER trigger_sync_contact_to_crm
  AFTER INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contact_update_to_crm();

-- ============================================================================
-- 5. FUNCTION TO LINK CUSTOMER TO CRM CLIENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_customer_to_crm(
  p_contact_id UUID,
  p_crm_client_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_sync_enabled BOOLEAN DEFAULT true
)
RETURNS public.crm_customer_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact RECORD;
  v_client RECORD;
  v_tenant_id UUID;
  v_account_id UUID;
  v_link public.crm_customer_links;
BEGIN
  -- Get contact info
  SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found: %', p_contact_id;
  END IF;

  v_tenant_id := v_contact.tenant_id;

  -- Get CRM client info
  SELECT * INTO v_client FROM crm_clients WHERE id = p_crm_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM client not found: %', p_crm_client_id;
  END IF;

  v_account_id := COALESCE(p_account_id, v_client.account_id);

  -- Create the link
  INSERT INTO crm_customer_links (
    account_id,
    tenant_id,
    contact_id,
    crm_client_id,
    sync_enabled,
    created_by
  ) VALUES (
    v_account_id,
    v_tenant_id,
    p_contact_id,
    p_crm_client_id,
    p_sync_enabled,
    auth.uid()
  )
  ON CONFLICT (account_id, contact_id, crm_client_id)
  DO UPDATE SET
    sync_enabled = EXCLUDED.sync_enabled,
    last_synced_at = NOW()
  RETURNING * INTO v_link;

  -- Log the linking activity
  INSERT INTO crm_activity_log (
    account_id,
    client_id,
    contact_id,
    activity_type,
    description,
    reference_id,
    reference_type,
    metadata,
    performed_by_user_id,
    performed_by_name
  )
  SELECT
    v_account_id,
    p_crm_client_id,
    p_contact_id,
    'customer_linked',
    'Customer ' || COALESCE(v_contact.name, v_contact.first_name || ' ' || v_contact.last_name, v_contact.email, 'Unknown') || ' linked to CRM client ' || v_client.name,
    v_link.id,
    'crm_customer_link',
    jsonb_build_object(
      'contact_id', p_contact_id,
      'contact_name', COALESCE(v_contact.name, v_contact.first_name || ' ' || v_contact.last_name),
      'contact_email', v_contact.email,
      'crm_client_id', p_crm_client_id,
      'crm_client_name', v_client.name
    ),
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid());

  RETURN v_link;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_customer_to_crm TO authenticated;

-- ============================================================================
-- 6. FUNCTION TO UNLINK CUSTOMER FROM CRM CLIENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unlink_customer_from_crm(
  p_contact_id UUID,
  p_crm_client_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_contact RECORD;
  v_client RECORD;
BEGIN
  -- Get the link
  SELECT * INTO v_link
  FROM crm_customer_links
  WHERE contact_id = p_contact_id AND crm_client_id = p_crm_client_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get contact and client for logging
  SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
  SELECT * INTO v_client FROM crm_clients WHERE id = p_crm_client_id;

  -- Log the unlinking activity before deleting
  INSERT INTO crm_activity_log (
    account_id,
    client_id,
    contact_id,
    activity_type,
    description,
    reference_id,
    reference_type,
    metadata,
    performed_by_user_id,
    performed_by_name
  )
  SELECT
    v_link.account_id,
    p_crm_client_id,
    p_contact_id,
    'customer_unlinked',
    'Customer ' || COALESCE(v_contact.name, v_contact.first_name || ' ' || v_contact.last_name, v_contact.email, 'Unknown') || ' unlinked from CRM client ' || COALESCE(v_client.name, 'Unknown'),
    v_link.id,
    'crm_customer_link',
    jsonb_build_object(
      'contact_id', p_contact_id,
      'crm_client_id', p_crm_client_id
    ),
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid());

  -- Delete the link
  DELETE FROM crm_customer_links
  WHERE contact_id = p_contact_id AND crm_client_id = p_crm_client_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlink_customer_from_crm TO authenticated;

-- ============================================================================
-- 7. FUNCTION TO GET CUSTOMER'S CRM TIMELINE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_crm_timeline(
  p_contact_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  account_id UUID,
  client_id UUID,
  contact_id UUID,
  activity_type TEXT,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  metadata JSONB,
  performed_by_user_id UUID,
  performed_by_name TEXT,
  created_at TIMESTAMPTZ,
  client_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cal.id,
    cal.account_id,
    cal.client_id,
    cal.contact_id,
    cal.activity_type,
    cal.description,
    cal.reference_id,
    cal.reference_type,
    cal.metadata,
    cal.performed_by_user_id,
    cal.performed_by_name,
    cal.created_at,
    cc.name as client_name
  FROM crm_activity_log cal
  LEFT JOIN crm_clients cc ON cc.id = cal.client_id
  WHERE cal.contact_id = p_contact_id
  ORDER BY cal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_crm_timeline TO authenticated;

-- ============================================================================
-- 8. HELPER VIEW FOR CONTACT-CRM RELATIONSHIPS
-- ============================================================================

CREATE OR REPLACE VIEW public.contacts_with_crm_links AS
SELECT
  c.*,
  (
    SELECT json_agg(json_build_object(
      'link_id', ccl.id,
      'crm_client_id', ccl.crm_client_id,
      'crm_client_name', cc.name,
      'crm_client_email', cc.email,
      'sync_enabled', ccl.sync_enabled,
      'last_synced_at', ccl.last_synced_at
    ))
    FROM crm_customer_links ccl
    JOIN crm_clients cc ON cc.id = ccl.crm_client_id
    WHERE ccl.contact_id = c.id
  ) as crm_links,
  (
    SELECT COUNT(*)
    FROM crm_customer_links ccl
    WHERE ccl.contact_id = c.id
  )::integer as crm_links_count
FROM contacts c;

COMMENT ON VIEW public.contacts_with_crm_links IS 'Contacts with their associated CRM client links';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.crm_customer_links IS 'Links unified contacts to CRM clients for activity sync';
COMMENT ON FUNCTION public.log_customer_crm_activity IS 'Logs customer-related activities to CRM timeline for all linked CRM clients';
COMMENT ON FUNCTION public.sync_contact_update_to_crm IS 'Trigger function to automatically sync contact updates to CRM activity log';
COMMENT ON FUNCTION public.link_customer_to_crm IS 'Links a contact to a CRM client for activity syncing';
COMMENT ON FUNCTION public.unlink_customer_from_crm IS 'Unlinks a contact from a CRM client';
COMMENT ON FUNCTION public.get_customer_crm_timeline IS 'Gets all CRM activity log entries for a specific contact';
