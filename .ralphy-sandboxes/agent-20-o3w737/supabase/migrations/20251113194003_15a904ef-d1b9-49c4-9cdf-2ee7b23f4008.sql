-- Add custom_presets column to sidebar_preferences table
ALTER TABLE public.sidebar_preferences
ADD COLUMN IF NOT EXISTS custom_presets JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sidebar_preferences.custom_presets IS 'Array of custom user-created presets with name and visible features';

-- Example structure: [{"id": "my-preset-1", "name": "My Custom Layout", "visibleFeatures": ["dashboard", "products", ...]}]