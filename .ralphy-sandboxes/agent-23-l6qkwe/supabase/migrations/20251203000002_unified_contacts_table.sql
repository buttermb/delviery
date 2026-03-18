-- ============================================================================
-- UNIFIED CONTACTS TABLE
-- Consolidates: customers, crm_clients, customer_users, wholesale_clients
-- ============================================================================

-- Create unified contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Contact type (can be multiple: a wholesale client can also be a retail customer)
  contact_type text[] NOT NULL DEFAULT '{retail}',
  
  -- Core info
  name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'US',
  
  -- Auth (nullable - not all contacts have portal access)
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Wholesale-specific fields
  business_name text,
  business_license text,
  tax_id text,
  credit_limit numeric DEFAULT 0,
  outstanding_balance numeric DEFAULT 0,
  payment_terms text DEFAULT 'net_30',
  client_type text CHECK (client_type IN ('sub_dealer', 'small_shop', 'network', 'supplier', 'distributor', 'dispensary')),
  account_manager_id uuid,
  
  -- CRM-specific fields
  lead_status text CHECK (lead_status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  lead_source text,
  assigned_to uuid,
  company_name text,
  job_title text,
  
  -- Retail/Loyalty fields
  loyalty_points integer DEFAULT 0,
  loyalty_tier text CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip')),
  lifetime_value numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  
  -- Verification
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  age_verified boolean DEFAULT false,
  
  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'blacklisted')),
  
  -- Encrypted PHI (for HIPAA compliance)
  encrypted_data jsonb,
  
  -- Communication preferences
  email_opt_in boolean DEFAULT true,
  sms_opt_in boolean DEFAULT true,
  preferred_contact_method text DEFAULT 'email',
  
  -- General metadata
  notes text,
  tags text[],
  metadata jsonb DEFAULT '{}',
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_contacted_at timestamptz,
  last_order_at timestamptz,
  
  -- Constraints
  CONSTRAINT contacts_email_unique UNIQUE NULLS NOT DISTINCT (tenant_id, email)
);

-- Performance indexes
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_type ON contacts USING GIN(contact_type);
CREATE INDEX idx_contacts_email ON contacts(tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_phone ON contacts(tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contacts_name ON contacts(tenant_id, name);
CREATE INDEX idx_contacts_business ON contacts(tenant_id, business_name) WHERE business_name IS NOT NULL;
CREATE INDEX idx_contacts_status ON contacts(tenant_id, status);
CREATE INDEX idx_contacts_created ON contacts(tenant_id, created_at DESC);

-- Partial indexes for type-specific queries
CREATE INDEX idx_contacts_wholesale ON contacts(tenant_id, business_name, credit_limit) 
  WHERE 'wholesale' = ANY(contact_type);
CREATE INDEX idx_contacts_retail ON contacts(tenant_id, loyalty_points) 
  WHERE 'retail' = ANY(contact_type);
CREATE INDEX idx_contacts_crm ON contacts(tenant_id, lead_status, assigned_to) 
  WHERE 'crm' = ANY(contact_type);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- ============================================================================
-- BACKWARD-COMPATIBLE VIEWS
-- ============================================================================

-- View: wholesale_clients_unified (mirrors wholesale_clients structure)
CREATE OR REPLACE VIEW wholesale_clients_unified AS
SELECT 
  c.id,
  c.tenant_id,
  c.business_name,
  COALESCE(c.name, c.first_name || ' ' || c.last_name) as contact_name,
  c.email,
  c.phone,
  c.address,
  c.client_type,
  c.credit_limit,
  c.outstanding_balance,
  c.payment_terms,
  c.status,
  c.tax_id,
  c.business_license,
  c.notes,
  c.created_at,
  c.updated_at,
  c.last_order_at,
  c.metadata
FROM contacts c
WHERE 'wholesale' = ANY(c.contact_type);

-- View: customers_unified (mirrors customers structure)
CREATE OR REPLACE VIEW customers_unified AS
SELECT
  c.id,
  c.tenant_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.address,
  c.city,
  c.state,
  c.zip_code,
  c.loyalty_points,
  c.loyalty_tier,
  c.lifetime_value,
  c.total_orders,
  c.status as customer_status,
  c.is_verified,
  c.age_verified,
  c.email_opt_in,
  c.sms_opt_in,
  c.notes,
  c.created_at,
  c.updated_at,
  c.last_order_at,
  c.metadata
FROM contacts c
WHERE 'retail' = ANY(c.contact_type);

-- View: crm_clients_unified (mirrors crm_clients structure)
CREATE OR REPLACE VIEW crm_clients_unified AS
SELECT
  c.id,
  c.tenant_id,
  c.name,
  c.email,
  c.phone,
  c.company_name,
  c.job_title,
  c.lead_status,
  c.lead_source,
  c.assigned_to,
  c.address,
  c.notes,
  c.tags,
  c.last_contacted_at,
  c.created_at,
  c.updated_at,
  c.metadata
FROM contacts c
WHERE 'crm' = ANY(c.contact_type);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "contacts_tenant_isolation" ON contacts
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to add a contact type to an existing contact
CREATE OR REPLACE FUNCTION add_contact_type(
  p_contact_id uuid,
  p_contact_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE contacts
  SET contact_type = array_append(
    CASE WHEN p_contact_type = ANY(contact_type) THEN contact_type
         ELSE contact_type
    END,
    p_contact_type
  )
  WHERE id = p_contact_id
    AND NOT (p_contact_type = ANY(contact_type));
END;
$$;

-- Function to get or create a contact
CREATE OR REPLACE FUNCTION get_or_create_contact(
  p_tenant_id uuid,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_contact_type text DEFAULT 'retail',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  -- Try to find existing contact by email or phone
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE tenant_id = p_tenant_id
    AND (
      (p_email IS NOT NULL AND email = p_email)
      OR (p_phone IS NOT NULL AND phone = p_phone)
    )
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    -- Add contact type if not already present
    PERFORM add_contact_type(v_contact_id, p_contact_type);
    RETURN v_contact_id;
  END IF;

  -- Create new contact
  INSERT INTO contacts (
    tenant_id, email, phone, name, contact_type, metadata
  ) VALUES (
    p_tenant_id, p_email, p_phone, p_name, ARRAY[p_contact_type], p_metadata
  )
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$;

-- Function to update outstanding balance
CREATE OR REPLACE FUNCTION update_contact_balance(
  p_contact_id uuid,
  p_amount numeric,
  p_operation text DEFAULT 'add' -- 'add' or 'subtract'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  UPDATE contacts
  SET outstanding_balance = CASE 
    WHEN p_operation = 'add' THEN outstanding_balance + p_amount
    WHEN p_operation = 'subtract' THEN GREATEST(0, outstanding_balance - p_amount)
    ELSE outstanding_balance
  END,
  updated_at = now()
  WHERE id = p_contact_id
  RETURNING outstanding_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION add_contact_type TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_contact TO authenticated;
GRANT EXECUTE ON FUNCTION update_contact_balance TO authenticated;

COMMENT ON TABLE contacts IS 'Unified contacts table consolidating customers, wholesale clients, and CRM leads';

