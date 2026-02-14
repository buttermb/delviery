/**
 * Alert Configuration Component
 * Configure alert thresholds and notification channels
 * Inspired by PagerDuty and Datadog alerting
 */

// @ts-nocheck
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bell, Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  condition: 'above' | 'below' | 'equals';
  channel: 'email' | 'webhook' | 'sms';
  enabled: boolean;
}

export function AlertConfig() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertRule[]>([
    {
      id: '1',
      name: 'High CPU Usage',
      metric: 'cpu',
      threshold: 80,
      condition: 'above',
      channel: 'email',
      enabled: true,
    },
    {
      id: '2',
      name: 'High Error Rate',
      metric: 'error_rate',
      threshold: 5,
      condition: 'above',
      channel: 'webhook',
      enabled: true,
    },
  ]);

  const [newAlert, setNewAlert] = useState({
    name: '',
    metric: 'cpu',
    threshold: 80,
    condition: 'above' as const,
    channel: 'email' as const,
  });

  const handleAdd = () => {
    if (!newAlert.name) {
      toast({
        title: 'Error',
        description: 'Please enter an alert name',
        variant: 'destructive',
      });
      return;
    }

    const alert: AlertRule = {
      id: Date.now().toString(),
      ...newAlert,
      enabled: true,
    };

    setAlerts([...alerts, alert]);
    setNewAlert({
      name: '',
      metric: 'cpu',
      threshold: 80,
      condition: 'above',
      channel: 'email',
    });

    toast({
      title: 'Alert Added',
      description: 'New alert rule has been created',
    });
  };

  const handleDelete = (id: string) => {
    setAlerts(alerts.filter((a) => a.id !== id));
    toast({
      title: 'Alert Deleted',
      description: 'Alert rule has been removed',
    });
  };

  const handleToggle = (id: string) => {
    setAlerts(
      alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alert Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Alert */}
        <div className="p-4 border rounded-lg space-y-4">
          <h3 className="font-semibold">Create New Alert</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Alert Name</Label>
              <Input
                value={newAlert.name}
                onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                placeholder="High CPU Usage"
              />
            </div>
            <div className="space-y-2">
              <Label>Metric</Label>
              <Select
                value={newAlert.metric}
                onValueChange={(value) => setNewAlert({ ...newAlert, metric: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpu">CPU Usage</SelectItem>
                  <SelectItem value="memory">Memory Usage</SelectItem>
                  <SelectItem value="disk">Disk Usage</SelectItem>
                  <SelectItem value="api_latency">API Latency</SelectItem>
                  <SelectItem value="error_rate">Error Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select
                value={newAlert.condition as string}
                onValueChange={(value: string) =>
                  setNewAlert({ ...newAlert, condition: value as 'above' | 'below' | 'equals' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Above</SelectItem>
                  <SelectItem value="below">Below</SelectItem>
                  <SelectItem value="equals">Equals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Threshold</Label>
              <Input
                type="number"
                value={newAlert.threshold}
                onChange={(e) =>
                  setNewAlert({
                    ...newAlert,
                    threshold: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notification Channel</Label>
              <Select
                value={newAlert.channel as string}
                onValueChange={(value: string) =>
                  setNewAlert({ ...newAlert, channel: value as 'email' | 'webhook' | 'sms' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Alert
              </Button>
            </div>
          </div>
        </div>

        {/* Existing Alerts */}
        <div className="space-y-2">
          <h3 className="font-semibold">Active Alerts</h3>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{alert.name}</p>
                      <Badge variant={alert.enabled ? 'default' : 'outline'}>
                        {alert.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alert.metric} {alert.condition} {alert.threshold}% →{' '}
                      {alert.channel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={alert.enabled}
                      onCheckedChange={() => handleToggle(alert.id)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No alerts configured</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

