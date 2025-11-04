/**
 * Audit Log Viewer
 * View and search through all audit logs
 * Inspired by enterprise audit log systems
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { ScrollText, Search, Download, Filter } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditLog {
  id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  tenant_id: string | null;
  changes: any;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
  tenants?: {
    business_name: string | null;
  };
}

export function AuditLogViewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [limit, setLimit] = useState(100);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', searchTerm, actorTypeFilter, actionFilter, limit],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(full_name, email), tenants(business_name)')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (actorTypeFilter !== 'all') {
        query = query.eq('actor_type', actorTypeFilter);
      }

      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      if (searchTerm) {
        // Search in action, resource_type, or changes
        query = query.or(
          `action.ilike.%${searchTerm}%,resource_type.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AuditLog[];
    },
  });

  const getActorTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      tenant_admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      system: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      api: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  const getActionBadge = (action: string) => {
    if (action.includes('delete') || action.includes('suspend')) {
      return <Badge variant="destructive">{action}</Badge>;
    }
    if (action.includes('create') || action.includes('activate')) {
      return <Badge className="bg-green-500/10 text-green-500">{action}</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  const handleExport = () => {
    if (!logs) return;

    const csv = [
      ['Timestamp', 'Actor Type', 'Action', 'Resource Type', 'Resource ID', 'Tenant', 'IP Address'].join(','),
      ...logs.map((log) => [
        log.timestamp,
        log.actor_type,
        log.action,
        log.resource_type || '',
        log.resource_id || '',
        (log.tenants as any)?.business_name || '',
        log.ip_address || '',
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Audit Logs
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Actor Type</Label>
            <Select value={actorTypeFilter} onValueChange={setActorTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Input
              placeholder="Filter by action..."
              value={actionFilter === 'all' ? '' : actionFilter}
              onChange={(e) => setActionFilter(e.target.value || 'all')}
            />
          </div>
          <div className="space-y-2">
            <Label>Limit</Label>
            <Select
              value={limit.toString()}
              onValueChange={(val) => setLimit(parseInt(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs Table */}
        {isLoading ? (
          <div className="h-64 bg-muted animate-pulse rounded" />
        ) : logs && logs.length > 0 ? (
          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs">
                      {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getActorTypeBadge(log.actor_type)}
                        <p className="text-xs text-muted-foreground">
                          {(log.profiles as any)?.full_name || log.actor_id.slice(0, 8)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p className="font-medium">{log.resource_type || 'N/A'}</p>
                        {log.resource_id && (
                          <p className="text-muted-foreground font-mono">
                            {log.resource_id.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(log.tenants as any)?.business_name || (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {log.ip_address || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {log.changes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Show changes dialog - in production, use a proper dialog component
                            // For now, this is a placeholder for viewing changes
                            if (log.changes) {
                              alert(JSON.stringify(log.changes, null, 2));
                            }
                          }}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ScrollText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No audit logs found</p>
            <p className="text-xs mt-1">
              {searchTerm ? 'Try adjusting your filters' : 'Audit logs will appear here'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

