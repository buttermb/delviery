-- Add time_slots column for scheduled delivery options
ALTER TABLE marketplace_stores
ADD COLUMN IF NOT EXISTS time_slots JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN marketplace_stores.time_slots IS 'Array of delivery time slots, e.g. [{label: "9am-12pm", start: "09:00", end: "12:00"}]';
