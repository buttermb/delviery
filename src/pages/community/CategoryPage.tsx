/**
 * Category Page
 * Shows posts filtered by category
 */

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as forumApi from '@/lib/api/forum';
import { usePosts } from '@/hooks/usePosts';
import { PostCard } from '@/components/community/PostCard';
import { PostSkeleton } from '@/components/community/PostSkeleton';
import { EmptyState } from '@/components/community/EmptyState';
import { useForumRealtimePosts } from '@/hooks/useForumRealtime';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function CategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  
  // Subscribe to real-time updates
  useForumRealtimePosts();
  
  const { data: category } = useQuery({
    queryKey: ['category', categorySlug],
    queryFn: async () => {
      const categories = await forumApi.getCategories();
      return categories.find(c => c.slug === categorySlug);
    },
    enabled: !!categorySlug,
  });

  const { data: posts, isLoading } = usePosts({
    categoryId: category?.id,
    sortBy: 'hot',
  });

  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Category not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/community">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/community">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>{category.icon}</span>
            {category.name}
          </h1>
          {category.description && (
            <p className="text-muted-foreground mt-1">{category.description}</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <PostSkeleton key={i} />
          ))}
        </div>
      ) : posts && posts.length > 0 ? (
        posts.map(post => <PostCard key={post.id} post={post} />)
      ) : (
        <EmptyState 
          type="posts" 
          message={`No posts in ${category.name} yet. Be the first to post!`}
        />
      )}
    </div>
  );
}

