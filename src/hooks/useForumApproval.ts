import { logger } from '@/lib/logger';
/**
 * Forum Approval Hooks
 * TanStack Query hooks for forum user approval workflow
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as forumApi from '@/lib/api/forum';
import { queryKeys } from '@/lib/queryKeys';
import type { RequestForumApprovalRequest } from '@/types/forum';

export function useForumApproval() {
  return useQuery({
    queryKey: queryKeys.forum.approval.current(),
    queryFn: () => forumApi.getForumApproval(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRequestForumApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: RequestForumApprovalRequest) => forumApi.requestForumApproval(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.approval.current() });
      toast.success('Approval request submitted. You will be notified when approved.');
    },
    onError: (error: unknown) => {
      logger.error('Failed to request approval', error, { component: 'useRequestForumApproval' });
      toast.error(error instanceof Error ? error.message : 'Failed to submit approval request');
    },
  });
}

