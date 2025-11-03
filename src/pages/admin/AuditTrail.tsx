import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Download, Search, Filter, FileText } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export default function AuditTrail() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-trail', tenantId, searchTerm, filterAction, filterResource, dateFrom, dateTo],
    queryFn: async (): Promise<AuditLog[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from('audit_trail')
        .select('*')
        .eq('tenant_id', tenantId);

      if (filterAction) {
        query = query.eq('action', filterAction);
      }

      if (filterResource) {
        query = query.eq('resource_type', filterResource);
      }

      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        query = query.lte('created_at', new Date(dateTo).toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);

      if (error && error.code === '42P01') {
        // Fallback to activity_logs
        const { data: activityData } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (activityData) {
          return activityData.map((log: any) => ({
            id: log.id,
            user_id: log.user_id,
            action: log.action_type || log.action,
            resource_type: log.resource_type || log.entity_type,
            resource_id: log.resource_id || log.entity_id,
            changes: log.changes,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            created_at: log.created_at,
          }));
        }
        return [];
      }

      if (error) throw error;

      // Filter by search term
      let filtered = data || [];
      if (searchTerm) {
        filtered = filtered.filter(
          (log) =>
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return filtered;
    },
    enabled: !!tenantId,
  });

  const handleExport = () => {
    if (!auditLogs) return;

    const csv = [
      ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address'].join(','),
      ...auditLogs.map((log) =>
        [
          new Date(log.created_at).toISOString(),
          log.user_name || log.user_id,
          log.action,
          log.resource_type,
          log.resource_id || '',
          log.ip_address || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueActions = auditLogs ? [...new Set(auditLogs.map((log) => log.action))] : [];
  const uniqueResources = auditLogs ? [...new Set(auditLogs.map((log) => log.resource_type))] : [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading audit trail...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audit Trail</h1>
          <p className="text-muted-foreground">Complete system activity log and compliance tracking</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueActions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resource Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueResources.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last 24 Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {auditLogs?.filter((log) => {
                const logDate = new Date(log.created_at);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                return logDate >= yesterday;
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by action, resource, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="action">Action Type</Label>
              <select
                id="action"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full h-10 px-3 border rounded-md"
              >
                <option value="">All Actions</option>
                {uniqueActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="resource">Resource Type</Label>
              <select
                id="resource"
                value={filterResource}
                onChange={(e) => setFilterResource(e.target.value)}
                className="w-full h-10 px-3 border rounded-md"
              >
                <option value="">All Resources</option>
                {uniqueResources.map((resource) => (
                  <option key={resource} value={resource}>
                    {resource}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs ({auditLogs?.length || 0} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs && auditLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {log.user_name || log.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.resource_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.resource_id ? log.resource_id.slice(0, 8) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.ip_address || '—'}
                      </TableCell>
                      <TableCell>
                        {log.changes ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              toast({
                                title: 'Change Details',
                                description: JSON.stringify(log.changes, null, 2),
                              });
                            }}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {auditLogs !== undefined
                ? 'No audit logs found for the selected filters.'
                : 'Audit trail table not found. Please run database migrations.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Info */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              • Audit trail logs all system actions including create, update, and delete operations.
            </p>
            <p>
              • Logs are retained for compliance purposes and cannot be modified or deleted.
            </p>
            <p>
              • All logs include timestamp, user identification, action type, and IP address.
            </p>
            <p>
              • Change tracking captures before/after values for data modifications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

