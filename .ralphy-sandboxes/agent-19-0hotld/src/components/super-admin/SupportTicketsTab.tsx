import { logger } from '@/lib/logger';
/**
 * Support Tickets Tab Component
 * Displays and manages support tickets for a tenant
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

interface SupportTicketsTabProps {
  tenantId: string;
}

export function SupportTicketsTab({ tenantId }: SupportTicketsTabProps) {
  // Fetch support tickets for this tenant
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.supportTickets(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, description, status, priority, category, created_at, updated_at, resolved_at, assigned_to')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch support tickets', error, { component: 'SupportTicketsTab', tenantId });
        throw error;
      }
      return data ?? [];
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'high':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'medium':
        return 'bg-info/20 text-info border-info/30';
      case 'low':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'open':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-info" />;
      default:
        return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed':
        return 'bg-success/10 text-success border-success/20';
      case 'in_progress':
        return 'bg-info/10 text-info border-info/20';
      case 'open':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Calculate stats
  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    urgent: tickets.filter((t) => t.priority === 'urgent').length,
  };

  if (isLoading) {
    return (
      <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading support tickets...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.open}</div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.resolved}</div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Urgent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.urgent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Table */}
      <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="text-[hsl(var(--super-admin-text))] flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Support Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No support tickets found for this tenant.
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Status</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Subject</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Priority</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Category</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Created</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id} className="border-white/10">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(ticket.status || 'open')}
                          <Badge className={cn('text-xs', getStatusColor(ticket.status || 'open'))}>
                            {ticket.status || 'open'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">
                        <div className="max-w-md truncate" title={ticket.subject || 'No subject'}>
                          {ticket.subject || 'No subject'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', getPriorityColor(ticket.priority || 'medium'))}>
                          {ticket.priority || 'medium'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70">
                        {ticket.category || 'general'}
                      </TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70">
                        {ticket.created_at ? formatSmartDate(ticket.created_at) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70">
                        {ticket.updated_at ? formatSmartDate(ticket.updated_at) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

