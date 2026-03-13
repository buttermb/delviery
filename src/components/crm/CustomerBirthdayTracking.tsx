import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cake, Gift, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { format, isSameDay, addDays } from 'date-fns';

interface CustomerBirthdayTrackingProps {
  customerId?: string;
  showUpcoming?: boolean;
}

/**
 * CustomerBirthdayTracking component
 *
 * Track customer birthdays and anniversaries. Show upcoming events.
 */
export function CustomerBirthdayTracking({
  customerId,
  showUpcoming = false,
}: CustomerBirthdayTrackingProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [birthday, setBirthday] = useState('');
  const [anniversary, setAnniversary] = useState('');

  // For single customer
  const { data: customerData, isLoading: isLoadingCustomer } = useQuery({
    queryKey: queryKeys.customers.detail(customerId || '', 'dates'),
    queryFn: async () => {
      if (!tenant?.id || !customerId) return null;

      const { data, error } = await (supabase as any)
        .from('customer_metadata')
        .select('birthday, anniversary')
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!tenant?.id && !!customerId,
  });

  // For upcoming birthdays/anniversaries
  const { data: upcomingEvents = [], isLoading: isLoadingUpcoming } = useQuery({
    queryKey: queryKeys.customers.list(tenant?.id, { filter: 'upcoming-events' }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data: customers, error } = await supabase
        .from('customers')
        .select(`
          id,
          full_name,
          email,
          customer_metadata!inner (
            birthday,
            anniversary
          )
        `)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      const today = new Date();
      const next30Days = addDays(today, 30);

      const events = (customers || []).flatMap((customer: any) => {
        const results = [];
        const metadata = customer.customer_metadata;

        if (metadata?.birthday) {
          const birthdayDate = new Date(metadata.birthday);
          // Check if birthday is within next 30 days (ignoring year)
          const thisYearBirthday = new Date(
            today.getFullYear(),
            birthdayDate.getMonth(),
            birthdayDate.getDate()
          );
          if (thisYearBirthday >= today && thisYearBirthday <= next30Days) {
            results.push({
              customerId: customer.id,
              customerName: customer.full_name || customer.email || 'Unknown',
              type: 'birthday',
              date: thisYearBirthday,
            });
          }
        }

        if (metadata?.anniversary) {
          const anniversaryDate = new Date(metadata.anniversary);
          const thisYearAnniversary = new Date(
            today.getFullYear(),
            anniversaryDate.getMonth(),
            anniversaryDate.getDate()
          );
          if (thisYearAnniversary >= today && thisYearAnniversary <= next30Days) {
            results.push({
              customerId: customer.id,
              customerName: customer.full_name || customer.email || 'Unknown',
              type: 'anniversary',
              date: thisYearAnniversary,
            });
          }
        }

        return results;
      });

      return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
    enabled: !!tenant?.id && showUpcoming,
    staleTime: 60_000,
  });

  const updateDatesMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !customerId) throw new Error('Missing data');

      const { error } = await (supabase as any)
        .from('customer_metadata')
        .upsert({
          tenant_id: tenant.id,
          customer_id: customerId,
          birthday: birthday || null,
          anniversary: anniversary || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dates updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId || '', 'dates') });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleSave = () => {
    updateDatesMutation.mutate();
  };

  if (showUpcoming) {
    if (isLoadingUpcoming) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
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
          <CardTitle>Upcoming Birthdays & Anniversaries</CardTitle>
          <CardDescription>Next 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event: any, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {event.type === 'birthday' ? (
                      <Cake className="h-5 w-5 text-pink-500" />
                    ) : (
                      <Gift className="h-5 w-5 text-purple-500" />
                    )}
                    <div>
                      <p className="font-medium">{event.customerName}</p>
                      <p className="text-sm text-muted-foreground capitalize">{event.type}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{format(event.date, 'MMM d')}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Single customer view
  if (isLoadingCustomer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Important Dates</CardTitle>
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
        <CardTitle>Important Dates</CardTitle>
        <CardDescription>Track birthday and anniversary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="birthday">Birthday</Label>
          <Input
            id="birthday"
            type="date"
            value={birthday || customerData?.birthday || ''}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="anniversary">Anniversary</Label>
          <Input
            id="anniversary"
            type="date"
            value={anniversary || customerData?.anniversary || ''}
            onChange={(e) => setAnniversary(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} disabled={updateDatesMutation.isPending} className="w-full">
          {updateDatesMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Save Dates
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
