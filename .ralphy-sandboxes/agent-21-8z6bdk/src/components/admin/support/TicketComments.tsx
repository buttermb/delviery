import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface TicketCommentsProps {
  ticketId: string;
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const { admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  // Fetch comments
  const { data: comments, isLoading } = useQuery({
    queryKey: queryKeys.supportTicketComments.byTicket(ticketId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_comments')
        .select('id, created_by_name, created_at, comment')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      const { error } = await supabase
        .from('support_ticket_comments')
        .insert({
          ticket_id: ticketId,
          comment: commentText,
          created_by: admin?.id,
          created_by_name: admin?.name || admin?.email,
          is_internal: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supportTicketComments.byTicket(ticketId) });
      setComment("");
      toast.success("Comment added");
    },
    onError: (error) => {
      logger.error('Failed to add comment', error, { component: 'TicketComments' });
      toast.error("Failed to add comment", { description: humanizeError(error) });
    },
  });

  const handleSubmit = () => {
    if (!comment.trim()) return;
    addCommentMutation.mutate(comment);
  };

  return (
    <div className="pt-4 border-t space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comments ({comments?.length ?? 0})
      </h3>

      {/* Comments List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Loading comments...
          </div>
        ) : comments && comments.length > 0 ? (
          comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {comment.created_by_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">
                        {comment.created_by_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {comment.comment}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
          </div>
        )}
      </div>

      {/* Add Comment Form */}
      <div className="space-y-2">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          aria-label="Add a comment"
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!comment.trim() || addCommentMutation.isPending}
            className="min-h-[44px]"
          >
            {addCommentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Send Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
