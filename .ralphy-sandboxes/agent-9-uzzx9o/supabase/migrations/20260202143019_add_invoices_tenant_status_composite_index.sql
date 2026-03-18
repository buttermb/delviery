-- Add composite index on invoices (tenant_id, status)
-- This index optimizes queries that filter by both tenant_id and status
-- Common query pattern: SELECT * FROM invoices WHERE tenant_id = ? AND status = ?

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON public.invoices(tenant_id, status);
