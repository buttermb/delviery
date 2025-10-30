import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Shield, 
  ShieldOff, 
  Search, 
  CheckCircle2,
  XCircle,
  User,
  ShoppingBag,
  DollarSign,
  Eye,
  Ban,
  Lock,
  Download,
  AlertTriangle,
  UserCheck,
  Users,
  TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserProfile {
  id: string;
  user_id: string;
  age_verified: boolean;
  phone: string | null;
  full_name: string | null;
  created_at: string;
  email?: string;
  order_count?: number;
  total_spent?: number;
  account_status?: string;
  risk_score?: number;
  trust_level?: string;
  last_sign_in?: string;
  pending_orders?: number;
}

export default function AdminUsers() {
  const { session } = useAdminAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVerified, setFilterVerified] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session) fetchUsers();
  }, [session]);

  const fetchUsers = async () => {
    try {
      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("user_id, total_amount, status"),
      ]);

      const profiles = profilesRes.data || [];
      const orders = ordersRes.data || [];

      const ordersByUser = new Map<string, any[]>();
      orders.forEach(order => {
        if (!ordersByUser.has(order.user_id)) ordersByUser.set(order.user_id, []);
        ordersByUser.get(order.user_id)!.push(order);
      });

      const enriched = profiles.map(p => {
        const userOrders = ordersByUser.get(p.user_id) || [];
        return {
          ...p,
          email: "Email hidden", // Email requires service role key
          order_count: userOrders.length,
          total_spent: userOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0),
          pending_orders: userOrders.filter(o => ['pending', 'accepted', 'picked_up'].includes(o.status)).length,
        };
      });

      setUsers(enriched);
    } catch (error: any) {
      toast({ title: "Error loading users", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedUsers.size === 0) return;
    if (!confirm(`${status} ${selectedUsers.size} users?`)) return;

    try {
      await supabase.from("profiles").update({ account_status: status }).in("user_id", Array.from(selectedUsers));
      toast({ title: `✓ ${selectedUsers.size} users ${status}` });
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Bulk action failed", description: error.message, variant: "destructive" });
    }
  };

  const exportToCSV = () => {
    const csvData = filteredUsers.map(u => ({
      Name: u.full_name || "N/A",
      Email: u.email,
      Phone: u.phone || "N/A",
      Verified: u.age_verified ? "Yes" : "No",
      Orders: u.order_count || 0,
      "Total Spent": `$${(u.total_spent || 0).toFixed(2)}`,
      "Risk Score": u.risk_score || "N/A",
      "Trust Level": u.trust_level || "N/A",
      Status: u.account_status || "active",
      "Created At": new Date(u.created_at).toLocaleDateString(),
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(","),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: "✓ Exported to CSV" });
  };

  const filteredUsers = users.filter(u => {
    const match = u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const filter = filterVerified === "all" || 
                   (filterVerified === "verified" && u.age_verified) ||
                   (filterVerified === "unverified" && !u.age_verified);
    return match && filter;
  });

  const metrics = {
    total: users.length,
    verified: users.filter(u => u.age_verified).length,
    unverified: users.filter(u => !u.age_verified).length,
    flagged: users.filter(u => u.trust_level === 'flagged').length,
    vip: users.filter(u => u.trust_level === 'vip').length,
    totalRevenue: users.reduce((sum, u) => sum + (u.total_spent || 0), 0),
  };

  if (loading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              Verified Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.verified}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((metrics.verified / metrics.total) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              VIP Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.vip}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${metrics.totalRevenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4 items-center justify-between flex-wrap">
            <CardTitle>Users</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {selectedUsers.size > 0 && (
                <>
                  <Badge variant="secondary">{selectedUsers.size} selected</Badge>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("active")}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />Activate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("suspended")}>
                    <AlertTriangle className="h-4 w-4 mr-1" />Suspend
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("locked")}>
                    <Lock className="h-4 w-4 mr-1" />Lock
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => bulkUpdateStatus("banned")}>
                    <Ban className="h-4 w-4 mr-1" />Ban
                  </Button>
                </>
              )}
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Select value={filterVerified} onValueChange={setFilterVerified}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                    onCheckedChange={() => {
                      if (selectedUsers.size === filteredUsers.length) {
                        setSelectedUsers(new Set());
                      } else {
                        setSelectedUsers(new Set(filteredUsers.map(u => u.user_id)));
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trust Level</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.has(user.user_id)}
                      onCheckedChange={() => {
                        const newSet = new Set(selectedUsers);
                        if (newSet.has(user.user_id)) {
                          newSet.delete(user.user_id);
                        } else {
                          newSet.add(user.user_id);
                        }
                        setSelectedUsers(newSet);
                      }}
                    />
                  </TableCell>
                  <TableCell onClick={() => navigate(`/admin/users/${user.user_id}`)} className="cursor-pointer hover:underline">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5" />
                      <div>
                        <div className="font-medium">{user.full_name || "Customer"}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {user.age_verified ? (
                        <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
                      ) : (
                        <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Unverified</Badge>
                      )}
                      {user.account_status === 'banned' && (
                        <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Banned</Badge>
                      )}
                      {user.account_status === 'suspended' && (
                        <Badge variant="outline" className="border-orange-500 text-orange-500">
                          <AlertTriangle className="h-3 w-3 mr-1" />Suspended
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      user.trust_level === 'vip' ? 'default' :
                      user.trust_level === 'regular' ? 'secondary' :
                      user.trust_level === 'flagged' ? 'destructive' : 'outline'
                    }>
                      {user.trust_level || 'new'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.order_count || 0}</div>
                      {user.pending_orders > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {user.pending_orders} pending
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-green-600">${(user.total_spent || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_sign_in ? new Date(user.last_sign_in).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/admin/users/${user.user_id}`)}>
                      <Eye className="h-4 w-4 mr-1" />View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
