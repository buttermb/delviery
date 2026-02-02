/**
 * Community Home Page
 * Main feed with all posts, sorted by hot/new/top
 */

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePosts } from '@/hooks/usePosts';
import { PostCard } from '@/components/community/PostCard';
import { PostSkeleton } from '@/components/community/PostSkeleton';
import { EmptyState } from '@/components/community/EmptyState';
import { useForumRealtimePosts } from '@/hooks/useForumRealtime';
import Flame from "lucide-react/dist/esm/icons/flame";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";

export function HomePage() {
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top'>('hot');
  const { data: posts, isLoading } = usePosts({ sortBy });
  
  // Subscribe to real-time updates
  useForumRealtimePosts();

  return (
    <div className="space-y-4">
      <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as 'hot' | 'new' | 'top')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hot">
            <Flame className="h-4 w-4 mr-2" />
            Hot
          </TabsTrigger>
          <TabsTrigger value="new">
            <Sparkles className="h-4 w-4 mr-2" />
            New
          </TabsTrigger>
          <TabsTrigger value="top">
            <TrendingUp className="h-4 w-4 mr-2" />
            Top
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <PostSkeleton key={i} />
          ))}
        </div>
      ) : posts && posts.length > 0 ? (
        posts.map(post => <PostCard key={post.id} post={post} />)
      ) : (
        <EmptyState type="posts" />
      )}
    </div>
  );
}

