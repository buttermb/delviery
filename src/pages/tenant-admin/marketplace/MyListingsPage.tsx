import { logger } from '@/lib/logger';
/**
 * Marketplace My Listings Page
 * View and manage all marketplace listings
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Pause,
  Play,
  Filter,
  MoreVertical,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { queryKeys } from '@/lib/queryKeys';

interface MarketplaceListing {
  id: string;
  product_name: string;
  description?: string;
  product_type?: string;
  base_price: number;
  quantity_available: number;
  status?: string;
  images?: string[];
  created_at: string;
  strain_type?: string;
  unit_type?: string;
  views?: number;
}

export default function MyListingsPage() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch marketplace profile first (required to have listings)
  const { data: profile } = useQuery({
    queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('marketplace_profiles')
        .select('id, marketplace_status, can_sell')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch marketplace profile', error, { component: 'MyListingsPage' });
        throw error;
      }

      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch listings
  const { data: listings = [], isLoading } = useQuery({
    queryKey: queryKeys.marketplaceListings.byTenant(tenantId, statusFilter),
    queryFn: async (): Promise<MarketplaceListing[]> => {
      if (!tenantId || !profile?.id) return [];

      const result = await supabase
        .from('marketplace_listings' as 'tenants')
        .select('id, product_name, description, product_type, base_price, quantity_available, status, images, created_at, strain_type, unit_type, views')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false});

      if (result.error) {
        logger.error('Failed to fetch listings', result.error, { component: 'MyListingsPage' });
        throw result.error;
      }

      const allListings = (result.data ?? []) as unknown as MarketplaceListing[];

      if (statusFilter === 'all' || !statusFilter) {
        return allListings;
      }
      
      return (allListings as unknown as MarketplaceListing[]).filter((item) => item.status === statusFilter);
    },
    enabled: !!tenantId && !!profile?.id,
  });

  // Filter listings by search query
  const filteredListings = listings.filter((listing) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      listing.product_name?.toLowerCase().includes(query) ||
      listing.description?.toLowerCase().includes(query) ||
      listing.product_type?.toLowerCase().includes(query)
    );
  });

  // Toggle listing status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ listingId, newStatus }: { listingId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('marketplace_listings')
        .update({ status: newStatus })
        .eq('id', listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceListings.byTenant(tenantId) });
      toast.success('Status Updated', { description: 'Listing status has been updated' });
    },
    onError: (error: unknown) => {
      logger.error('Failed to update listing status', error, { component: 'MyListingsPage' });
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to update listing' });
    },
  });

  // Delete listing
  const deleteMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from('marketplace_listings')
        .delete()
        .eq('id', listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceListings.byTenant(tenantId) });
      toast.success('Listing Deleted', { description: 'Listing has been removed' });
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete listing', error, { component: 'MyListingsPage' });
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to delete listing' });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Play className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline">
            Draft
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            Pending
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-muted/20 text-muted-foreground border-muted/30">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      case 'sold_out':
        return (
          <Badge variant="outline" className="border-destructive/30 text-destructive">
            Sold Out
          </Badge>
        );
      case 'removed':
        return (
          <Badge variant="outline" className="border-destructive/30 text-destructive">
            Removed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!profile) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Marketplace Profile</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You need to create a marketplace profile before you can list products.
              </p>
              <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/profile`)}>
                Create Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profile.marketplace_status !== 'active' || !profile.can_sell) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Marketplace Access Pending</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your marketplace profile is pending verification. You'll be able to create listings once approved.
              </p>
              <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/profile`)}>
                View Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            My Listings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your marketplace product listings
          </p>
        </div>
        <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Listing
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  aria-label="Search listings"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="sold_out">Sold Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Listings ({filteredListings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Listings Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Create your first listing to get started'}
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings/new`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Listing
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {listing.images && listing.images.length > 0 ? (
                            <img
                              src={listing.images[0]}
                              alt={listing.product_name}
                              className="h-10 w-10 object-cover rounded"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{listing.product_name}</div>
                            {listing.strain_type && (
                              <div className="text-xs text-muted-foreground">{listing.strain_type}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{listing.product_type || '—'}</TableCell>
                      <TableCell>{formatCurrency(listing.base_price as number ?? 0)}</TableCell>
                      <TableCell>
                        {listing.quantity_available} {listing.unit_type || 'lb'}
                      </TableCell>
                      <TableCell>{getStatusBadge(listing.status || 'draft')}</TableCell>
                      <TableCell>{listing.views ?? 0}</TableCell>
                      <TableCell>{formatSmartDate(listing.created_at as string)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Listing actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings/${listing.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings/${listing.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {listing.status === 'active' ? (
                              <DropdownMenuItem
                                onClick={() => toggleStatusMutation.mutate({ listingId: listing.id, newStatus: 'paused' })}
                                disabled={toggleStatusMutation.isPending || deleteMutation.isPending}
                              >
                                {toggleStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pause className="h-4 w-4 mr-2" />}
                                Pause
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => toggleStatusMutation.mutate({ listingId: listing.id, newStatus: 'active' })}
                                disabled={toggleStatusMutation.isPending || deleteMutation.isPending}
                              >
                                {toggleStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                Activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this listing?')) {
                                  deleteMutation.mutate(listing.id);
                                }
                              }}
                              className="text-destructive"
                              disabled={deleteMutation.isPending || toggleStatusMutation.isPending}
                            >
                              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

