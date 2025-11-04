import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminNavigation } from "@/components/super-admin/SuperAdminNavigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Search, Download, Filter } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock audit log data
const mockAuditLogs = [
  { id: 1, timestamp: '2024-01-15 14:32:15', user: 'admin@platform.com', action: 'tenant_created', target: 'Acme Corp', status: 'success' },
  { id: 2, timestamp: '2024-01-15 14:25:42', user: 'admin@platform.com', action: 'tenant_suspended', target: 'Tech Startup', status: 'success' },
  { id: 3, timestamp: '2024-01-15 14:18:09', user: 'superadmin@platform.com', action: 'feature_flag_updated', target: 'new_checkout_flow', status: 'success' },
  { id: 4, timestamp: '2024-01-15 13:55:21', user: 'admin@platform.com', action: 'impersonation_started', target: 'Enterprise LLC', status: 'success' },
  { id: 5, timestamp: '2024-01-15 13:45:38', user: 'admin@platform.com', action: 'tenant_updated', target: 'Acme Corp', status: 'success' },
  { id: 6, timestamp: '2024-01-15 13:30:12', user: 'admin@platform.com', action: 'system_config_updated', target: 'rate_limits', status: 'success' },
];

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const filteredLogs = mockAuditLogs.filter(log => {
    const matchesSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.target.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesFilter;
  });

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
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">📋 Audit Logs</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Track all system activities</p>
          </div>
          <SuperAdminNavigation />
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Logs</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">3,482</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Today's Actions</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">127</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Admin actions</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Failed Actions</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">3</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Active Users</CardTitle>
              <Shield className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">8</div>
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
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70 font-mono text-xs">{log.timestamp}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{log.user}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{log.target}</TableCell>
                      <TableCell>
                        <Badge className="bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]">
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
