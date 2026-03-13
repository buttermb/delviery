import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, DollarSign, Calendar, MapPin, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Customer segmentation criteria
 */
interface SegmentCriteria {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tagColor: string;
  filter: (customer: CustomerData) => boolean;
}

interface CustomerData {
  id: string;
  full_name: string | null;
  email: string | null;
  total_spent: number;
  order_count: number;
  last_order_date: string | null;
  address: string | null;
}

interface SegmentResult {
  segmentId: string;
  customers: CustomerData[];
  count: number;
}

const SEGMENTS: SegmentCriteria[] = [
  {
    id: 'vip',
    name: 'VIP Customers',
    description: 'Total spend > $5000',
    icon: DollarSign,
    tagColor: 'bg-purple-500',
    filter: (c) => c.total_spent > 5000,
  },
  {
    id: 'frequent',
    name: 'Frequent Buyers',
    description: '10+ orders',
    icon: Users,
    tagColor: 'bg-blue-500',
    filter: (c) => c.order_count >= 10,
  },
  {
    id: 'recent',
    name: 'Recently Active',
    description: 'Ordered in last 30 days',
    icon: Calendar,
    tagColor: 'bg-green-500',
    filter: (c) => {
      if (!c.last_order_date) return false;
      const daysSince = Math.floor(
        (Date.now() - new Date(c.last_order_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince <= 30;
    },
  },
  {
    id: 'at_risk',
    name: 'At Risk',
    description: 'No order in 90+ days',
    icon: Calendar,
    tagColor: 'bg-orange-500',
    filter: (c) => {
      if (!c.last_order_date) return true;
      const daysSince = Math.floor(
        (Date.now() - new Date(c.last_order_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince > 90;
    },
  },
  {
    id: 'local',
    name: 'Local Customers',
    description: 'Has delivery address',
    icon: MapPin,
    tagColor: 'bg-emerald-500',
    filter: (c) => !!c.address,
  },
];

/**
 * CustomerSegmentation component
 *
 * Segments customers by total spend, order frequency, last order date, and location.
 * Auto-assigns tags based on segment criteria.
 */
export function CustomerSegmentation() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [autoTagging, setAutoTagging] = useState(false);

  // Fetch all customers with order stats
  const { data: customers = [], isLoading } = useQuery({
    queryKey: queryKeys.customers.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('customers')
        .select(`
          id,
          full_name,
          email,
          address,
          created_at
        `)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      // Fetch order stats for each customer
      const customersWithStats = await Promise.all(
        (data || []).map(async (customer) => {
          const { data: orders } = await supabase
            .from('unified_orders')
            .select('total_amount, created_at')
            .eq('tenant_id', tenant.id)
            .eq('customer_id', customer.id);

          const total_spent = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
          const order_count = orders?.length || 0;
          const last_order_date = orders?.[0]?.created_at || null;

          return {
            ...customer,
            total_spent,
            order_count,
            last_order_date,
          };
        })
      );

      return customersWithStats as CustomerData[];
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });

  // Calculate segment results
  const segmentResults: SegmentResult[] = SEGMENTS.map((segment) => ({
    segmentId: segment.id,
    customers: customers.filter(segment.filter),
    count: customers.filter(segment.filter).length,
  }));

  // Auto-tag mutation
  const autoTagMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const segment = SEGMENTS.find((s) => s.id === segmentId);
      if (!segment) throw new Error('Invalid segment');

      const customersToTag = customers.filter(segment.filter);

      // Ensure tag exists
      const { data: existingTag } = await (supabase as any)
        .from('customer_tags')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('name', segment.name)
        .maybeSingle();

      let tagId: string;

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag, error: tagError } = await (supabase as any)
          .from('customer_tags')
          .insert({
            tenant_id: tenant.id,
            name: segment.name,
            color: segment.tagColor,
            description: segment.description,
          })
          .select()
          .single();

        if (tagError) throw tagError;
        tagId = newTag.id;
      }

      // Assign tags to customers (upsert to avoid duplicates)
      const assignments = customersToTag.map((customer) => ({
        tenant_id: tenant.id,
        customer_id: customer.id,
        tag_id: tagId,
      }));

      if (assignments.length > 0) {
        const { error: assignError } = await (supabase as any)
          .from('customer_tag_assignments')
          .upsert(assignments, { onConflict: 'customer_id,tag_id' });

        if (assignError) throw assignError;
      }

      return { count: assignments.length, segmentName: segment.name };
    },
    onSuccess: (result) => {
      toast.success(`Auto-tagged ${result.count} customers as "${result.segmentName}"`);
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.list(tenant?.id) });
    },
    onError: (error: Error) => {
      toast.error(`Failed to auto-tag: ${error.message}`);
    },
  });

  const handleAutoTag = (segmentId: string) => {
    setAutoTagging(true);
    autoTagMutation.mutate(segmentId, {
      onSettled: () => setAutoTagging(false),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Segmentation</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Segmentation</CardTitle>
        <CardDescription>
          Segment customers by spend, frequency, recency, and location
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {SEGMENTS.map((segment) => {
            const result = segmentResults.find((r) => r.segmentId === segment.id);
            const Icon = segment.icon;

            return (
              <div
                key={segment.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${segment.tagColor} bg-opacity-10`}>
                    <Icon className={`h-5 w-5 ${segment.tagColor.replace('bg-', 'text-')}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{segment.name}</h4>
                      <Badge variant="secondary">{result?.count || 0}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{segment.description}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAutoTag(segment.id)}
                  disabled={autoTagging || (result?.count || 0) === 0}
                >
                  {autoTagMutation.isPending && autoTagMutation.variables === segment.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tagging...
                    </>
                  ) : (
                    <>
                      <Tag className="mr-2 h-4 w-4" />
                      Auto-Tag
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {customers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No customers found. Start adding customers to see segmentation insights.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
