/**
 * Create Post Page
 * Form to create a new forum post
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCreatePost } from '@/hooks/usePosts';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as forumApi from '@/lib/api/forum';
import * as marketplaceApi from '@/lib/api/marketplace';
import { ArrowLeft, Loader2, Package, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useForumProfile } from '@/hooks/useForumProfile';
import { ApprovalBanner } from '@/components/community/ApprovalBanner';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function CreatePostPage() {
  const navigate = useNavigate();
  const { data: categories } = useQuery({
    queryKey: queryKeys.forum.categories.lists(),
    queryFn: () => forumApi.getCategories(),
  });
  const { data: profile } = useForumProfile();
  const createPostMutation = useCreatePost();

  const [postType, setPostType] = useState<'text' | 'link' | 'product'>('text');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedListingId, setSelectedListingId] = useState('');
  const [listingSearchQuery, setListingSearchQuery] = useState('');

  const { data: listings = [] } = useQuery({
    queryKey: ['marketplace-listings-for-forum'],
    queryFn: () => marketplaceApi.getActiveMarketplaceListings(100),
  });

  const filteredListings = listings.filter(listing =>
    listingSearchQuery === '' ||
    listing.product_name.toLowerCase().includes(listingSearchQuery.toLowerCase()) ||
    listing.description?.toLowerCase().includes(listingSearchQuery.toLowerCase())
  );

  if (!profile) {
    return (
      <div className="space-y-4">
        <ApprovalBanner />
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              You need to create a forum profile before posting.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!categoryId || !title) return;
    if (postType === 'product' && !selectedListingId) {
      toast.error('Please select a product to link to your post');
      return;
    }

    try {
      const post = await createPostMutation.mutateAsync({
        category_id: categoryId,
        title,
        content: postType === 'text' ? content : undefined,
        content_type: postType,
        link_url: postType === 'link' ? linkUrl : undefined,
        linked_listing_id: postType === 'product' ? selectedListingId : undefined,
      });

      navigate(`/community/post/${post.id}`);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/community">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a Post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={postType} onValueChange={(v) => setPostType(v as 'text' | 'link' | 'product')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="link">Link</TabsTrigger>
              <TabsTrigger value="product">Product</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Text (optional)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Input
                placeholder="URL"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                type="url"
              />
            </TabsContent>

            <TabsContent value="product" className="space-y-4">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Products</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search marketplace products..."
                    value={listingSearchQuery}
                    onChange={(e) => setListingSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg p-2 space-y-2">
                {filteredListings.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {listingSearchQuery ? 'No products found' : 'Loading products...'}
                  </div>
                ) : (
                  filteredListings.map(listing => (
                    <div
                      key={listing.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedListingId === listing.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => setSelectedListingId(listing.id)}
                    >
                      <div className="flex items-start gap-3">
                        {listing.images?.[0] && (
                          <img
                            src={listing.images[0]}
                            alt={listing.product_name}
                            className="h-16 w-16 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate">{listing.product_name}</span>
                            {listing.marketplace_profiles?.verified_badge && (
                              <Badge variant="secondary" className="text-xs">Verified</Badge>
                            )}
                          </div>
                          {listing.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {listing.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-primary">
                              ${listing.base_price}
                            </span>
                            {listing.marketplace_profiles && (
                              <span className="text-xs text-muted-foreground">
                                by {listing.marketplace_profiles.business_name}
                              </span>
                            )}
                          </div>
                        </div>
                        {selectedListingId === listing.id && (
                          <div className="text-primary">✓</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedListingId && (
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  Selected product will be linked to your post. You can add additional context in a text post.
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!categoryId || !title || (postType === 'product' && !selectedListingId) || createPostMutation.isPending}
            >
              {createPostMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

