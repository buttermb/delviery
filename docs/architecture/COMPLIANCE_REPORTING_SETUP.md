# 📊 Automated Compliance Reporting Setup

## Overview

This guide explains how to set up automated weekly compliance reports for encryption coverage across medical data (HIPAA), customer PII (GDPR), and financial data (Business Security).

---

## 🎯 What Gets Reported

The compliance report includes:

1. **Medical Data Encryption (HIPAA)**
   - `medical_patient_info` encryption status
   - `customers` medical fields (medical card, conditions, allergies)
   - Access audit logs

2. **Customer PII Encryption (GDPR)**
   - `customers` personal data (email, phone, address)
   - `customer_users` contact information
   - `wholesale_clients` personal details

3. **Financial Data Encryption (Business Security)**
   - `wholesale_clients` financial data (credit limit, balance)
   - `customer_payments` records
   - Transaction details

4. **Compliance Metrics**
   - Total records vs. encrypted records
   - Encryption coverage percentage
   - Unencrypted record counts
   - Last encryption date

---

## 🚀 Setup Options

### Option 1: Supabase pg_cron Extension (Recommended)

**Best for:** Native integration with your Supabase project

1. **Enable pg_cron extension** in your Supabase project SQL editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

2. **Schedule the weekly compliance report**:

```sql
-- Run every Monday at 9:00 AM UTC
SELECT cron.schedule(
  'weekly-compliance-report',
  '0 9 * * 1',  -- Every Monday at 9 AM
  $$
  SELECT net.http_post(
    url := 'https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/compliance-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlanVndG1od3drbnJvd2Z5emllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDA4OTcsImV4cCI6MjA3NzQxNjg5N30.R7S5uyha_U5oNc1IBXt8bThumQJSa8FuJZdgiWRgwek'
    ),
    body := jsonb_build_object(
      'action', 'weekly_report'
    )
  ) as request_id;
  $$
);
```

3. **Verify the cron job**:

```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-compliance-report';
```

4. **Check execution history**:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-compliance-report')
ORDER BY start_time DESC
LIMIT 10;
```

---

### Option 2: External Cron Service (cron-job.org, EasyCron)

**Best for:** No database access or preference for external services

1. Create account at [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com)

2. **Create new cron job** with:
   - **URL:** `https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/compliance-report`
   - **Method:** POST
   - **Headers:**
     ```
     Content-Type: application/json
     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlanVndG1od3drbnJvd2Z5emllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDA4OTcsImV4cCI6MjA3NzQxNjg5N30.R7S5uyha_U5oNc1IBXt8bThumQJSa8FuJZdgiWRgwek
     ```
   - **Body:**
     ```json
     { "action": "weekly_report" }
     ```
   - **Schedule:** Every Monday at 9:00 AM (your timezone)

---

### Option 3: GitHub Actions

**Best for:** Infrastructure as code and version control

1. Create `.github/workflows/compliance-report.yml`:

```yaml
name: Weekly Compliance Report

on:
  schedule:
    # Every Monday at 9:00 AM UTC
    - cron: '0 9 * * 1'
  workflow_dispatch:  # Allow manual triggering

jobs:
  send-compliance-report:
    runs-on: ubuntu-latest
    steps:
      - name: Send Compliance Report
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -d '{"action": "weekly_report"}' \
            https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/compliance-report
```

2. Add `SUPABASE_ANON_KEY` as a repository secret in GitHub Settings

3. **Manual trigger:** Go to Actions tab → Weekly Compliance Report → Run workflow

---

## 📧 Email Report Content

Recipients will receive an email with:

### Report Header
```
Subject: Weekly Compliance Report - [TENANT_NAME]
Date: [CURRENT_DATE]
```

### Compliance Status Overview
- ✅ HIPAA Compliance: X% encrypted
- ✅ GDPR Compliance: X% encrypted  
- ✅ Business Security: X% encrypted

### Detailed Breakdown

**Medical Data (HIPAA)**
- Medical Patient Info: X/Y encrypted (Z%)
- Customer Medical Fields: X/Y encrypted (Z%)
- Unencrypted records: [Count]

**Customer PII (GDPR)**
- Customer Records: X/Y encrypted (Z%)
- Customer Users: X/Y encrypted (Z%)
- Wholesale Clients: X/Y encrypted (Z%)
- Unencrypted records: [Count]

**Financial Data**
- Wholesale Clients: X/Y encrypted (Z%)
- Customer Payments: X/Y encrypted (Z%)
- Unencrypted records: [Count]

### Action Items
- [Specific recommendations based on encryption status]
- Link to Compliance Dashboard
- Link to Encryption Tool

### Audit Summary
- Recent access logs
- Last encryption operation
- Compliance score trend

---

## 🔧 Manual Report Generation

### Via Admin Panel

1. Navigate to **Admin → Compliance**
2. Click **"Generate Report Now"** button
3. Report will be sent to all tenant admins immediately

### Via API

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"action": "manual_report"}' \
  https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/compliance-report
```

---

## 📊 Monitoring & Verification

### Check Report Status

Query the audit tables to verify reports are being generated:

```sql
-- Check medical data access audit
SELECT 
  COUNT(*) as access_count,
  MAX(accessed_at) as last_access
FROM medical_data_access_audit
WHERE action = 'compliance_report_generated'
AND accessed_at > NOW() - INTERVAL '7 days';

-- Check PII access audit
SELECT 
  COUNT(*) as access_count,
  MAX(accessed_at) as last_access
FROM pii_access_audit
WHERE action = 'compliance_report_generated'
AND accessed_at > NOW() - INTERVAL '7 days';

-- Check financial data access audit
SELECT 
  COUNT(*) as access_count,
  MAX(accessed_at) as last_access
FROM financial_data_access_audit
WHERE action = 'compliance_report_generated'
AND accessed_at > NOW() - INTERVAL '7 days';
```

### Overall Encryption Coverage

```sql
-- Medical data encryption coverage
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_encrypted = true) as encrypted_records,
  ROUND(COUNT(*) FILTER (WHERE is_encrypted = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as encryption_percentage
FROM medical_patient_info;

-- Customer PII encryption coverage
SELECT 
  COUNT(*) as total_customers,
  COUNT(*) FILTER (WHERE is_encrypted = true) as encrypted_customers,
  ROUND(COUNT(*) FILTER (WHERE is_encrypted = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as encryption_percentage
FROM customers;

-- Financial data encryption coverage
SELECT 
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE is_encrypted = true) as encrypted_clients,
  ROUND(COUNT(*) FILTER (WHERE is_encrypted = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as encryption_percentage
FROM wholesale_clients;
```

---

## 🎛️ Configuration

### Customize Report Schedule

**Daily reports:**
```sql
-- pg_cron: Every day at 9 AM
SELECT cron.schedule('daily-compliance-report', '0 9 * * *', $$...$$);
```

**Bi-weekly reports:**
```sql
-- pg_cron: Every other Monday
SELECT cron.schedule('biweekly-compliance-report', '0 9 1,15 * *', $$...$$);
```

**Monthly reports:**
```sql
-- pg_cron: First Monday of each month
SELECT cron.schedule('monthly-compliance-report', '0 9 1-7 * 1', $$...$$);
```

### Customize Recipients

By default, reports are sent to all tenant admins (`tenant_users` with role='owner' or role='admin').

To customize recipients, modify the edge function or add an `admin_emails` configuration in your `tenants` table.

---

## 🛠️ Troubleshooting

### Reports Not Sending

1. **Check cron job status:**
```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-compliance-report';
```

2. **Check recent runs:**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-compliance-report')
ORDER BY start_time DESC
LIMIT 5;
```

3. **Verify edge function is working:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/compliance-report
```

### No Emails Received

1. **Verify email service is configured** in edge function
2. **Check spam/junk folders**
3. **Verify tenant admin emails** are correct in database
4. **Check edge function logs** for errors

### False Positives (Reports Show Unencrypted Data)

1. **Run batch encryption:**
   - Navigate to Admin → Compliance
   - Click "Encrypt All Data"

2. **Verify encryption:**
```sql
SELECT * FROM medical_patient_info WHERE is_encrypted = false LIMIT 5;
SELECT * FROM customers WHERE is_encrypted = false LIMIT 5;
SELECT * FROM wholesale_clients WHERE is_encrypted = false LIMIT 5;
```

---

## 🔒 Security Notes

1. **Service Role Key:** The edge function uses service role internally for encryption operations. The anon key in cron jobs is safe as the function validates tenant context.

2. **Audit Logging:** All report generations are logged in the respective audit tables with timestamps and action details.

3. **Data Protection:** Reports never contain actual unencrypted sensitive data, only statistics and metadata.

4. **Access Control:** Only authenticated tenant admins can trigger manual reports via the dashboard.

---

## 🚀 Future Enhancements

- **Slack/Teams Integration:** Send compliance alerts to team channels
- **SMS Notifications:** Critical alerts via SMS for urgent compliance issues
- **Custom Thresholds:** Set organization-specific encryption coverage targets
- **Compliance Trends:** Historical tracking and trend analysis
- **Automated Encryption:** Auto-encrypt new records on creation
- **Regulatory Export:** Generate HIPAA/GDPR compliance audit reports

---

## 📚 Related Documentation

- [ENCRYPTION_AUTOMATION.md](./ENCRYPTION_AUTOMATION.md) - Disposable menu encryption
- [RULES_COMPLIANCE_COMPLETE.md](../RULES_COMPLIANCE_COMPLETE.md) - Overall compliance status
- [FINAL_IMPLEMENTATION_STATUS.md](../FINAL_IMPLEMENTATION_STATUS.md) - Feature implementation

---

**Status:** ✅ Ready for Production | Compliance Reporting Automated
