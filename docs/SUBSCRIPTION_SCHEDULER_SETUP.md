# Subscription Management Scheduler Setup

## Overview
This document explains how to set up automated scheduling for subscription management tasks.

## Edge Functions to Schedule

### 1. Check Expired Trials
**Function:** `check-expired-trials`
**Purpose:** Automatically suspend accounts with expired trials
**Recommended Schedule:** Daily at 2:00 AM UTC

### 2. Trial Expiration Notices
**Function:** `send-trial-expiration-notice`
**Purpose:** Send warning emails 3 days and 1 day before trial expiration
**Recommended Schedule:** Daily at 10:00 AM UTC

### 3. Trial Expired Notices
**Function:** `send-trial-expired-notice`
**Purpose:** Send notification after trial expires
**Recommended Schedule:** Daily at 11:00 AM UTC

---

## Scheduling Options

### Option 1: pg_cron (Recommended for Supabase)

Enable pg_cron extension in Supabase:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule check-expired-trials (daily at 2 AM UTC)
SELECT cron.schedule(
  'check-expired-trials',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/check-expired-trials',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule trial expiration notices (daily at 10 AM UTC)
SELECT cron.schedule(
  'send-trial-expiration-notice',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/send-trial-expiration-notice',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule expired notices (daily at 11 AM UTC)
SELECT cron.schedule(
  'send-trial-expired-notice',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/send-trial-expired-notice',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**View Scheduled Jobs:**
```sql
SELECT * FROM cron.job;
```

**Remove a Job:**
```sql
SELECT cron.unschedule('check-expired-trials');
```

---

### Option 2: External Cron Service (Cron-job.org, EasyCron)

Set up HTTP requests to trigger edge functions:

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/check-expired-trials`
**Method:** POST
**Headers:**
- `Authorization: Bearer YOUR_ANON_KEY`
- `Content-Type: application/json`

**Schedule:**
- Check expired trials: Daily at 02:00 UTC
- Trial expiration notices: Daily at 10:00 UTC
- Trial expired notices: Daily at 11:00 UTC

---

### Option 3: GitHub Actions (Free for public repos)

Create `.github/workflows/subscription-tasks.yml`:

```yaml
name: Subscription Management Tasks

on:
  schedule:
    # Check expired trials - Daily at 2 AM UTC
    - cron: '0 2 * * *'
    # Trial expiration notices - Daily at 10 AM UTC
    - cron: '0 10 * * *'
    # Trial expired notices - Daily at 11 AM UTC
    - cron: '0 11 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  check-expired-trials:
    if: github.event.schedule == '0 2 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Call check-expired-trials
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/check-expired-trials

  send-trial-expiration-notice:
    if: github.event.schedule == '0 10 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Call send-trial-expiration-notice
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/send-trial-expiration-notice

  send-trial-expired-notice:
    if: github.event.schedule == '0 11 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Call send-trial-expired-notice
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/send-trial-expired-notice
```

Add secrets in GitHub Settings > Secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## Testing

Test edge functions manually:

```bash
# Test check-expired-trials
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT.supabase.co/functions/v1/check-expired-trials

# Test trial expiration notices
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT.supabase.co/functions/v1/send-trial-expiration-notice

# Test expired notices
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT.supabase.co/functions/v1/send-trial-expired-notice
```

---

## Monitoring

Monitor edge function logs in Supabase Dashboard:
1. Go to Edge Functions
2. Select function
3. View Logs tab

Set up alerts for:
- Function failures
- High error rates
- Unusual activity

---

## Email Integration

The edge functions are ready for email integration. To enable:

1. **SendGrid (Recommended):**
   - Add `SENDGRID_API_KEY` secret
   - Uncomment SendGrid code in functions
   - Configure sender email

2. **Alternative Providers:**
   - Modify functions to use your email API
   - Add required secrets/credentials

---

## Best Practices

1. **Always test first** - Run functions manually before scheduling
2. **Monitor logs** - Check function execution logs regularly
3. **Set up alerts** - Get notified of failures
4. **Backup strategy** - Have manual override process
5. **Rate limiting** - Ensure email provider can handle volume
6. **Data retention** - Clean up old notification records

---

## Troubleshooting

**Function not running:**
- Check scheduler is active
- Verify credentials are correct
- Check function logs for errors

**Emails not sending:**
- Verify email service credentials
- Check spam folders
- Review email service quotas

**Performance issues:**
- Batch email sending
- Use background tasks
- Optimize database queries
