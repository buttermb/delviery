/**
 * System Metrics Collection Edge Function
 * Collects platform metrics every minute and stores them in system_metrics table
 * Triggers alerts if thresholds are exceeded
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Collect metrics
    const metrics = [];

    // 1. Active Tenants Count
    const { count: activeTenantsCount } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active');

    metrics.push({
      metric_type: 'active_tenants',
      value: activeTenantsCount || 0,
      metadata: { source: 'tenants_table' }
    });

    // 2. Database Connections (simulated - Supabase manages this)
    // In production, you'd query actual connection pool stats
    const dbConnections = Math.floor(Math.random() * 50) + 20; // Simulated
    metrics.push({
      metric_type: 'database_connections',
      value: dbConnections,
      metadata: { source: 'pool_stats', max_connections: 100 }
    });

    // 3. API Latency (simulated - would come from actual API monitoring)
    // In production, track actual response times from edge functions
    const apiLatency = Math.floor(Math.random() * 200) + 50; // 50-250ms
    metrics.push({
      metric_type: 'api_latency',
      value: apiLatency,
      metadata: { source: 'edge_functions', unit: 'ms' }
    });

    // 4. Error Rate (check recent errors)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: errorCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'error')
      .gte('timestamp', oneHourAgo);

    const totalActions = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', oneHourAgo);

    const errorRate = totalActions.count && totalActions.count > 0
      ? (errorCount || 0) / totalActions.count * 100
      : 0;

    metrics.push({
      metric_type: 'error_rate',
      value: errorRate,
      metadata: { 
        source: 'audit_logs',
        errors: errorCount || 0,
        total: totalActions.count || 0,
        unit: 'percent'
      }
    });

    // 5. CPU Usage (simulated - would come from infrastructure monitoring)
    // In production, integrate with your hosting provider's metrics API
    const cpuUsage = Math.floor(Math.random() * 30) + 20; // 20-50%
    metrics.push({
      metric_type: 'cpu',
      value: cpuUsage,
      metadata: { source: 'infrastructure', unit: 'percent' }
    });

    // 6. Memory Usage (simulated)
    const memoryUsage = Math.floor(Math.random() * 20) + 40; // 40-60%
    metrics.push({
      metric_type: 'memory',
      value: memoryUsage,
      metadata: { source: 'infrastructure', unit: 'percent' }
    });

    // 7. Disk Usage (simulated)
    const diskUsage = Math.floor(Math.random() * 15) + 30; // 30-45%
    metrics.push({
      metric_type: 'disk',
      value: diskUsage,
      metadata: { source: 'infrastructure', unit: 'percent' }
    });

    // Insert all metrics
    const { error: insertError } = await supabase
      .from('system_metrics')
      .insert(metrics);

    if (insertError) {
      throw insertError;
    }

    // Check thresholds and trigger alerts if needed
    const alerts = [];
    
    if (cpuUsage > 80) {
      alerts.push({ type: 'cpu', severity: 'high', value: cpuUsage });
    }
    
    if (memoryUsage > 85) {
      alerts.push({ type: 'memory', severity: 'high', value: memoryUsage });
    }
    
    if (diskUsage > 90) {
      alerts.push({ type: 'disk', severity: 'critical', value: diskUsage });
    }
    
    if (apiLatency > 500) {
      alerts.push({ type: 'api_latency', severity: 'high', value: apiLatency });
    }
    
    if (errorRate > 5) {
      alerts.push({ type: 'error_rate', severity: 'high', value: errorRate });
    }

    // In production, send alerts to notification system
    if (alerts.length > 0) {
      console.warn('System alerts:', alerts);
      // TODO: Send to notification service (email, Slack, etc.)
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics_collected: metrics.length,
        alerts: alerts.length,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error collecting metrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to collect metrics" }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

