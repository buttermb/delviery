// @ts-nocheck
/**
 * Business Finder Page
 * Customers can browse and find nearby dispensaries/businesses
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Store, 
  Search, 
  Filter,
  MapPin,
  Star,
  Truck,
  Clock,
  ArrowRight,
  ShoppingBag
} from 'lucide-react';
import { logger } from '@/lib/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModeBanner } from '@/components/customer/ModeSwitcher';
import { useState as useReactState, useEffect } from 'react';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { SEOHead } from '@/components/SEOHead';

type CustomerMode = 'retail' | 'wholesale';

export default function BusinessFinderPage() {
  const { slug } = useParams<{ slug: string }>();
  const { customer, tenant } = useCustomerAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all');
  const [mode, setMode] = useReactState<CustomerMode>('retail');

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE as any) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
      }
    } catch (error) {
      // Ignore storage errors
    }
  }, [setMode]);

  // Fetch active businesses/tenants
  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['retail-businesses', stateFilter, deliveryFilter],
    queryFn: async () => {
      let query = supabase
        .from('tenants')
        .select(`
          id,
          business_name,
          slug,
          state,
          city,
          subscription_status,
          white_label (
            logo,
            primary_color
          )
        `)
        .eq('subscription_status', 'active')
        .order('business_name');

      // Filter by state if selected
      if (stateFilter !== 'all') {
        query = query.eq('state', stateFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch businesses', error, { component: 'BusinessFinderPage' });
        throw error;
      }

      // Filter by delivery availability (if needed)
      // This would require checking delivery settings or orders table
      // For now, we'll show all active businesses

      return data || [];
    },
  });

  // Filter businesses by search query
  const filteredBusinesses = businesses.filter((business: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      business.business_name?.toLowerCase().includes(query) ||
      business.city?.toLowerCase().includes(query) ||
      business.state?.toLowerCase().includes(query)
    );
  });

  // Get US states for filter
  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  ];

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <SEOHead
        title="Find Cannabis Businesses - FloraIQ"
        description="Browse and discover local cannabis dispensaries and businesses. Find products, compare prices, and shop from verified retailers."
        type="website"
      />
      {/* Mode Banner */}
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <ModeBanner currentMode={mode} onModeChange={setMode} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" />
            Find Businesses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and shop from local dispensaries
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by business name, city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Delivery" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Options</SelectItem>
                  <SelectItem value="delivery">Delivery Available</SelectItem>
                  <SelectItem value="pickup">Pickup Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Businesses Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Businesses Found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search' : 'No businesses available in this area'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBusinesses.map((business: any) => (
              <Card key={business.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{business.business_name}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {business.city && business.state ? (
                          <span>{business.city}, {business.state}</span>
                        ) : business.state ? (
                          <span>{business.state}</span>
                        ) : (
                          <span>Location not specified</span>
                        )}
                      </div>
                    </div>
                    {business.white_label?.logo && (
                      <img
                        src={business.white_label.logo}
                        alt={business.business_name}
                        className="h-12 w-12 object-contain rounded"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Features */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Truck className="h-3 w-3 mr-1" />
                      Delivery
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Open Now
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        // Navigate to business menu page
                        // If customer is logged in, use their tenant slug, otherwise use business slug
                        const customerSlug = tenant?.slug || slug;
                        navigate(`/${customerSlug}/shop/retail/businesses/${business.slug}/menu`);
                      }}
                    >
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      View Menu
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        const customerSlug = tenant?.slug || slug;
                        navigate(`/${customerSlug}/shop/retail/businesses/${business.slug}/menu`);
                      }}
                    >
                      Shop Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

