/**
 * Post Detail Page
 * Single post with comments
 */

import { useParams } from 'react-router-dom';
import { usePost, useDeletePost } from '@/hooks/usePosts';
import { useComments, useCreateComment, useDeleteComment } from '@/hooks/useComments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoteButtons } from '@/components/community/VoteButtons';
import { CommentThread } from '@/components/community/CommentThread';
import { Loader2, ArrowLeft, Trash2, Package, ExternalLink } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { Link, useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { useState } from 'react';
import { useForumProfile } from '@/hooks/useForumProfile';
import { ApprovalBanner } from '@/components/community/ApprovalBanner';
import { useForumRealtimeComments } from '@/hooks/useForumRealtime';
import { EmptyState } from '@/components/community/EmptyState';

export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { data: post, isLoading } = usePost(postId);
  const { data: comments, isLoading: commentsLoading } = useComments(postId);
  const { data: profile } = useForumProfile();
  const createCommentMutation = useCreateComment();
  const deletePostMutation = useDeletePost();
  const _deleteCommentMutation = useDeleteComment();
  const [commentContent, setCommentContent] = useState('');

  // Subscribe to real-time comment updates
  useForumRealtimeComments(postId);

  if (isLoading) {
    return <EnhancedLoadingState variant="card" message="Loading post..." />;
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Post not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/community">Back to Home</Link>
        </Button>
      </div>
    );
  }

  const authorName = post.author?.username ||
    post.author?.customer_user?.first_name ||
    post.author?.customer_user?.email ||
    'Anonymous';

  const isAuthor = profile?.id === post.author_id;

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || !postId) return;

    try {
      await createCommentMutation.mutateAsync({
        post_id: postId,
        content: commentContent,
        depth: 0,
      });
      setCommentContent('');
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeletePost = async () => {
    if (!postId || !confirm('Are you sure you want to delete this post?')) return;

    try {
      await deletePostMutation.mutateAsync(postId);
      navigate('/community');
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/community">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Post */}
      <Card>
        <CardContent className="p-0">
          <div className="flex">
            <div className="p-4">
              <VoteButtons
                votableType="post"
                votableId={post.id}
                upvoteCount={post.upvote_count}
                downvoteCount={post.downvote_count}
              />
            </div>

            <div className="flex-1 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {post.category && (
                      <>
                        <Link
                          to={`/community/c/${post.category.slug}`}
                          className="hover:text-primary"
                        >
                          {post.category.icon} {post.category.name}
                        </Link>
                        {' • '}
                      </>
                    )}
                    Posted by{' '}
                    <Link
                      to={`/community/u/${post.author?.username || 'anonymous'}`}
                      className="hover:text-primary font-medium"
                    >
                      {authorName}
                    </Link>
                    {' • '}
                    {formatRelativeTime(post.created_at)}
                  </div>
                  <h1 className="text-2xl font-bold">{post.title}</h1>
                </div>
                {isAuthor && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeletePost}
                    disabled={deletePostMutation.isPending}
                    aria-label="Delete post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {post.content && (
                <div className="prose max-w-none mb-6 whitespace-pre-wrap">
                  {post.content}
                </div>
              )}

              {/* Link Post */}
              {post.content_type === 'link' && post.link_url && (
                <div className="mb-6">
                  <a
                    href={post.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {post.link_url}
                  </a>
                </div>
              )}

              {/* Product Post */}
              {post.content_type === 'product' && post.linked_listing && (
                <Card className="mb-6 border-primary/20 hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 flex gap-4">
                    {post.linked_listing.images?.[0] && (
                      <img
                        src={post.linked_listing.images[0]}
                        alt={post.linked_listing.product_name}
                        className="h-32 w-32 rounded object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div className="text-xl font-bold">
                          {post.linked_listing.product_name}
                        </div>
                      </div>
                      {post.linked_listing.description && (
                        <div className="text-muted-foreground mb-3">
                          {post.linked_listing.description}
                        </div>
                      )}
                      <div className="text-2xl font-bold text-primary mb-2">
                        ${post.linked_listing.base_price}
                      </div>
                      {post.linked_listing.marketplace_profiles && (
                        <div className="text-sm text-muted-foreground">
                          by {post.linked_listing.marketplace_profiles.business_name}
                        </div>
                      )}
                    </div>
                    <Button asChild>
                      <a
                        href={`/marketplace/listings/${post.linked_listing.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Product
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comment Form */}
      {profile ? (
        <Card>
          <CardContent className="p-4">
            <Textarea
              placeholder="What are your thoughts?"
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              rows={4}
              className="mb-3 resize-none"
              aria-label="Write a comment"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!commentContent.trim() || createCommentMutation.isPending}
              >
                {createCommentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  'Comment'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ApprovalBanner />
      )}

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          {post.comment_count} {post.comment_count === 1 ? 'Comment' : 'Comments'}
        </h2>
        {commentsLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : comments && comments.length > 0 ? (
          comments
            .filter(c => !c.parent_comment_id)
            .map(comment => (
              <CommentThread
                key={comment.id}
                comment={comment}
                allComments={comments}
                postId={post.id}
              />
            ))
        ) : (
          <EmptyState type="comments" />
        )}
      </div>
    </div>
  );
}

