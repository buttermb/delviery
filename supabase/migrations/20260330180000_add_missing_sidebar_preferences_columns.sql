-- Add missing sidebar_preferences columns that the frontend queries
-- These columns were referenced in useSidebarPreferences.ts but didn't exist in the table

ALTER TABLE public.sidebar_preferences
ADD COLUMN IF NOT EXISTS section_order jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_sections jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS enabled_integrations jsonb DEFAULT '["mapbox", "stripe"]'::jsonb,
ADD COLUMN IF NOT EXISTS layout_preset text DEFAULT 'default';
