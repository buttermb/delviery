-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.report_executions CASCADE;
DROP TABLE IF EXISTS public.custom_reports CASCADE;

-- Create custom reports table
CREATE TABLE public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  selected_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '{}'::jsonb,
  date_range TEXT DEFAULT 'month',
  custom_start_date DATE,
  custom_end_date DATE,
  schedule TEXT DEFAULT 'none',
  schedule_time TIME,
  schedule_day_of_week INTEGER,
  schedule_day_of_month INTEGER,
  email_recipients TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create report executions log
CREATE TABLE public.report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.custom_reports(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  executed_by UUID,
  execution_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  result_count INTEGER,
  result_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_reports
CREATE POLICY "Users can view reports for their tenant"
  ON public.custom_reports FOR SELECT
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.accounts a
    JOIN public.profiles p ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can create reports for their tenant"
  ON public.custom_reports FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT a.tenant_id FROM public.accounts a
    JOIN public.profiles p ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update reports for their tenant"
  ON public.custom_reports FOR UPDATE
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.accounts a
    JOIN public.profiles p ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete reports for their tenant"
  ON public.custom_reports FOR DELETE
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.accounts a
    JOIN public.profiles p ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

-- RLS Policies for report_executions
CREATE POLICY "Users can view executions for their tenant"
  ON public.report_executions FOR SELECT
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.accounts a
    JOIN public.profiles p ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can create executions for their tenant"
  ON public.report_executions FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT a.tenant_id FROM public.accounts a
    JOIN public.profiles p ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_custom_reports_tenant ON public.custom_reports(tenant_id);
CREATE INDEX idx_custom_reports_type ON public.custom_reports(report_type);
CREATE INDEX idx_custom_reports_active ON public.custom_reports(is_active);
CREATE INDEX idx_report_executions_report ON public.report_executions(report_id);
CREATE INDEX idx_report_executions_tenant ON public.report_executions(tenant_id);