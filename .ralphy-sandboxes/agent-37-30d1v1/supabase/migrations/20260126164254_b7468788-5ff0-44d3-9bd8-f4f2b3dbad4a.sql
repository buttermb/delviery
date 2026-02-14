-- Add missing status column to suspicious_login_alerts table
ALTER TABLE public.suspicious_login_alerts 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Create index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_suspicious_login_alerts_status 
ON public.suspicious_login_alerts(status);