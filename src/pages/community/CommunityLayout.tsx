/**
 * Community Layout
 * Main layout for the forum with navigation and sidebars
 */

import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as forumApi from '@/lib/api/forum';
import { NotificationDropdown } from '@/components/community/NotificationDropdown';
import { ApprovalBanner } from '@/components/community/ApprovalBanner';
import { useForumProfile } from '@/hooks/useForumProfile';
import { useState } from 'react';

export function CommunityLayout() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: profile } = useForumProfile();
  const { data: categories } = useQuery({
    queryKey: queryKeys.forum.categories.lists(),
    queryFn: () => forumApi.getCategories(),
  });

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/community/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/community" className="flex items-center gap-2">
              <span className="text-xl font-bold">FloraIQ Community</span>
            </Link>

            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {profile && (
                <Button onClick={() => navigate('/community/create')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
              )}
              <NotificationDropdown />
              {profile ? (
                <Button variant="ghost" size="icon" asChild>
                  <Link to={`/community/u/${profile.username}`}>
                    <User className="h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/community/auth?returnTo=/community/approval">
                    Sign In
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Banner */}
      {!profile && <ApprovalBanner />}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Categories */}
          <div className="hidden lg:block col-span-3">
            <div className="sticky top-24 space-y-4">
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-4">Categories</h3>
                <div className="space-y-2">
                  {categories?.map(category => (
                    <Link
                      key={category.id}
                      to={`/community/c/${category.slug}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <span className="text-2xl">{category.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{category.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {category.post_count} posts
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center Content */}
          <div className="col-span-12 lg:col-span-6">
            <Outlet />
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:block col-span-3">
            <div className="sticky top-24 space-y-4">
              {/* Placeholder for trending, etc. */}
              <div className="bg-card rounded-lg border p-4">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Welcome to the FloraIQ Community! Share your experiences, ask questions, and connect with other cannabis enthusiasts.
                </p>
                {!profile && (
                  <Button variant="default" size="sm" className="w-full" asChild>
                    <Link to="/community/auth?returnTo=/community/approval">
                      Sign In to Join
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

