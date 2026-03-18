-- Migration: Add pinning support to order_notes table
-- Allows marking order notes as "pinned" for dashboard "Requires Attention" section

-- Add is_pinned column to order_notes
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Add pinned_at timestamp to track when a note was pinned
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Add pinned_by to track who pinned the note
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES auth.users(id);

-- Add pin_reason for categorizing pinned notes
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS pin_reason TEXT;

-- Create index for fast querying of pinned notes
CREATE INDEX IF NOT EXISTS idx_order_notes_pinned ON public.order_notes(tenant_id, is_pinned) WHERE is_pinned = true;

-- Create index for pinned notes by date
CREATE INDEX IF NOT EXISTS idx_order_notes_pinned_at ON public.order_notes(tenant_id, pinned_at DESC) WHERE is_pinned = true;

-- Add comments for documentation
COMMENT ON COLUMN public.order_notes.is_pinned IS 'Whether this note is pinned for dashboard attention';
COMMENT ON COLUMN public.order_notes.pinned_at IS 'Timestamp when the note was pinned';
COMMENT ON COLUMN public.order_notes.pinned_by IS 'User who pinned the note';
COMMENT ON COLUMN public.order_notes.pin_reason IS 'Reason/category for pinning (e.g., wrong_address, callback_needed, substitution_required)';
