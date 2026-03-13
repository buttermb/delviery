/**
 * MenuClientTargeting Component
 * Task 295: Wire menu client targeting
 *
 * Allows targeting specific clients/customer segments for menu distribution
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Users from 'lucide-react/dist/esm/icons/users';
import Search from 'lucide-react/dist/esm/icons/search';
import Target from 'lucide-react/dist/esm/icons/target';
import Filter from 'lucide-react/dist/esm/icons/filter';
import Tag from 'lucide-react/dist/esm/icons/tag';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Calendar from 'lucide-react/dist/esm/icons/calendar';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  tags?: string[];
  total_orders?: number;
  total_spent?: number;
  last_order_date?: string;
  city?: string;
  state?: string;
}

interface MenuClientTargetingProps {
  customers: Customer[];
  selectedCustomerIds: string[];
  onSelectionChange: (customerIds: string[]) => void;
  className?: string;
}

type SegmentFilter =
  | 'all'
  | 'high_value'
  | 'frequent'
  | 'inactive'
  | 'new'
  | 'vip'
  | 'wholesale';

const SEGMENT_FILTERS: Array<{
  id: SegmentFilter;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  { id: 'all', label: 'All Customers', description: 'Everyone', icon: Users },
  {
    id: 'high_value',
    label: 'High Value',
    description: '>$1000 spent',
    icon: TrendingUp,
  },
  {
    id: 'frequent',
    label: 'Frequent Buyers',
    description: '10+ orders',
    icon: TrendingUp,
  },
  { id: 'inactive', label: 'Inactive', description: '90+ days', icon: Calendar },
  { id: 'new', label: 'New Customers', description: '<30 days', icon: Users },
  { id: 'vip', label: 'VIP', description: 'VIP tag', icon: Tag },
  { id: 'wholesale', label: 'Wholesale', description: 'B2B clients', icon: Tag },
];

export function MenuClientTargeting({
  customers,
  selectedCustomerIds,
  onSelectionChange,
  className,
}: MenuClientTargetingProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSegment, setActiveSegment] = useState<SegmentFilter>('all');

  // Apply segment filters
  const filteredBySegment = useMemo(() => {
    return customers.filter((customer) => {
      const daysSinceLastOrder = customer.last_order_date
        ? Math.floor(
            (Date.now() - new Date(customer.last_order_date).getTime()) / (1000 * 60 * 60 * 24)
          )
        : Infinity;

      switch (activeSegment) {
        case 'high_value':
          return (customer.total_spent ?? 0) > 1000;
        case 'frequent':
          return (customer.total_orders ?? 0) >= 10;
        case 'inactive':
          return daysSinceLastOrder > 90;
        case 'new':
          return daysSinceLastOrder <= 30;
        case 'vip':
          return customer.tags?.includes('vip');
        case 'wholesale':
          return customer.tags?.includes('wholesale');
        default:
          return true;
      }
    });
  }, [customers, activeSegment]);

  // Apply search filter
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return filteredBySegment;

    const query = searchQuery.toLowerCase();
    return filteredBySegment.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.city?.toLowerCase().includes(query)
    );
  }, [filteredBySegment, searchQuery]);

  const toggleCustomer = (customerId: string) => {
    if (selectedCustomerIds.includes(customerId)) {
      onSelectionChange(selectedCustomerIds.filter((id) => id !== customerId));
    } else {
      onSelectionChange([...selectedCustomerIds, customerId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredCustomers.map((c) => c.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const selectSegment = (segment: SegmentFilter) => {
    setActiveSegment(segment);
    // Auto-select all in new segment
    const segmentCustomers = customers.filter((customer) => {
      const daysSinceLastOrder = customer.last_order_date
        ? Math.floor(
            (Date.now() - new Date(customer.last_order_date).getTime()) / (1000 * 60 * 60 * 24)
          )
        : Infinity;

      switch (segment) {
        case 'high_value':
          return (customer.total_spent ?? 0) > 1000;
        case 'frequent':
          return (customer.total_orders ?? 0) >= 10;
        case 'inactive':
          return daysSinceLastOrder > 90;
        case 'new':
          return daysSinceLastOrder <= 30;
        case 'vip':
          return customer.tags?.includes('vip');
        case 'wholesale':
          return customer.tags?.includes('wholesale');
        default:
          return true;
      }
    });

    onSelectionChange(segmentCustomers.map((c) => c.id));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle>Customer Targeting</CardTitle>
        </div>
        <CardDescription>
          Select specific customers or segments to share this menu with
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeSegment} onValueChange={(v) => selectSegment(v as SegmentFilter)}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
            {SEGMENT_FILTERS.map((filter) => {
              const Icon = filter.icon;
              return (
                <TabsTrigger
                  key={filter.id}
                  value={filter.id}
                  className="flex flex-col items-center gap-1 py-2 h-auto"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{filter.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeSegment} className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedCustomerIds.length} of {filteredCustomers.length} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Clear
                </Button>
              </div>
            </div>

            {/* Customer List */}
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4 space-y-2">
                {filteredCustomers.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No customers found in this segment</p>
                  </div>
                ) : (
                  filteredCustomers.map((customer) => {
                    const isSelected = selectedCustomerIds.includes(customer.id);
                    return (
                      <div
                        key={customer.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50',
                          isSelected && 'border-primary bg-primary/5'
                        )}
                        onClick={() => toggleCustomer(customer.id)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{customer.name}</p>
                            {customer.tags?.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs capitalize">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {customer.email && <span>{customer.email}</span>}
                            {customer.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {customer.city}, {customer.state}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-emerald-600">
                            ${(customer.total_spent ?? 0).toFixed(0)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {customer.total_orders ?? 0} orders
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Summary */}
        {selectedCustomerIds.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Target Summary</span>
              </div>
              <Badge variant="default" className="font-mono">
                {selectedCustomerIds.length} recipient{selectedCustomerIds.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
