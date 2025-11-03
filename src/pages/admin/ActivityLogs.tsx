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
import { Download, Search, Filter } from 'lucide-react';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name?: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  description: string;
  metadata?: any;
  created_at: string;
}

export default function ActivityLogs() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', tenantId, searchTerm, filterUser, filterAction, filterResource, dateFrom, dateTo],
    queryFn: async (): Promise<ActivityLog[]> => {
      if (!tenantId) return [];

      let query = supabase.from('activity_logs').select('*').eq('tenant_id', tenantId);

      // Apply filters
      if (filterUser) {
        query = query.eq('user_id', filterUser);
      }
      if (filterAction) {
        query = query.eq('action_type', filterAction);
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
        // Table doesn't exist - return empty array
        return [];
      }
      if (error) throw error;

      // Filter by search term (client-side for description)
      let filtered = data || [];
      if (searchTerm) {
        filtered = filtered.filter(
          (log) =>
            log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.resource_type.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return filtered;
    },
    enabled: !!tenantId,
  });

  const handleExport = () => {
    if (!logs) return;

    const csv = [
      ['Date', 'User', 'Action', 'Resource Type', 'Description'].join(','),
      ...logs.map((log) =>
        [
          new Date(log.created_at).toLocaleString(),
          log.user_name || log.user_id,
          log.action_type,
          log.resource_type,
          log.description.replace(/,/g, ';'), // Replace commas in description
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique values for filters
  const uniqueActions = logs ? [...new Set(logs.map((log) => log.action_type))] : [];
  const uniqueResources = logs ? [...new Set(logs.map((log) => log.resource_type))] : [];
  const uniqueUsers = logs ? [...new Set(logs.map((log) => log.user_name || log.user_id))] : [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading activity logs...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">Track user actions and system events</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
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
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by action, resource, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="user">User</Label>
              <select
                id="user"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full h-10 px-3 border rounded-md"
              >
                <option value="">All Users</option>
                {uniqueUsers.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity History ({logs?.length || 0} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs && logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.user_name || log.user_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.resource_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{log.description}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {logs ? 'No activity logs found' : 'Activity logs table not found. Please run database migrations.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

