# Monitoring & Alerting Configuration

## Supabase Metrics to Track

### Database Performance
```sql
-- Create custom metrics view
CREATE OR REPLACE VIEW monitoring.database_health AS
SELECT
  current_timestamp as timestamp,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
  (SELECT count(*) FROM disposable_menus WHERE status = 'active') as active_menus,
  (SELECT count(*) FROM menu_orders WHERE created_at > now() - interval '1 hour') as orders_last_hour,
  (SELECT count(*) FROM menu_security_events WHERE created_at > now() - interval '1 hour') as security_events_last_hour;
```

### Cache Performance
```sql
-- Redis cache hit rate tracking
CREATE TABLE IF NOT EXISTS monitoring.cache_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  cache_hits bigint,
  cache_misses bigint,
  hit_rate numeric GENERATED ALWAYS AS (
    CASE WHEN (cache_hits + cache_misses) > 0 
    THEN (cache_hits::numeric / (cache_hits + cache_misses)) * 100 
    ELSE 0 END
  ) STORED
);
```

## Alert Thresholds

### Critical Alerts (SEV-1)
- Database CPU > 90% for 5 minutes
- Edge function error rate > 5%
- All menus auto-burned (potential attack)
- Redis connection lost

### High Priority Alerts (SEV-2)
- Database CPU > 80% for 10 minutes
- Edge function p95 latency > 1 second
- Menu access denied > 100 times/hour
- Cache hit rate < 60%

### Medium Priority Alerts (SEV-3)
- Database CPU > 70%
- Slow queries detected (>500ms)
- Failed customer messages > 10/hour

## Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Disposable Menus - Overview",
    "panels": [
      {
        "id": 1,
        "title": "Active Menus",
        "type": "stat",
        "targets": [
          {
            "expr": "SELECT count(*) FROM disposable_menus WHERE status = 'active'"
          }
        ]
      },
      {
        "id": 2,
        "title": "Menu Access Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "SELECT count(*) FROM menu_access_logs GROUP BY time(1m)"
          }
        ]
      },
      {
        "id": 3,
        "title": "Security Events",
        "type": "table",
        "targets": [
          {
            "expr": "SELECT * FROM menu_security_events ORDER BY created_at DESC LIMIT 50"
          }
        ]
      },
      {
        "id": 4,
        "title": "Cache Hit Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "SELECT hit_rate FROM monitoring.cache_metrics ORDER BY timestamp DESC LIMIT 1"
          }
        ],
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "value": 0, "color": "red" },
            { "value": 70, "color": "yellow" },
            { "value": 85, "color": "green" }
          ]
        }
      }
    ]
  }
}
```

## Sentry Configuration

```typescript
// src/lib/monitoring/sentry.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of errors
  
  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request?.url?.includes('/menu/')) {
      event.request.url = event.request.url.replace(/\/menu\/[^/]+/, '/menu/[REDACTED]');
    }
    return event;
  },
});
```

## Custom Alerts (Supabase Functions)

```typescript
// supabase/functions/monitoring-alerts/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Check database health
  const { data: dbHealth } = await supabase
    .from('monitoring.database_health')
    .select('*')
    .single();
  
  const alerts = [];
  
  if (dbHealth.active_connections > 50) {
    alerts.push({
      severity: 'high',
      message: `High database connections: ${dbHealth.active_connections}`,
    });
  }
  
  if (dbHealth.security_events_last_hour > 100) {
    alerts.push({
      severity: 'critical',
      message: `Spike in security events: ${dbHealth.security_events_last_hour}`,
    });
  }
  
  // Send to PagerDuty/Slack/etc
  if (alerts.length > 0) {
    await fetch(Deno.env.get('SLACK_WEBHOOK_URL')!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Alerts: ${alerts.map(a => a.message).join(', ')}`,
      }),
    });
  }
  
  return new Response(JSON.stringify({ alerts }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

## KPI Tracking

### Business Metrics
- Active menus per tenant
- Average menu lifetime
- Orders per menu
- Customer engagement rate

### Technical Metrics
- Edge function cold start rate
- Database query performance
- Cache efficiency
- Security incident rate

### User Experience Metrics  
- Menu load time (p95)
- Time to first interaction
- Error rate
- Support ticket volume
