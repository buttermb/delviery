# Encryption Automation & Reporting

## Overview

The system automatically enforces encryption policies and sends weekly reports to tenant admins about unencrypted menus.

## Automatic Encryption on Creation

All new disposable menus are **automatically encrypted** when created through:

- ✅ Admin panel menu creation wizard
- ✅ Quick create dialog
- ✅ API endpoint (`create-encrypted-menu`)

### How It Works

1. User creates a menu through any frontend interface
2. Frontend calls `create-encrypted-menu` edge function
3. Menu is created in plaintext first (for validation)
4. `encrypt_disposable_menu()` database function is called
5. All sensitive data is encrypted with AES-256-CBC
6. `is_encrypted` flag is set to `true`
7. Audit log entry is created

### Verification

Check if a menu is encrypted:

```sql
SELECT id, name, is_encrypted, encryption_version
FROM disposable_menus
WHERE id = 'your-menu-id';
```

## Weekly Encryption Reports

### Purpose

Sends automated weekly reports to tenant admins showing:
- Number of unencrypted menus
- Security recommendations
- Direct link to encryption tool

### Setting Up Cron Job

#### Option 1: Supabase Cron Extension

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule weekly report (every Monday at 9 AM UTC)
SELECT cron.schedule(
  'weekly-encryption-report',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-encryption-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Verify cron job
SELECT * FROM cron.job;

-- View cron job runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

#### Option 2: External Cron Service (Easier Alternative)

Use services like:
- **Cron-job.org** (Free, easy setup)
- **EasyCron**
- **GitHub Actions**

Setup example for cron-job.org:
1. Go to https://cron-job.org
2. Create account and new cron job
3. URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-encryption-report`
4. Schedule: Every Monday at 9:00 AM
5. Add header: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
6. Method: POST

#### Option 3: GitHub Actions

Create `.github/workflows/weekly-encryption-report.yml`:

```yaml
name: Weekly Encryption Report

on:
  schedule:
    # Every Monday at 9 AM UTC
    - cron: '0 9 * * 1'
  workflow_dispatch: # Allow manual trigger

jobs:
  send-report:
    runs-on: ubuntu-latest
    steps:
      - name: Send Weekly Encryption Report
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-encryption-report
```

### Manual Trigger (Testing)

You can manually trigger the report from the admin panel:

1. Go to **Disposable Menus** page
2. Click **"Encryption"** button
3. Click **"Send Encryption Report Now"**

Or via API:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-encryption-report
```

### Report Content

The email report includes:
- 🔢 **Count** of unencrypted menus
- 📋 **Step-by-step** instructions to encrypt
- 🔗 **Direct link** to encryption tool
- ✅ **Confirmation** that new menus auto-encrypt
- 📅 **Weekly** delivery schedule

### Email Template Preview

```
🔐 Weekly Encryption Report

Hello [Business Name],

⚠️ You have 3 unencrypted menus

For maximum security and compliance, we recommend 
encrypting all disposable menus with AES-256 encryption.

🚀 How to Encrypt Your Menus:
1. Log in to your admin panel
2. Navigate to Disposable Menus
3. Click the "Encryption" button
4. Select "Encrypt All Unencrypted Menus"

[Encrypt Menus Now] (button)

✅ New menus are automatically encrypted when created 
through the admin panel
```

## Monitoring & Audit

### Check Report Status

```sql
-- View audit logs for weekly reports
SELECT *
FROM menu_decryption_audit
WHERE access_method = 'weekly_report'
ORDER BY accessed_at DESC
LIMIT 10;
```

### Check Encryption Coverage

```sql
-- Get encryption coverage per tenant
SELECT 
  t.business_name,
  COUNT(dm.id) as total_menus,
  COUNT(CASE WHEN dm.is_encrypted THEN 1 END) as encrypted_menus,
  ROUND(
    COUNT(CASE WHEN dm.is_encrypted THEN 1 END)::numeric / 
    NULLIF(COUNT(dm.id), 0) * 100, 
    2
  ) as encryption_percentage
FROM tenants t
LEFT JOIN disposable_menus dm ON dm.tenant_id = t.id
GROUP BY t.id, t.business_name
ORDER BY encryption_percentage ASC;
```

## Best Practices

1. ✅ **Set up cron job immediately** after deployment
2. ✅ **Test manually** before enabling automation
3. ✅ **Monitor audit logs** weekly
4. ✅ **Review encryption coverage** monthly
5. ✅ **Update email templates** as needed

## Troubleshooting

### Report Not Sending

1. Check cron job status:
```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-encryption-report';
```

2. Check edge function logs:
```bash
supabase functions logs weekly-encryption-report
```

3. Verify service role key is correct

4. Test manual trigger

### No Emails Received

- Check spam folder
- Verify tenant `owner_email` is correct
- Check audit logs for report generation
- Implement proper email service (SendGrid, Resend)

### False Positives

If menus show as unencrypted but are encrypted:
```sql
-- Re-check encryption status
UPDATE disposable_menus
SET is_encrypted = true
WHERE id IN (
  SELECT id FROM disposable_menus
  WHERE encrypted_name IS NOT NULL
  AND is_encrypted = false
);
```

## Security Notes

- 🔐 Service role key required for cron jobs
- 📝 All reports logged in audit table
- 🔒 HTTPS enforced for all requests
- 🛡️ Zen Firewall protection enabled
- ✉️ Email content sanitized and validated

## Future Enhancements

- [ ] SMS notifications for critical unencrypted count
- [ ] Slack/Discord webhook integration
- [ ] Custom report schedules per tenant
- [ ] Auto-encrypt after X days warning
- [ ] Compliance certificate generation
