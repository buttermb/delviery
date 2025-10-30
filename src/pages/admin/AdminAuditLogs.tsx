import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText,
  Search,
  Clock,
  User,
  Shield
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  action: string;
  user_id?: string | null;
  admin_id?: string | null;
  details: any;
  ip_address: string | null;
  user_agent?: string | null;
  created_at: string;
}

const AdminAuditLogs = () => {
  const { session } = useAdminAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  useEffect(() => {
    if (!session) return;
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    fetchAuditLogs();

    const setupChannel = async () => {
      channel = supabase
        .channel('admin-audit-logs-updates', {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'audit_logs'
          },
          (payload) => {
            console.log('New audit log:', payload);
            fetchAuditLogs();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'admin_audit_logs'
          },
          (payload) => {
            console.log('New admin audit log:', payload);
            fetchAuditLogs();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to audit logs channel');
          }
        });
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, [session]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      // Fetch regular audit logs
      const { data: logs, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Fetch admin audit logs
      const { data: adminLogs, error: adminLogsError } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (adminLogsError) throw adminLogsError;

      // Combine and sort logs
      const combinedLogs = [...(logs || []), ...(adminLogs || [])];
      combinedLogs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setAuditLogs(combinedLogs);
    } catch (error: any) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const actionLower = (action || '').toLowerCase();
    
    if (actionLower.includes('create') || actionLower.includes('insert')) {
      return <Badge className="bg-green-600">Create</Badge>;
    }
    if (actionLower.includes('update') || actionLower.includes('edit')) {
      return <Badge className="bg-blue-600">Update</Badge>;
    }
    if (actionLower.includes('delete') || actionLower.includes('remove')) {
      return <Badge variant="destructive">Delete</Badge>;
    }
    if (actionLower.includes('login') || actionLower.includes('access')) {
      return <Badge className="bg-purple-600">Access</Badge>;
    }
    return <Badge variant="secondary">{action}</Badge>;
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entity_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entity_id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = 
      filterAction === "all" ||
      (log.action || '').toLowerCase().includes(filterAction.toLowerCase());

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          Track all system actions and changes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Actions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {auditLogs.filter(log => 'admin_id' in log).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Actions</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {auditLogs.filter(log => 'user_id' in log && log.user_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle>Activity Log</CardTitle>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>User/Admin</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.slice(0, 50).map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>
                    <code className="text-xs">{log.entity_type || "N/A"}</code>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">
                      {log.entity_id ? log.entity_id.substring(0, 8) + "..." : "N/A"}
                    </code>
                  </TableCell>
                  <TableCell>
                    {'admin_id' in log && log.admin_id ? (
                      <Badge variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <User className="h-3 w-3 mr-1" />
                        User
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{log.ip_address || "N/A"}</code>
                  </TableCell>
                  <TableCell>
                    {log.details && typeof log.details === 'object' ? (
                      <code className="text-xs">
                        {JSON.stringify(log.details).substring(0, 50)}...
                      </code>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No logs found
            </div>
          )}
          
          {filteredLogs.length > 50 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Showing 50 of {filteredLogs.length} logs
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuditLogs;
