-- Add sidebar customization columns to sidebar_preferences
ALTER TABLE sidebar_preferences 
ADD COLUMN IF NOT EXISTS hidden_features TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS section_order TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_sections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS enabled_integrations TEXT[] DEFAULT ARRAY['mapbox', 'stripe']::TEXT[],
ADD COLUMN IF NOT EXISTS custom_menu_items JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS layout_preset VARCHAR(50) DEFAULT 'default',
ADD COLUMN IF NOT EXISTS sidebar_behavior JSONB DEFAULT '{"autoCollapse": true, "iconOnly": false, "showTooltips": true}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN sidebar_preferences.hidden_features IS 'Array of feature IDs that user has hidden from sidebar';
COMMENT ON COLUMN sidebar_preferences.section_order IS 'Custom order of sections in sidebar';
COMMENT ON COLUMN sidebar_preferences.custom_sections IS 'User-created custom sections with items';
COMMENT ON COLUMN sidebar_preferences.enabled_integrations IS 'List of enabled third-party integrations';
COMMENT ON COLUMN sidebar_preferences.custom_menu_items IS 'User-created custom menu items';
COMMENT ON COLUMN sidebar_preferences.layout_preset IS 'Selected layout preset name';
COMMENT ON COLUMN sidebar_preferences.sidebar_behavior IS 'Sidebar behavior settings';