/**
 * Super Admin Automation Dashboard
 * View and manage automated enforcement rules
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Settings,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  runsDaily: boolean;
  action: string;
}

export default function SuperAdminAutomation() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: 'usage-limits',
      name: 'Usage Limit Enforcement',
      description: 'Check usage limits and send warnings/disable features',
      enabled: true,
      runsDaily: true,
      action: 'Send warnings at 80%, disable at 100%',
    },
    {
      id: 'trial-expiration',
      name: 'Trial Expiration Management',
      description: 'Monitor trials and handle expirations',
      enabled: true,
      runsDaily: true,
      action: 'Email reminders 3 days before, suspend if no payment',
    },
    {
      id: 'payment-failures',
      name: 'Payment Failure Handling',
      description: 'Retry payments and suspend after 3 failures',
      enabled: true,
      runsDaily: true,
      action: 'Retry payment, suspend after 3 failures',
    },
    {
      id: 'health-scoring',
      name: 'Health Score Monitoring',
      description: 'Calculate and flag at-risk tenants',
      enabled: true,
      runsDaily: true,
      action: 'Flag tenants with score < 50',
    },
    {
      id: 'compliance',
      name: 'Compliance Checks',
      description: 'Monitor license expirations and compliance',
      enabled: true,
      runsDaily: true,
      action: 'Check licenses, suspend if expired',
    },
  ]);

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r))
    );

    toast({
      title: enabled ? 'Rule enabled' : 'Rule disabled',
      description: `Automation rule has been ${enabled ? 'activated' : 'deactivated'}`,
    });
  };

  const handleRunNow = async (ruleId: string) => {
    try {
      // In production, trigger the edge function
      const { error } = await supabase.functions.invoke('enforce-tenant-limits', {
        body: { rule_id: ruleId },
      });

      if (error) throw error;

      toast({
        title: 'Rule executed',
        description: 'Automation rule has been run successfully',
      });

      // Update last run time
      setRules((prev) =>
        prev.map((r) =>
          r.id === ruleId
            ? { ...r, lastRun: new Date().toISOString() }
            : r
        )
      );
    } catch (error: any) {
      toast({
        title: 'Failed to run rule',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Get recent enforcement events
  const { data: recentEvents } = useQuery({
    queryKey: ['automation-events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscription_events')
        .select('*')
        .in('event_type', [
          'usage_warning',
          'usage_limit_exceeded',
          'trial_expiring_soon',
          'trial_expired_suspended',
          'payment_reminder_sent',
          'tenant_at_risk',
          'license_expiring',
        ])
        .order('created_at', { ascending: false })
        .limit(20);

      return data || [];
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🤖 Automation & Enforcement</h1>
          <p className="text-muted-foreground">
            Automated rules that run daily to enforce limits and manage tenants
          </p>
        </div>
        <Button onClick={() => {
          // Run all enabled rules
          rules.filter((r) => r.enabled).forEach((r) => handleRunNow(r.id));
        }}>
          <Play className="h-4 w-4 mr-2" />
          Run All Now
        </Button>
      </div>

      {/* Automation Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <Card key={rule.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-semibold">{rule.name}</h3>
                  <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                <p className="text-xs text-muted-foreground">
                  <strong>Action:</strong> {rule.action}
                </p>
                {rule.lastRun && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last run: {formatSmartDate(rule.lastRun)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRunNow(rule.id)}
                  disabled={!rule.enabled}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Enforcement Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Enforcement Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentEvents?.map((event, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium text-sm">{event.event_type}</p>
                    <p className="text-xs text-muted-foreground">
                      Tenant: {event.tenant_id?.substring(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {formatSmartDate(event.created_at)}
                  </p>
                </div>
              </div>
            ))}
            {(!recentEvents || recentEvents.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No enforcement events yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Automation Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rules Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter((r) => r.enabled).length} / {rules.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Events Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentEvents?.filter(
                (e) =>
                  new Date(e.created_at).toDateString() === new Date().toDateString()
              ).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Warnings Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                recentEvents?.filter((e) => e.event_type === 'usage_warning').length ||
                0
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Actions Taken</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                recentEvents?.filter(
                  (e) =>
                    e.event_type.includes('suspended') ||
                    e.event_type.includes('disabled')
                ).length || 0
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

