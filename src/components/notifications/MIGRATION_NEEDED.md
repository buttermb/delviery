# Notification System - Database Migration Required

## Missing Table: `in_app_notifications`

The notification center components require an `in_app_notifications` table that doesn't exist yet.

### Required SQL Migration

```sql
-- Create in_app_notifications table
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_in_app_notifications_tenant_user ON in_app_notifications(tenant_id, user_id);
CREATE INDEX idx_in_app_notifications_read ON in_app_notifications(tenant_id, user_id, read);
CREATE INDEX idx_in_app_notifications_type ON in_app_notifications(tenant_id, type);
CREATE INDEX idx_in_app_notifications_created ON in_app_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON in_app_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON in_app_notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON in_app_notifications FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON in_app_notifications FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_in_app_notifications_updated_at
  BEFORE UPDATE ON in_app_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Realtime Subscription Setup

Enable realtime on the table:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE in_app_notifications;
```

## Alternative: Use Existing Tables

Until the migration is run, components will gracefully handle missing tables and show appropriate loading/error states.

The notification system is designed to:
1. Check for table existence
2. Fall back gracefully if table is missing
3. Use existing `notification_preferences` table which already exists
4. Log appropriate errors for debugging

## Implementation Status

- [ ] Run database migration to create `in_app_notifications` table
- [x] NotificationCenter component (needs table)
- [x] NotificationItem component
- [x] NotificationHistory component
- [x] NotificationPreferences component (works with existing table)
- [x] useNotifications hook (needs table)
- [x] useNotificationBadges hook (uses existing tables)
- [x] Notification helper functions (needs table)
- [x] Deduplication utilities (needs table)
