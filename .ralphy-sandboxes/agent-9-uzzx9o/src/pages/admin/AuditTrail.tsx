import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { History, Search, User, Clock, Shield } from 'lucide-react';
import { handleError } from '@/utils/errorHandling/handlers';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

export default function AuditTrail() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredLogs = (auditLogs ?? []).filter((log) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(search) ||
      log.user_email?.toLowerCase().includes(search) ||
      log.description?.toLowerCase().includes(search) ||
      log.entity_type?.toLowerCase().includes(search)
    );
  });

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
          <CardTitle>Search Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search by action, user, or description"
              placeholder="Search by action, user, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Recent system and user activities</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
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
            </div>
          ) : searchTerm ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No audit logs matching &ldquo;{searchTerm}&rdquo;</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs available. Audit trail will appear here once the audit_trail table is created.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

