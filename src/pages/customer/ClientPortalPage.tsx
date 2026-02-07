import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type { PortalData } from '@/types/portal';
import { PortalHeader } from '@/components/customer/portal/PortalHeader';
import { InvoiceTable } from '@/components/customer/portal/InvoiceTable';
import { OrderHistory } from '@/components/customer/portal/OrderHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ClientPortalPage() {
  const { portalToken } = useParams<{ portalToken: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portal.history(portalToken || ''),
    queryFn: async () => {
      if (!portalToken) {
        throw new Error('Portal token is required');
      }

      // ALWAYS use edge function, NEVER direct supabase query
      const { data, error: invokeError } = await supabase.functions.invoke<PortalData>('portal-data', {
        body: { portal_token: portalToken },
      });

      if (invokeError) {
        logger.error('Failed to fetch portal data', invokeError, {
          component: 'ClientPortalPage',
          portalToken,
        });
        throw invokeError;
      }

      if (!data) {
        throw new Error('No data returned from portal');
      }

      return data;
    },
    enabled: !!portalToken,
    retry: false, // Don't retry on 404
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Error state (404 for invalid token)
  if (error || !data) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <Alert className="max-w-md" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Portal Access Denied</AlertTitle>
          <AlertDescription>
            The portal link you're trying to access is invalid or has expired.
            Please contact your account representative for a new link.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <PortalHeader client={data.client} />

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.statistics.total_invoices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${data.statistics.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.statistics.pending_invoices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.statistics.total_orders}</div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceTable 
              invoices={data.invoices}
              clientName={data.client.business_name}
              clientAddress={data.client.contact_name}
            />
          </CardContent>
        </Card>

        {/* Order History */}
        <Card>
          <CardHeader>
            <CardTitle>Order History</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderHistory orders={data.orders} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

