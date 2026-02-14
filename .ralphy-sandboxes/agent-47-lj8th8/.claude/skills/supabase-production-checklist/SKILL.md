---
name: supabase-production-checklist
description: Production deployment checklist for Supabase projects. Pre-flight checks, performance tuning, security hardening, monitoring, and rollback strategies.
---

# Supabase Production Checklist

Ensure your Supabase deployment is production-ready.

## Pre-Deployment Checklist

### Database Security

- [ ] **RLS Enabled on ALL tables**
  ```sql
  -- Check for tables without RLS
  SELECT schemaname, tablename 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename NOT IN (
    SELECT tablename FROM pg_policies WHERE schemaname = 'public'
  );
  ```

- [ ] **No public access to sensitive data**
  ```sql
  -- Ensure tenant isolation
  SELECT * FROM products WHERE tenant_id IS NULL; -- Should return 0
  ```

- [ ] **SECURITY DEFINER functions have search_path**
  ```sql
  CREATE OR REPLACE FUNCTION my_function()
  RETURNS void
  SECURITY DEFINER
  SET search_path = public  -- CRITICAL
  AS $$ ... $$;
  ```

### Authentication

- [ ] Email confirmations enabled (if required)
- [ ] Password strength requirements set
- [ ] JWT expiry configured appropriately
- [ ] Refresh token rotation enabled
- [ ] Rate limiting on auth endpoints

### API Security

- [ ] API key not exposed in client code
- [ ] Service role key only on server-side
- [ ] CORS configured for production domain only

## Performance Optimization

### Database Indexes

```sql
-- Check for missing indexes on foreign keys
SELECT 
  c.conrelid::regclass AS table_name,
  a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
AND NOT EXISTS (
  SELECT 1 FROM pg_index i 
  WHERE i.indrelid = c.conrelid 
  AND a.attnum = ANY(i.indkey)
);
```

### Query Optimization

- [ ] `tenant_id` indexed on all tenant tables
- [ ] Frequently filtered columns indexed
- [ ] Composite indexes for common query patterns
- [ ] EXPLAIN ANALYZE on slow queries

### Connection Pooling

- [ ] Supavisor enabled for production
- [ ] Connection limits appropriate for scale
- [ ] Prepared statements for repeated queries

## Monitoring & Observability

### Enable Logging

```sql
-- Enable query logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = '1000'; -- 1 second
SELECT pg_reload_conf();
```

### Key Metrics to Monitor

- [ ] Database connections (current vs max)
- [ ] Query latency (p50, p95, p99)
- [ ] Disk usage and growth rate
- [ ] RLS policy execution time
- [ ] Edge Function cold starts

## Backup & Recovery

### Automated Backups

- [ ] Daily backups enabled
- [ ] Point-in-time recovery configured
- [ ] Backup retention period set
- [ ] Test restore procedure documented

### Rollback Strategy

```sql
-- Create migration rollback scripts
-- For each migration, have a corresponding rollback

-- 20260114_add_feature.sql
ALTER TABLE products ADD COLUMN new_feature text;

-- 20260114_add_feature_rollback.sql
ALTER TABLE products DROP COLUMN new_feature;
```

## Edge Functions

### Production Settings

- [ ] Memory limits appropriate
- [ ] Timeout values set
- [ ] Environment variables configured
- [ ] Error handling and logging in place
- [ ] CORS headers correct

### Deployment

```bash
# Deploy with verification
supabase functions deploy function-name

# Verify deployment
curl https://your-project.supabase.co/functions/v1/function-name
```

## Final Checks

| Check | Status | Notes |
|-------|--------|-------|
| All migrations applied | ⬜ | |
| RLS policies on all tables | ⬜ | |
| Indexes created | ⬜ | |
| Environment variables set | ⬜ | |
| Backup tested | ⬜ | |
| Monitoring configured | ⬜ | |
| Rate limiting enabled | ⬜ | |
| CORS configured | ⬜ | |
