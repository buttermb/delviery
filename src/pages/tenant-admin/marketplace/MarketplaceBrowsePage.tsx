import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertCircle,
    Search,
    Filter,
    ShoppingCart,
    Tag,
    Store,
    ArrowUpRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { PageHeader } from '@/components/shared/PageHeader';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';

interface MarketplaceListing {
    id: string;
    product_name: string;
    product_type: string;
    base_price: number;
    quantity_available: number;
    unit_of_measure: string;
    images: string[];
    seller_tenant_id: string;
    marketplace_profile_id: string;
    marketplace_profiles: {
        business_name: string;
    };
}

export default function MarketplaceBrowsePage() {
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const { data: listings, isLoading, error } = useQuery({
        queryKey: queryKeys.marketplaceBrowse.list(typeFilter),
        queryFn: async () => {
            let query = supabase
                .from('marketplace_listings')
                .select(`
          *,
          marketplace_profiles (
            business_name
          )
        `)
                .eq('status', 'active')
                .gt('quantity_available', 0); // Only show available items

            if (typeFilter !== 'all') {
                query = query.eq('product_type', typeFilter);
            }

            const { data, error } = await query.limit(100);

            if (error) throw error;
            return data as unknown as MarketplaceListing[];
        },
    });

    const filteredListings = listings?.filter(listing => {
        if (!searchQuery) return true;
        return (
            listing.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            listing.marketplace_profiles?.business_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Marketplace Sourcing"
                description="Discover and purchase wholesale cannabis products from verified vendors."
                actions={
                    <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/cart`)}>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        My Cart
                    </Button>
                }
            />

            {/* Search & Filter */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products or vendors..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[200px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Product Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="flower">Flower</SelectItem>
                                <SelectItem value="edible">Edibles</SelectItem>
                                <SelectItem value="concentrate">Concentrates</SelectItem>
                                <SelectItem value="pre-roll">Pre-Rolls</SelectItem>
                                <SelectItem value="vape">Vapes</SelectItem>
                                <SelectItem value="biomass">Biomass</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Error State */}
            {error ? (
                <div className="p-4">
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <p>Failed to load marketplace listings. Please try refreshing the page.</p>
                    </div>
                </div>
            ) : isLoading ? (
                <EnhancedLoadingState variant="card" message="Loading marketplace listings..." />
            ) : filteredListings && filteredListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredListings.map((listing) => (
                        <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer flex flex-col"
                            onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/product/${listing.id}`)}>
                            <div className="aspect-square bg-muted relative">
                                {listing.images && listing.images.length > 0 ? (
                                    <img src={listing.images[0]} alt={listing.product_name} className="object-cover w-full h-full" />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-muted-foreground bg-muted/50">
                                        <Tag className="h-12 w-12 opacity-20" />
                                    </div>
                                )}
                                <Badge className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm border-0">
                                    {listing.product_type}
                                </Badge>
                            </div>
                            <CardHeader className="p-4 pb-0">
                                <div className="flex justify-between items-start mb-1 h-14">
                                    <CardTitle className="text-lg line-clamp-2">{listing.product_name}</CardTitle>
                                </div>
                                <div className="flex items-center text-sm text-muted-foreground gap-1">
                                    <Store className="h-3 w-3" />
                                    {listing.marketplace_profiles?.business_name || 'Unknown Vendor'}
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-grow">
                                <div className="text-2xl font-bold text-primary">
                                    {formatCurrency(listing.base_price)}
                                    <span className="text-sm font-normal text-muted-foreground ml-1">/ {listing.unit_of_measure}</span>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    {listing.quantity_available} {listing.unit_of_measure}s available
                                </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                                <Button className="w-full" variant="outline">
                                    View Details
                                    <ArrowUpRight className="h-4 w-4 ml-2" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20">
                    <h3 className="text-lg font-medium text-muted-foreground">No products found</h3>
                    <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
                </div>
            )}
        </div>
    );
}
