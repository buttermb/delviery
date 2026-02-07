/**
 * Automation Cron Configuration
 * Documentation for setting up automated enforcement
 */

/**
 * To set up daily automation:
 * 
 * 1. Configure Supabase Cron Job:
 *    Run this SQL in Supabase SQL Editor:
 * 
 *    SELECT cron.schedule(
 *      'enforce-tenant-limits-daily',
 *      '0 0 * * *', -- Runs daily at midnight UTC
 *      $$
 *      SELECT net.http_post(
 *        url := 'https://YOUR_PROJECT.supabase.co/functions/v1/enforce-tenant-limits',
 *        headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
 *        body := '{}'::jsonb
 *      );
 *      $$
 *    );
 * 
 * 2. Or use Supabase Dashboard:
 *    - Go to Database > Cron Jobs
 *    - Create new cron job
 *    - Schedule: 0 0 * * * (daily at midnight)
 *    - Function: enforce-tenant-limits
 * 
 * 3. Or use external cron service:
 *    - Set up a cron job that calls:
 *      https://YOUR_PROJECT.supabase.co/functions/v1/enforce-tenant-limits
 *    - Include Authorization header with service role key
 * 
 * 4. For testing, you can trigger manually:
 *    - Use SuperAdminAutomation page "Run All Now" button
 *    - Or call the edge function directly via API
 */

export const AUTOMATION_SCHEDULE = {
  daily: '0 0 * * *', // Midnight UTC
  hourly: '0 * * * *', // Every hour
  every6hours: '0 */6 * * *', // Every 6 hours
};

export const AUTOMATION_ENDPOINT = '/functions/v1/enforce-tenant-limits';

