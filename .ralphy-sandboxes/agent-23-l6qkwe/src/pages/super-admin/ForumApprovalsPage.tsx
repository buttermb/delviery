import { logger } from '@/lib/logger';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
/**
 * Forum Approvals Management Page
 * Super admin page to manage forum user approval requests
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Search, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ForumApproval {
  id: string;
  customer_user_id: string;
  request_message: string;
  status: ApprovalStatus;
  requested_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
}

export default function ForumApprovalsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'all'>('pending');
  const queryClient = useQueryClient();

  // Fetch approvals with user emails from auth
  const { data: approvals, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.superAdminTools.forumApprovals(activeTab),
    queryFn: async () => {
      logger.debug('Fetching forum approvals', { activeTab, component: 'ForumApprovalsPage' });
      
      let query = supabase
        .from('forum_user_approvals')
        .select('id, customer_user_id, request_message, status, requested_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason')
        .order('requested_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data: approvalsData, error } = await query;
      
      if (error) {
        logger.error('Error fetching forum approvals', error instanceof Error ? error : new Error(String(error)), { activeTab, component: 'ForumApprovalsPage' });
        throw error;
      }

      logger.debug('Fetched forum approvals', { count: approvalsData?.length ?? 0, component: 'ForumApprovalsPage' });
      return (approvalsData ?? []) as ForumApproval[];
    },
  });

  // Log query error if present
  if (queryError) {
    logger.error('Forum approvals query error', queryError instanceof Error ? queryError : new Error(String(queryError)), { component: 'ForumApprovalsPage' });
  }

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      logger.debug('Approving forum user', { approvalId, component: 'ForumApprovalsPage' });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('forum-approvals', {
        body: {
          action: 'approve',
          approval_id: approvalId,
        },
      });

      if (error) {
        logger.error('Forum approval error', error instanceof Error ? error : new Error(String(error)), { approvalId, component: 'ForumApprovalsPage' });
        throw error;
      }
      
      logger.debug('Forum user approved', { approvalId, component: 'ForumApprovalsPage' });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.forumApprovals() });
      toast.success('User approved successfully');
    },
    onError: (error: unknown) => {
      logger.error('Failed to approve forum user', error instanceof Error ? error : new Error(String(error)), { component: 'ForumApprovalsPage' });
      toast.error('Failed to approve user', { description: humanizeError(error) });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, reason }: { approvalId: string; reason?: string }) => {
      logger.debug('Rejecting forum user', { approvalId, reason, component: 'ForumApprovalsPage' });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('forum-approvals', {
        body: {
          action: 'reject',
          approval_id: approvalId,
          rejection_reason: reason,
        },
      });

      if (error) {
        logger.error('Forum rejection error', error instanceof Error ? error : new Error(String(error)), { approvalId, reason, component: 'ForumApprovalsPage' });
        throw error;
      }
      
      logger.debug('Forum user rejected', { approvalId, component: 'ForumApprovalsPage' });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.forumApprovals() });
      toast.success('User rejected');
    },
    onError: (error: unknown) => {
      logger.error('Failed to reject forum user', error instanceof Error ? error : new Error(String(error)), { component: 'ForumApprovalsPage' });
      toast.error('Failed to reject user', { description: humanizeError(error) });
    },
  });

  const filteredApprovals = approvals?.filter((approval) => {
    const userId = approval.customer_user_id.toLowerCase();
    const message = approval.request_message?.toLowerCase() ?? '';
    const search = searchQuery.toLowerCase();
    return userId.includes(search) || message.includes(search);
  });

  // Calculate stats
  const stats = {
    total: approvals?.length ?? 0,
    pending: approvals?.filter((a) => a.status === 'pending').length ?? 0,
    approved: approvals?.filter((a) => a.status === 'approved').length ?? 0,
    rejected: approvals?.filter((a) => a.status === 'rejected').length ?? 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Forum Approvals</h1>
          <p className="text-muted-foreground">Manage forum user approval requests</p>
        </div>
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Requests</CardTitle>
          <CardDescription>Review and manage forum access requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user ID or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search forum approvals"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ApprovalStatus | 'all')}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Pending {stats.pending > 0 && <Badge className="ml-2">{stats.pending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {isLoading ? (
                <EnhancedLoadingState variant="table" count={3} message="Loading approvals..." />
              ) : filteredApprovals && filteredApprovals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Request Message</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApprovals.map((approval) => (
                      <TableRow key={approval.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">User</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {approval.customer_user_id.slice(0, 8)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm line-clamp-2">{approval.request_message || 'No message'}</p>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(approval.requested_at), 'MMM dd, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              approval.status === 'approved'
                                ? 'default'
                                : approval.status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {approval.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {approval.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => approveMutation.mutate(approval.id)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectMutation.mutate({ approvalId: approval.id })}
                                disabled={rejectMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                          {approval.status === 'approved' && approval.approved_at && (
                            <div className="text-sm text-muted-foreground">
                              Approved {format(new Date(approval.approved_at), 'MMM dd, yyyy')}
                            </div>
                          )}
                          {approval.status === 'rejected' && approval.rejected_at && (
                            <div className="text-sm text-muted-foreground">
                              Rejected {format(new Date(approval.rejected_at), 'MMM dd, yyyy')}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No {activeTab !== 'all' ? activeTab : ''} requests found
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
