/**
 * Post Card Component
 * Displays a post in the feed
 */

import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VoteButtons } from './VoteButtons';
import { MessageCircle, Share2, ExternalLink, Package } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { truncateText } from '@/lib/utils/forumHelpers';
import type { ForumPost } from '@/types/forum';

interface PostCardProps {
  post: ForumPost;
}

export function PostCard({ post }: PostCardProps) {
  const authorName = post.author?.username || 
    post.author?.customer_user?.first_name || 
    post.author?.customer_user?.email || 
    'Anonymous';

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex">
          {/* Votes */}
          <div className="p-2">
            <VoteButtons
              votableType="post"
              votableId={post.id}
              upvoteCount={post.upvote_count}
              downvoteCount={post.downvote_count}
            />
          </div>

          {/* Content */}
          <div className="flex-1 p-4">
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

            <Link to={`/community/post/${post.id}`}>
              <h3 className="text-lg font-semibold hover:text-primary mb-2">
                {post.title}
              </h3>
            </Link>

            {post.content && (
              <p className="text-muted-foreground line-clamp-3 mb-3">
                {truncateText(post.content, 300)}
              </p>
            )}

            {/* Link Post */}
            {post.content_type === 'link' && post.link_url && (
              <div className="mb-3">
                <a
                  href={post.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {post.link_url}
                </a>
              </div>
            )}

            {/* Product Post */}
            {post.content_type === 'product' && post.linked_listing && (
              <Card className="mb-3 border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-3 flex gap-3">
                  {post.linked_listing.images?.[0] && (
                    <img
                      src={post.linked_listing.images[0]}
                      alt={post.linked_listing.product_name}
                      className="h-20 w-20 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div className="font-semibold">
                        {post.linked_listing.product_name}
                      </div>
                    </div>
                    {post.linked_listing.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {post.linked_listing.description}
                      </div>
                    )}
                    <div className="text-sm font-bold text-primary">
                      ${post.linked_listing.base_price}
                    </div>
                    {post.linked_listing.marketplace_profiles && (
                      <div className="text-xs text-muted-foreground mt-1">
                        by {post.linked_listing.marketplace_profiles.business_name}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={`/marketplace/listings/${post.linked_listing.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      View Product
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/community/post/${post.id}`}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {post.comment_count} Comments
                </Link>
              </Button>
              <Button variant="ghost" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

