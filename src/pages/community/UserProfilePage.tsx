/**
 * User Profile Page
 * Display user profile with karma and posts
 */

import { useParams, Link } from 'react-router-dom';
import { useForumProfileByUsername } from '@/hooks/useForumProfile';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as forumApi from '@/lib/api/forum';
import { UserProfileCard } from '@/components/community/UserProfileCard';
import { PostCard } from '@/components/community/PostCard';
import { PostSkeleton } from '@/components/community/PostSkeleton';
import { EmptyState } from '@/components/community/EmptyState';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading: profileLoading } = useForumProfileByUsername(username);
  const { data: reputation } = useQuery({
    queryKey: queryKeys.forum.reputation.user(profile?.id || ''),
    queryFn: () => {
      if (!profile?.id) return null;
      return forumApi.getUserReputation(profile.id);
    },
    enabled: !!profile?.id,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['forum-posts-by-author', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const allPosts = await forumApi.getPosts({});
      return allPosts.filter(p => p.author_id === profile.id);
    },
    enabled: !!profile?.id,
  });

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/community">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/community">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>

      <UserProfileCard profile={profile} reputation={reputation || undefined} />

      <div>
        <h2 className="text-xl font-semibold mb-4">Posts</h2>
        {postsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <PostSkeleton key={i} />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState type="profile" />
        )}
      </div>
    </div>
  );
}

