-- Add trial reminder columns for 7 and 3 days
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS trial_reminder_7_days_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_reminder_3_days_sent BOOLEAN DEFAULT FALSE;

-- Rename existing columns to be more generic if possible, or just keep using them
-- We will map:
-- 7 days remaining -> trial_reminder_7_days_sent
-- 3 days remaining -> trial_reminder_3_days_sent
-- 1 day remaining -> trial_reminder_13_sent (existing) or maybe add trial_reminder_1_day_sent for clarity?

-- Let's add clear columns for 1 day and 0 days to avoid confusion with the "12/13/14" naming which assumes 14 day trial
ADD COLUMN IF NOT EXISTS trial_reminder_1_day_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_reminder_0_day_sent BOOLEAN DEFAULT FALSE;

-- We can migrate data if needed, but for now we'll just start using the new columns
