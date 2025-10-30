import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatActionType } from "@/utils/stringHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskScoreBadge, TrustLevelBadge, AccountStatusBadge } from "@/components/admin/RiskScoreBadge";
import { RiskBreakdown } from "@/components/admin/RiskBreakdown";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Ban, Lock, CheckCircle, Monitor, Globe, History, ShieldAlert } from "lucide-react";

export default function AdminUserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [fraudFlags, setFraudFlags] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [ipAddresses, setIpAddresses] = useState<any[]>([]);
  const [accountLogs, setAccountLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchUserDetails();
    fetchRiskAssessment();
    fetchFraudFlags();
    fetchDevices();
    fetchIpAddresses();
    fetchAccountLogs();
  }, [id]);

  const fetchUserDetails = async () => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", id)
        .single();

      if (error) throw error;

      // Get user's addresses
      const { data: addresses } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", id);

      // Get user's orders
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      setUser({
        ...profile,
        addresses: addresses || [],
        orders: orders || [],
      });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      toast.error("Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  const fetchRiskAssessment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("assess-risk", {
        body: { userId: id }
      });

      if (error) {
        console.error("Error assessing risk:", error);
        // Use profile risk_score as fallback
        setRiskAssessment({
          score: user?.risk_score || 50,
          level: user?.trust_level || 'new',
          factors: [],
        });
        return;
      }
      setRiskAssessment(data);
    } catch (error: any) {
      console.error("Exception assessing risk:", error);
      setRiskAssessment({
        score: user?.risk_score || 50,
        level: user?.trust_level || 'new',
        factors: [],
      });
    }
  };

  const fetchFraudFlags = async () => {
    try {
      const { data, error } = await supabase
        .from("fraud_flags")
        .select("*")
        .eq("user_id", id)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFraudFlags(data || []);
    } catch (error: any) {
      console.error("Error fetching fraud flags:", error);
    }
  };

  const updateAccountStatus = async (status: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: status })
        .eq("user_id", id);

      if (error) throw error;

      // Log action
      await supabase.from("account_logs").insert({
        user_id: id,
        action_type: "status_change",
        description: `Account status changed to ${status}`,
        performed_by: (await supabase.auth.getUser()).data.user?.id,
      });

      toast.success(`Account ${status} successfully`);
      fetchUserDetails();
    } catch (error: any) {
      console.error("Error updating account:", error);
      toast.error("Failed to update account status");
    }
  };

  const updateLimit = async (limitType: string, value: string) => {
    try {
      const updates: any = {};
      if (limitType === "daily") updates.daily_limit = parseFloat(value);
      if (limitType === "weekly") updates.weekly_limit = parseFloat(value);
      if (limitType === "order") updates.order_limit = parseInt(value);

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", id);

      if (error) throw error;

      toast.success("Limit updated successfully");
      fetchUserDetails();
    } catch (error: any) {
      console.error("Error updating limit:", error);
      toast.error("Failed to update limit");
    }
  };

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("device_fingerprints")
        .select("*")
        .eq("user_id", id)
        .order("last_seen", { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error("Error fetching devices:", error);
    }
  };

  const fetchIpAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from("user_ip_addresses")
        .select("*")
        .eq("user_id", id)
        .order("last_seen", { ascending: false });

      if (error) throw error;
      setIpAddresses(data || []);
    } catch (error: any) {
      console.error("Error fetching IP addresses:", error);
    }
  };

  const fetchAccountLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("account_logs")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setAccountLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching account logs:", error);
    }
  };

  const blockDevice = async (fingerprint: string, reason: string) => {
    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;

      // Add to blocked devices
      const { error: blockError } = await supabase
        .from("blocked_devices")
        .insert({
          fingerprint,
          blocked_by: adminId,
          reason,
          user_id: id,
        });

      if (blockError) throw blockError;

      // Update device fingerprint
      const { error: updateError } = await supabase
        .from("device_fingerprints")
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_by: adminId,
          blocked_reason: reason,
        })
        .eq("fingerprint", fingerprint);

      if (updateError) throw updateError;

      toast.success("Device blocked successfully");
      fetchDevices();
    } catch (error: any) {
      console.error("Error blocking device:", error);
      toast.error("Failed to block device");
    }
  };

  const blockIpAddress = async (ipAddress: string, reason: string, permanent: boolean = true) => {
    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      const expiresAt = permanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { error } = await supabase
        .from("blocked_ips")
        .insert({
          ip_address: ipAddress,
          blocked_by: adminId,
          reason,
          expires_at: expiresAt,
        } as any);

      if (error) throw error;

      // Update user IP addresses
      await supabase
        .from("user_ip_addresses")
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_by: adminId,
          blocked_reason: reason,
        })
        .eq("ip_address", ipAddress)
        .eq("user_id", id);

      toast.success("IP address blocked successfully");
      fetchIpAddresses();
    } catch (error: any) {
      console.error("Error blocking IP:", error);
      toast.error("Failed to block IP address");
    }
  };

  const unblockDevice = async (fingerprint: string) => {
    try {
      // Remove from blocked devices
      await supabase
        .from("blocked_devices")
        .delete()
        .eq("fingerprint", fingerprint);

      // Update device fingerprint
      await supabase
        .from("device_fingerprints")
        .update({
          is_blocked: false,
          blocked_at: null,
          blocked_by: null,
          blocked_reason: null,
        })
        .eq("fingerprint", fingerprint);

      toast.success("Device unblocked");
      fetchDevices();
    } catch (error: any) {
      console.error("Error unblocking device:", error);
      toast.error("Failed to unblock device");
    }
  };

  const unblockIp = async (ipAddress: string) => {
    try {
      await supabase
        .from("blocked_ips")
        .delete()
        .eq("ip_address", ipAddress);

      await supabase
        .from("user_ip_addresses")
        .update({
          is_blocked: false,
          blocked_at: null,
          blocked_by: null,
          blocked_reason: null,
        })
        .eq("ip_address", ipAddress);

      toast.success("IP address unblocked");
      fetchIpAddresses();
    } catch (error: any) {
      console.error("Error unblocking IP:", error);
      toast.error("Failed to unblock IP");
    }
  };

  const resolveFraudFlag = async (flagId: string) => {
    try {
      const { error } = await supabase
        .from("fraud_flags")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", flagId);

      if (error) throw error;

      toast.success("Fraud flag resolved");
      fetchFraudFlags();
      fetchRiskAssessment();
    } catch (error: any) {
      console.error("Error resolving flag:", error);
      toast.error("Failed to resolve fraud flag");
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6">User not found</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin/users")}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Users
      </Button>

      {/* User Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-muted-foreground">ID: {user.user_id_code || user.user_id}</p>
              <p className="text-sm mt-2">
                {user.email} • {user.phone}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              <RiskScoreBadge score={user.risk_score} />
              <TrustLevelBadge level={user.trust_level} />
              <AccountStatusBadge status={user.account_status} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="devices">
            <Monitor className="w-4 h-4 mr-2" />
            Devices ({devices.length})
          </TabsTrigger>
          <TabsTrigger value="ips">
            <Globe className="w-4 h-4 mr-2" />
            IPs ({ipAddresses.length})
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="actions">
            <ShieldAlert className="w-4 h-4 mr-2" />
            Actions
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Risk Assessment Panel */}
              <Card>
                <CardHeader>
                  <CardTitle>Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <RiskBreakdown factors={riskAssessment?.factors} />

                  {fraudFlags.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h3 className="font-semibold">Active Fraud Flags</h3>
                      {fraudFlags.map((flag) => (
                        <Alert
                          key={flag.id}
                          variant={flag.severity === "critical" ? "destructive" : "default"}
                        >
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{(flag.flag_type || 'unknown').toUpperCase()}</AlertTitle>
                          <AlertDescription className="flex justify-between items-center">
                            <span>{flag.description}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveFraudFlag(flag.id)}
                            >
                              Resolve
                            </Button>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Spending Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle>Spending Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                      <p className="text-2xl font-bold">${user.total_spent?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                      <p className="text-2xl font-bold">{user.total_orders || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Order</p>
                      <p className="text-2xl font-bold">${user.average_order_value?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lifetime Value</p>
                      <p className="text-2xl font-bold">${user.lifetime_value?.toFixed(2) || "0.00"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Account Actions */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Indicators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Chargebacks</span>
                    <span className="font-semibold">{user.chargebacks || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed Payments</span>
                    <span className="font-semibold">{user.failed_payments || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cancelled Orders</span>
                    <span className="font-semibold">{user.cancelled_orders || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reported Issues</span>
                    <span className="font-semibold">{user.reported_issues || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>User Devices</CardTitle>
              <p className="text-sm text-muted-foreground">
                All devices used by this user. Block suspicious devices to prevent access.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>First Seen</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono text-xs">{device.fingerprint.slice(0, 8)}...</TableCell>
                      <TableCell>{device.device_type || "Unknown"}</TableCell>
                      <TableCell>{device.browser || "Unknown"}</TableCell>
                      <TableCell>{device.os || "Unknown"}</TableCell>
                      <TableCell>{new Date(device.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(device.last_seen).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {device.is_blocked ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : device.multiple_accounts ? (
                          <Badge variant="outline">Multiple Accounts</Badge>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {device.is_blocked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unblockDevice(device.fingerprint)}
                          >
                            Unblock
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const reason = prompt("Reason for blocking this device:");
                              if (reason) blockDevice(device.fingerprint, reason);
                            }}
                          >
                            Block
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IPs Tab */}
        <TabsContent value="ips">
          <Card>
            <CardHeader>
              <CardTitle>IP Addresses</CardTitle>
              <p className="text-sm text-muted-foreground">
                All IP addresses used by this user. Block IPs to prevent access from specific locations.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>First Seen</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Times Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipAddresses.map((ip) => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono">{ip.ip_address}</TableCell>
                      <TableCell>{new Date(ip.first_seen).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(ip.last_seen).toLocaleDateString()}</TableCell>
                      <TableCell>{ip.times_used}</TableCell>
                      <TableCell>
                        {ip.is_blocked ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {ip.is_blocked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unblockIp(ip.ip_address)}
                          >
                            Unblock
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                const reason = prompt("Reason for blocking this IP:");
                                if (reason) blockIpAddress(ip.ip_address, reason, true);
                              }}
                            >
                              Block Forever
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = prompt("Reason for blocking this IP:");
                                if (reason) blockIpAddress(ip.ip_address, reason, false);
                              }}
                            >
                              Block 30 Days
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Account Activity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Complete history of account changes and actions
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatActionType(log.action_type)}</Badge>
                      </TableCell>
                      <TableCell>{log.description}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ip_address || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => updateAccountStatus("active")}
                  disabled={user.account_status === "active"}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Activate Account
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => updateAccountStatus("suspended")}
                  disabled={user.account_status === "suspended"}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Suspend Account (Temporary)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => updateAccountStatus("locked")}
                  disabled={user.account_status === "locked"}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Lock Account (Security)
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => {
                    if (confirm("Are you sure you want to BAN this user? This is permanent and will block all their devices and IPs.")) {
                      updateAccountStatus("banned");
                      // Block all devices
                      devices.forEach(d => !d.is_blocked && blockDevice(d.fingerprint, "Account banned"));
                      // Block all IPs
                      ipAddresses.forEach(ip => !ip.is_blocked && blockIpAddress(ip.ip_address, "Account banned", true));
                    }
                  }}
                  disabled={user.account_status === "banned"}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  BAN User (Permanent)
                </Button>
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Ban</strong> blocks all devices and IPs permanently. 
                    <strong> Suspend</strong> is temporary. 
                    <strong> Lock</strong> is for security review.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spending Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Daily Limit ($)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      defaultValue={user.daily_limit}
                      onBlur={(e) => updateLimit("daily", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Weekly Limit ($)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      defaultValue={user.weekly_limit}
                      onBlur={(e) => updateLimit("weekly", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Orders Per Day</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      defaultValue={user.order_limit}
                      onBlur={(e) => updateLimit("order", e.target.value)}
                    />
                  </div>
                </div>
                <Alert className="mt-4">
                  <AlertDescription className="text-xs">
                    Set to 0 to completely restrict purchases. Lower limits for high-risk users.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}