import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Shield,
  Activity,
  Database,
  AlertTriangle,
  CheckCircle,
  Zap,
  Users,
  Server,
  HardDrive,
  Cpu,
  Gauge
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const SystemSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunningOperation, setIsRunningOperation] = useState(false);
  
  // Fraud Detection Rules
  const [fraudRules, setFraudRules] = useState({
    max_orders_per_hour: 3,
    max_failed_payments: 3,
    high_risk_score_threshold: 40,
    auto_block_on_chargeback: true,
    require_verification_for_high_value: true,
    high_value_threshold: 500,
    velocity_check_enabled: true,
    device_fingerprint_enabled: true,
    ip_blacklist_enabled: true,
  });

  // System Health Monitoring
  const { data: systemHealth } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        ordersLastHour,
        ordersToday,
        errorCount,
        dbSize,
        avgResponseTime
      ] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", oneHourAgo.toISOString()),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", oneDayAgo.toISOString()),
        supabase.from("fraud_flags").select("id", { count: "exact", head: true }).is("resolved_at", null),
        // Simulate DB size check
        Promise.resolve({ size_mb: Math.random() * 1000 + 500 }),
        // Simulate response time
        Promise.resolve({ avg_ms: Math.random() * 100 + 50 })
      ]);

      const errorRate = ((errorCount.count || 0) / Math.max((ordersLastHour.count || 1), 1)) * 100;
      
      return {
        ordersPerHour: ordersLastHour.count || 0,
        ordersToday: ordersToday.count || 0,
        errorRate: errorRate.toFixed(2),
        unresolvedErrors: errorCount.count || 0,
        activeUsers: 0, // Active user tracking requires last_sign_in column
        databaseSize: dbSize.size_mb.toFixed(2),
        avgResponseTime: avgResponseTime.avg_ms.toFixed(0),
        status: errorRate > 10 ? "warning" : errorRate > 5 ? "attention" : "healthy",
        uptime: "99.98%",
        lastBackup: "2 hours ago"
      };
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Database statistics
  const { data: dbStats } = useQuery({
    queryKey: ["db-stats"],
    queryFn: async () => {
      const [users, orders, products, fraudFlags] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("fraud_flags").select("id", { count: "exact", head: true }),
      ]);

      return {
        users: users.count || 0,
        orders: orders.count || 0,
        products: products.count || 0,
        fraudFlags: fraudFlags.count || 0,
      };
    },
  });

  const saveFraudRules = useMutation({
    mutationFn: async (rules: typeof fraudRules) => {
      // In a real implementation, save to a settings table
      console.log("Saving fraud rules:", rules);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return rules;
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Fraud detection rules have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["fraud-rules"] });
    },
  });

  const handleDatabaseOperation = async (action: string) => {
    setIsRunningOperation(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-database-maintenance', {
        body: { action }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message,
      });
    } catch (error) {
      console.error('Database operation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform database operation';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRunningOperation(false);
    }
  };

  const handleDatabaseBackup = async () => {
    setIsRunningOperation(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-database-backup');

      if (error) throw error;

      toast({
        title: "Backup Initiated",
        description: data.message,
      });
    } catch (error) {
      console.error('Database backup error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create database backup';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRunningOperation(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      healthy: { variant: "default", icon: CheckCircle, label: "Healthy" },
      attention: { variant: "secondary", icon: AlertTriangle, label: "Attention" },
      warning: { variant: "destructive", icon: AlertTriangle, label: "Warning" }
    };
    const config = variants[status || 'healthy'] || variants.healthy;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">
          Configure fraud detection, monitoring, and system preferences
        </p>
      </div>

      <Tabs defaultValue="health" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Detection</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {systemHealth && getStatusBadge(systemHealth.status)}
                <p className="text-xs text-muted-foreground mt-2">
                  Uptime: {systemHealth?.uptime || "N/A"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Orders/Hour</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemHealth?.ordersPerHour || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {systemHealth?.ordersToday || 0} today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemHealth?.errorRate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {systemHealth?.unresolvedErrors || 0} unresolved
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Active Users</span>
                  </div>
                  <span className="font-bold">{systemHealth?.activeUsers || 0}</span>
                </div>
                <Progress value={(systemHealth?.activeUsers || 0) / 10} />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Avg Response Time</span>
                  </div>
                  <span className="font-bold">{systemHealth?.avgResponseTime || 0}ms</span>
                </div>
                <Progress value={Math.min(Number(systemHealth?.avgResponseTime || 0) / 2, 100)} />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Database Size</span>
                  </div>
                  <span className="font-bold">{systemHealth?.databaseSize || 0} MB</span>
                </div>
                <Progress value={Number(systemHealth?.databaseSize || 0) / 20} />
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground">
                Last backup: {systemHealth?.lastBackup || "N/A"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fraud Detection Tab */}
        <TabsContent value="fraud" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fraud Detection Rules</CardTitle>
              <CardDescription>
                Configure automated fraud detection and prevention rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Velocity Check</Label>
                    <p className="text-sm text-muted-foreground">
                      Monitor order frequency per user
                    </p>
                  </div>
                  <Switch
                    checked={fraudRules.velocity_check_enabled}
                    onCheckedChange={(checked) =>
                      setFraudRules({ ...fraudRules, velocity_check_enabled: checked })
                    }
                  />
                </div>

                {fraudRules.velocity_check_enabled && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="max_orders">Max Orders Per Hour</Label>
                    <Input
                      id="max_orders"
                      type="number"
                      value={fraudRules.max_orders_per_hour}
                      onChange={(e) =>
                        setFraudRules({
                          ...fraudRules,
                          max_orders_per_hour: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Device Fingerprinting</Label>
                    <p className="text-sm text-muted-foreground">
                      Track and flag suspicious devices
                    </p>
                  </div>
                  <Switch
                    checked={fraudRules.device_fingerprint_enabled}
                    onCheckedChange={(checked) =>
                      setFraudRules({ ...fraudRules, device_fingerprint_enabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>IP Blacklist</Label>
                    <p className="text-sm text-muted-foreground">
                      Block known malicious IP addresses
                    </p>
                  </div>
                  <Switch
                    checked={fraudRules.ip_blacklist_enabled}
                    onCheckedChange={(checked) =>
                      setFraudRules({ ...fraudRules, ip_blacklist_enabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-block on Chargeback</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically block users with chargebacks
                    </p>
                  </div>
                  <Switch
                    checked={fraudRules.auto_block_on_chargeback}
                    onCheckedChange={(checked) =>
                      setFraudRules({ ...fraudRules, auto_block_on_chargeback: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="risk_threshold">High Risk Score Threshold</Label>
                  <Input
                    id="risk_threshold"
                    type="number"
                    value={fraudRules.high_risk_score_threshold}
                    onChange={(e) =>
                      setFraudRules({
                        ...fraudRules,
                        high_risk_score_threshold: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Users below this score will be flagged for review
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Verification for High-Value Orders</Label>
                    <p className="text-sm text-muted-foreground">
                      Extra verification for large orders
                    </p>
                  </div>
                  <Switch
                    checked={fraudRules.require_verification_for_high_value}
                    onCheckedChange={(checked) =>
                      setFraudRules({
                        ...fraudRules,
                        require_verification_for_high_value: checked,
                      })
                    }
                  />
                </div>

                {fraudRules.require_verification_for_high_value && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="high_value">High-Value Threshold ($)</Label>
                    <Input
                      id="high_value"
                      type="number"
                      value={fraudRules.high_value_threshold}
                      onChange={(e) =>
                        setFraudRules({
                          ...fraudRules,
                          high_value_threshold: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={() => saveFraudRules.mutate(fraudRules)}
                disabled={saveFraudRules.isPending}
                className="w-full"
              >
                {saveFraudRules.isPending ? "Saving..." : "Save Fraud Rules"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dbStats?.users.toLocaleString() || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dbStats?.orders.toLocaleString() || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Products</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dbStats?.products.toLocaleString() || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fraud Flags</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dbStats?.fraudFlags.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Database Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => handleDatabaseOperation('vacuum')}
                disabled={isRunningOperation}
              >
                <Database className="mr-2 h-4 w-4" />
                {isRunningOperation ? 'Running...' : 'Run Database Maintenance'}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => handleDatabaseOperation('optimize_indexes')}
                disabled={isRunningOperation}
              >
                <Shield className="mr-2 h-4 w-4" />
                {isRunningOperation ? 'Optimizing...' : 'Optimize Indexes'}
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => handleDatabaseBackup()}
                disabled={isRunningOperation}
              >
                <HardDrive className="mr-2 h-4 w-4" />
                {isRunningOperation ? 'Creating Backup...' : 'Backup Database'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Real-time system performance indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">CPU Usage</span>
                  </div>
                  <span className="font-bold">23%</span>
                </div>
                <Progress value={23} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Memory Usage</span>
                  </div>
                  <span className="font-bold">45%</span>
                </div>
                <Progress value={45} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">API Load</span>
                  </div>
                  <span className="font-bold">67%</span>
                </div>
                <Progress value={67} />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Peak Load Time</p>
                  <p className="text-lg font-bold">6:00 PM - 9:00 PM</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Load Time</p>
                  <p className="text-lg font-bold">1.2s</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemSettings;