-- ============================================================================
-- Migration: Add telegram_config JSONB column to marketplace_stores
-- Purpose: Store per-store Telegram notification settings for storefront orders
-- Fields:
--   bot_token       (text)    — Bot API token for sending notifications
--   chat_id         (text)    — Target chat/group for order notifications
--   auto_forward    (boolean) — Auto-forward new orders to Telegram
--   customer_link   (text)    — Public Telegram link for order confirmation page
--   button_label    (text)    — Label for the Telegram button on confirmation page
--   show_on_confirmation (boolean) — Whether to show Telegram link on confirmation
-- ============================================================================

-- 1. Add telegram_config JSONB column with sensible defaults
ALTER TABLE marketplace_stores
  ADD COLUMN IF NOT EXISTS telegram_config JSONB DEFAULT jsonb_build_object(
    'bot_token', '',
    'chat_id', '',
    'auto_forward', false,
    'customer_link', '',
    'button_label', 'Chat with us on Telegram',
    'show_on_confirmation', false
  );

-- 2. Backfill existing rows with default values
UPDATE marketplace_stores
SET telegram_config = jsonb_build_object(
  'bot_token', '',
  'chat_id', '',
  'auto_forward', false,
  'customer_link', '',
  'button_label', 'Chat with us on Telegram',
  'show_on_confirmation', false
)
WHERE telegram_config IS NULL;
