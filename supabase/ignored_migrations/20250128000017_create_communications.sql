-- Communications Table
-- Tenant communication hub for announcements and campaigns

CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  recipients text[] NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('all', 'active', 'trial', 'specific')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES super_admins(id),
  status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')) DEFAULT 'draft',
  stats jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Message Templates Table
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('email', 'sms', 'notification')),
  variables jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES super_admins(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(status);
CREATE INDEX IF NOT EXISTS idx_communications_scheduled_at ON communications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_communications_created_by ON communications(created_by);

-- Enable Row Level Security
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Super admins can manage communications"
  ON communications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage templates"
  ON message_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE communications IS 'Stores tenant communications (announcements, campaigns)';
COMMENT ON TABLE message_templates IS 'Reusable message templates for communications';

