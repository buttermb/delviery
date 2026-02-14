-- ============================================================================
-- COMPLETE BACKEND INTEGRATION - Phase 1: All Missing Database Tables
-- ============================================================================
-- This migration creates all remaining tables needed for complete feature integration
-- Includes: Quality Control, Marketing, Appointments, Support, Compliance, Reporting
-- ============================================================================

-- ============================================================================
-- 1. QUALITY CONTROL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_control_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  batch_id TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL,
  test_date DATE NOT NULL,
  lab_name TEXT,
  coa_url TEXT,
  test_results JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'quarantined')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS quarantined_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  batch_id TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  quantity_lbs NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'released', 'disposed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies for Quality Control
ALTER TABLE quality_control_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantined_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their QC tests"
  ON quality_control_tests FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can manage quarantined inventory"
  ON quarantined_inventory FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qc_tests_tenant_id ON quality_control_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qc_tests_product_id ON quality_control_tests(product_id);
CREATE INDEX IF NOT EXISTS idx_qc_tests_status ON quality_control_tests(status);
CREATE INDEX IF NOT EXISTS idx_quarantined_tenant_id ON quarantined_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quarantined_product_id ON quarantined_inventory(product_id);

-- ============================================================================
-- 2. MARKETING AUTOMATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'push')),
  subject TEXT,
  content TEXT NOT NULL,
  audience TEXT DEFAULT 'all',
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS marketing_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies for Marketing
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their marketing campaigns"
  ON marketing_campaigns FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can manage their marketing workflows"
  ON marketing_workflows FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant_id ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_workflows_tenant_id ON marketing_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_workflows_status ON marketing_workflows(status);

-- ============================================================================
-- 3. SUPPORT TICKET COMMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT
);

-- RLS Policies
ALTER TABLE support_ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage ticket comments"
  ON support_ticket_comments FOR ALL
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets 
      WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON support_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON support_ticket_comments(created_at);

-- ============================================================================
-- 4. COMPLIANCE & BATCH RECALL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  expiration_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'archived')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES compliance_documents(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  performed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batch_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  batch_number TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  recall_reason TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  affected_customers INTEGER DEFAULT 0,
  scope TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'in_progress', 'resolved', 'cancelled')),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS recall_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_id UUID REFERENCES batch_recalls(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID,
  notification_type TEXT CHECK (notification_type IN ('email', 'sms', 'phone')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Compliance
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE recall_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage compliance documents"
  ON compliance_documents FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can view document audit log"
  ON document_audit_log FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM compliance_documents 
      WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Tenants can manage batch recalls"
  ON batch_recalls FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can manage recall notifications"
  ON recall_notifications FOR ALL
  USING (
    recall_id IN (
      SELECT id FROM batch_recalls 
      WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_docs_tenant_id ON compliance_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_status ON compliance_documents(status);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON compliance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_audit_document_id ON document_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_batch_recalls_tenant_id ON batch_recalls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batch_recalls_status ON batch_recalls(status);
CREATE INDEX IF NOT EXISTS idx_recall_notif_recall_id ON recall_notifications(recall_id);

-- ============================================================================
-- 5. ADVANCED REPORTING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  data_sources JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '[]',
  dimensions JSONB DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  visualization_type TEXT DEFAULT 'table',
  chart_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES custom_reports(id) ON DELETE CASCADE NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_config JSONB DEFAULT '{}',
  recipients TEXT[] DEFAULT '{}',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Reporting
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage custom reports"
  ON custom_reports FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can manage scheduled reports"
  ON scheduled_reports FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_reports_tenant_id ON custom_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant_id ON scheduled_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_report_id ON scheduled_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE enabled = true;

-- ============================================================================
-- 6. PRODUCT DOCUMENTS TABLE (for COA display)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('coa', 'msds', 'label', 'other')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage product documents"
  ON product_documents FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_docs_tenant_id ON product_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_docs_product_id ON product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_product_docs_type ON product_documents(document_type);

-- ============================================================================
-- 7. CUSTOMER STORE CREDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  reason TEXT,
  transaction_type TEXT CHECK (transaction_type IN ('issued', 'redeemed', 'expired', 'refund')),
  order_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS customer_credit_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID NOT NULL UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage customer credits"
  ON customer_credits FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can view customer credit balance"
  ON customer_credit_balance FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_credits_tenant_id ON customer_credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credit_balance_tenant_id ON customer_credit_balance(tenant_id);

-- ============================================================================
-- 8. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers to all relevant tables
CREATE TRIGGER update_quality_control_tests_updated_at
  BEFORE UPDATE ON quality_control_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quarantined_inventory_updated_at
  BEFORE UPDATE ON quarantined_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketing_campaigns_updated_at
  BEFORE UPDATE ON marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketing_workflows_updated_at
  BEFORE UPDATE ON marketing_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_documents_updated_at
  BEFORE UPDATE ON compliance_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLETE: All backend database tables created
-- ============================================================================