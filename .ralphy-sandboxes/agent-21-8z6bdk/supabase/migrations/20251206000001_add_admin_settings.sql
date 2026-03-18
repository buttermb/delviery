-- Add admin settings columns to tenants table for Settings page persistence
-- These store Security, Notifications, and Printing preferences

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS admin_settings JSONB DEFAULT '{
  "security": {
    "twoFactorEnabled": false,
    "sessionTimeout": 30,
    "requirePasswordChange": false,
    "passwordMinLength": 8
  },
  "notifications": {
    "emailNotifications": true,
    "smsNotifications": false,
    "lowStockAlerts": true,
    "overdueAlerts": true,
    "orderAlerts": true
  },
  "printing": {
    "defaultPrinter": "",
    "labelSize": "4x6",
    "autoPrint": false,
    "includeBarcode": true,
    "includeQRCode": true
  }
}'::jsonb;

COMMENT ON COLUMN tenants.admin_settings IS 'JSON storage for admin panel settings: security, notifications, printing preferences';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tenants_admin_settings ON tenants USING GIN (admin_settings);
