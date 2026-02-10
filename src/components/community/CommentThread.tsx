/**
 * Comment Thread Component
 * Nested comment threads with replies
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoteButtons } from './VoteButtons';
import { useCreateComment } from '@/hooks/useComments';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { Link } from 'react-router-dom';
import type { ForumComment } from '@/types/forum';

interface CommentThreadProps {
  comment: ForumComment;
  allComments: ForumComment[];
  depth?: number;
  postId: string;
}

export function CommentThread({
  comment,
  allComments,
  depth = 0,
  postId,
}: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const createCommentMutation = useCreateComment();

  const replies = allComments.filter(c => c.parent_comment_id === comment.id);

  const handleReply = async () => {
    if (!replyContent.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        post_id: postId,
        parent_comment_id: comment.id,
        content: replyContent,
        depth: depth + 1,
      });

      setReplyContent('');
      setShowReply(false);
    } catch {
      // Error handled by mutation
    }
  };

  const authorName = comment.author?.username || 
    comment.author?.customer_user?.first_name || 
    comment.author?.customer_user?.email || 
    'Anonymous';

  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}>
      <Card>
        <CardContent className="p-0">
          <div className="flex">
            <div className="p-2">
              <VoteButtons
                votableType="comment"
                votableId={comment.id}
                upvoteCount={comment.upvote_count}
                downvoteCount={comment.downvote_count}
              />
            </div>

            <div className="flex-1 p-4">
              <div className="text-sm text-muted-foreground mb-2">
                <Link
                  to={`/community/u/${comment.author?.username || 'anonymous'}`}
                  className="hover:text-primary font-medium"
                >
                  {authorName}
                </Link>
                {' • '}
                {formatRelativeTime(comment.created_at)}
              </div>

              <div className="mb-3 whitespace-pre-wrap">{comment.content}</div>

              {depth < 3 && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReply(!showReply)}
                  >
                    Reply
                  </Button>
                </div>
              )}

              {showReply && (
                <div className="mt-4 space-y-2">
                  <Textarea
                    placeholder="Write a reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowReply(false);
                        setReplyContent('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleReply}
                      disabled={!replyContent.trim() || createCommentMutation.isPending}
                    >
                      {createCommentMutation.isPending ? 'Posting...' : 'Reply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {replies.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              allComments={allComments}
              depth={depth + 1}
              postId={postId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

