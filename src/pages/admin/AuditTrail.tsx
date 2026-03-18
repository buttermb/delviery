import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, User, Clock, Shield, Filter } from 'lucide-react';
import { handleError } from '@/utils/errorHandling/handlers';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import { usePagination } from '@/hooks/usePagination';
import { StandardPagination } from '@/components/shared/StandardPagination';

export default function AuditTrail() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: queryKeys.auditTrail.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('audit_trail')
          .select('id, action, user_email, description, entity_type, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(500);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        handleError(error, { component: 'AuditTrail', toastTitle: 'Failed to load audit trail' });
        throw error;
      }
    },
    enabled: !!tenantId,
    retry: 2,
    staleTime: 60_000,
  });

  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    for (const log of auditLogs ?? []) {
      if (log.action) actions.add(log.action);
    }
    return [...actions].sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return (auditLogs ?? []).filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        log.action?.toLowerCase().includes(search) ||
        log.user_email?.toLowerCase().includes(search) ||
        log.description?.toLowerCase().includes(search) ||
        log.entity_type?.toLowerCase().includes(search)
      );
    });
  }, [auditLogs, searchTerm, actionFilter]);

  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(filteredLogs, {
    defaultPageSize: 25,
    persistInUrl: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Audit Trail</h1>
          <p className="text-muted-foreground">Complete history of system changes and user actions</p>
        </div>
        <EnhancedLoadingState variant="table" count={8} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Audit Trail</h1>
          <p className="text-muted-foreground">Complete history of system changes and user actions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search by action, user, or description"
                placeholder="Search by action, user, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]" aria-label="Filter by action type">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/[._]/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            {totalItems} {totalItems === 1 ? 'event' : 'events'}
            {searchTerm || actionFilter !== 'all' ? ' (filtered)' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paginatedItems.length > 0 ? (
            <div className="space-y-4">
              {paginatedItems.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.action || 'Unknown action'}</span>
                      <Badge variant="outline">{log.entity_type || 'system'}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {log.description || 'No description'}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{log.user_email || 'System'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatSmartDate(log.created_at, { includeTime: true })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <StandardPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                pageSizeOptions={pageSizeOptions}
                onPageChange={goToPage}
                onPageSizeChange={changePageSize}
              />
            </div>
          ) : searchTerm || actionFilter !== 'all' ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No audit logs matching your filters</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs recorded yet. Activity will appear here as actions are performed.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
