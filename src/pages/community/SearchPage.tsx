/**
 * Search Page
 * Search results for forum posts
 */

import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as forumApi from '@/lib/api/forum';
import { PostCard } from '@/components/community/PostCard';
import { PostSkeleton } from '@/components/community/PostSkeleton';
import { EmptyState } from '@/components/community/EmptyState';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);

  const { data: posts, isLoading } = useQuery({
    queryKey: queryKeys.forum.search.posts(query),
    queryFn: () => forumApi.searchPosts(query),
    enabled: !!query,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() });
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

      <div>
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      {query && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Results for "{query}"
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
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
            <EmptyState 
              type="search" 
              message={`No posts found for "${query}". Try different keywords.`}
            />
          )}
        </div>
      )}

      {!query && (
        <div className="text-center py-12 text-muted-foreground">
          Enter a search query to find posts.
        </div>
      )}
    </div>
  );
}

