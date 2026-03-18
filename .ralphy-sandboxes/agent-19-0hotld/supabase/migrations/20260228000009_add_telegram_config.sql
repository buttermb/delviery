-- ============================================================================
-- Migration: Add Telegram config to account_settings.notification_settings
-- Bead: floraiq-dy9.20 / task-330
-- ============================================================================
-- Consolidates all Telegram configuration into account_settings.notification_settings JSONB.
-- Fields added/ensured:
--   telegram_bot_token       (text)    — Bot API token for sending notifications
--   telegram_chat_id         (text)    — Target chat/group for order notifications
--   telegram_auto_forward    (boolean) — Auto-forward new orders to Telegram
--   telegram_customer_link   (text)    — Public Telegram link for confirmation page
--   telegram_button_label    (text)    — Button label shown to customers
--   show_telegram_on_confirmation (boolean) — Whether to show Telegram on confirmation
-- ============================================================================

-- 1. Update column default to include Telegram fields for new rows
ALTER TABLE account_settings
  ALTER COLUMN notification_settings
  SET DEFAULT jsonb_build_object(
    'email_enabled', true,
    'sms_enabled', true,
    'push_enabled', true,
    'telegram_bot_token', '',
    'telegram_chat_id', '',
    'telegram_auto_forward', false,
    'telegram_customer_link', '',
    'telegram_button_label', 'Chat with us on Telegram',
    'show_telegram_on_confirmation', false
  );

-- 2. Backfill existing rows: add Telegram keys with sensible defaults
--    Only sets keys that are missing (does NOT overwrite existing values).
UPDATE account_settings
SET notification_settings = COALESCE(notification_settings, '{}'::jsonb)
  || jsonb_build_object(
       'telegram_bot_token',
         COALESCE(notification_settings->>'telegram_bot_token', ''),
       'telegram_chat_id',
         COALESCE(notification_settings->>'telegram_chat_id', ''),
       'telegram_auto_forward',
         COALESCE((notification_settings->>'telegram_auto_forward')::boolean, false),
       'telegram_customer_link',
         COALESCE(notification_settings->>'telegram_customer_link', ''),
       'telegram_button_label',
         COALESCE(notification_settings->>'telegram_button_label', 'Chat with us on Telegram'),
       'show_telegram_on_confirmation',
         COALESCE((notification_settings->>'show_telegram_on_confirmation')::boolean, false)
     );

-- 3. Migrate crm_settings.telegram_video_link into notification_settings.telegram_customer_link
--    Only where crm_settings has a non-empty value AND account_settings.telegram_customer_link is empty.
UPDATE account_settings AS a
SET notification_settings = a.notification_settings
  || jsonb_build_object('telegram_customer_link', c.telegram_video_link)
FROM crm_settings AS c
WHERE c.account_id = a.account_id
  AND c.telegram_video_link IS NOT NULL
  AND c.telegram_video_link <> ''
  AND COALESCE(a.notification_settings->>'telegram_customer_link', '') = '';
