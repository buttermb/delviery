import { useState, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Search, Download, Filter } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  // Fetch audit logs from database
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.auditLogs(actionFilter),
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('id, action, resource_type, resource_id, tenant_id, actor_id, actor_type, timestamp, changes')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch tenant names for display
  const tenantIds = useMemo(() => 
    [...new Set(auditLogs.map(log => log.tenant_id).filter(Boolean))] as string[], 
    [auditLogs]
  );

  const { data: tenants = [] } = useQuery({
    queryKey: queryKeys.superAdminTools.auditLogsTenants(tenantIds),
    queryFn: async () => {
      if (tenantIds.length === 0) return [];
      const { data } = await supabase
        .from('tenants')
        .select('id, business_name')
        .in('id', tenantIds);
      return data ?? [];
    },
    enabled: tenantIds.length > 0,
  });

  const tenantMap = useMemo(() => 
    new Map(tenants.map(t => [t.id, t.business_name])), 
    [tenants]
  );

  // Fetch actor emails (super admins)
  const actorIds = useMemo(() => 
    [...new Set(auditLogs.map(log => log.actor_id).filter(Boolean))] as string[], 
    [auditLogs]
  );

  const { data: actors = [] } = useQuery({
    queryKey: queryKeys.superAdminTools.auditLogsActors(actorIds),
    queryFn: async () => {
      if (actorIds.length === 0) return [];
      const { data } = await supabase
        .from('super_admins')
        .select('id, email')
        .in('id', actorIds);
      return (data ?? []) as { id: string; email: string }[];
    },
    enabled: actorIds.length > 0,
  });

  const actorMap = useMemo(() => 
    new Map(actors.map(a => [a.id, a.email])), 
    [actors]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalLogs = auditLogs.length;
    const todayLogs = auditLogs.filter(log => 
      new Date(log.timestamp ?? 0) >= today
    ).length;
    const failedLogs = auditLogs.filter(log => 
      log.action?.includes('error') || log.action?.includes('failed')
    ).length;
    const uniqueActors = new Set(auditLogs.map(log => log.actor_id).filter(Boolean)).size;

    return { totalLogs, todayLogs, failedLogs, uniqueActors };
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const actorEmail = log.actor_id ? actorMap.get(log.actor_id) : '';
      const tenantName = log.tenant_id ? tenantMap.get(log.tenant_id) : '';
      const target = log.resource_type ?? tenantName ?? '';
      
      const matchesSearch = !searchTerm || 
        actorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        target.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [auditLogs, searchTerm, actorMap, tenantMap]);

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      tenant_created: 'bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]',
      tenant_suspended: 'bg-[hsl(var(--super-admin-accent))]/20 text-[hsl(var(--super-admin-accent))]',
      tenant_updated: 'bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))]',
      feature_flag_updated: 'bg-blue-500/20 text-blue-400',
      impersonation_started: 'bg-yellow-500/20 text-yellow-400',
      system_config_updated: 'bg-purple-500/20 text-purple-400',
    };

    return (
      <Badge className={`${colors[action] || 'bg-white/10 text-white'}`}>
        {action.replace(/_/g, ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📋 Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Track all system activities</p>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Logs</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{stats.totalLogs.toLocaleString()}</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Today's Actions</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{stats.todayLogs}</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Admin actions</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Failed Actions</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{stats.failedLogs}</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Active Users</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{stats.uniqueActors}</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Super admins</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--super-admin-text))]/50" />
                <Input
                  placeholder="Search logs by user or target..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black/20 border-white/10 text-[hsl(var(--super-admin-text))]"
                  aria-label="Search audit logs"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[200px] bg-black/20 border-white/10 text-[hsl(var(--super-admin-text))]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="tenant_created">Tenant Created</SelectItem>
                  <SelectItem value="tenant_updated">Tenant Updated</SelectItem>
                  <SelectItem value="tenant_suspended">Tenant Suspended</SelectItem>
                  <SelectItem value="feature_flag_updated">Feature Flag</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="border-white/10 text-[hsl(var(--super-admin-text))]">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">
              Recent Activity ({filteredLogs.length} logs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Timestamp</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">User</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Action</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Target</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Loading audit logs...
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const actorEmail = log.actor_id ? actorMap.get(log.actor_id) : log.actor_type || 'System';
                      const tenantName = log.tenant_id ? tenantMap.get(log.tenant_id) : '';
                      const target = tenantName || log.resource_type || 'N/A';
                      
                      return (
                        <TableRow key={log.id} className="border-white/10">
                          <TableCell className="text-[hsl(var(--super-admin-text))]/70 font-mono text-xs">
                            {log.timestamp 
                              ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-[hsl(var(--super-admin-text))]">{actorEmail}</TableCell>
                          <TableCell>{getActionBadge(log.action || 'unknown')}</TableCell>
                          <TableCell className="text-[hsl(var(--super-admin-text))]">{target}</TableCell>
                          <TableCell>
                            <Badge className="bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]">
                              success
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
