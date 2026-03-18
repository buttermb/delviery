import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import type { Database } from '@/integrations/supabase/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Edit,
  FileText,
  DollarSign,
  Users,
  Shield,
  TrendingUp,
  MessageSquare,
  FolderOpen,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { DetailPageSkeleton } from '@/components/admin/shared/LoadingSkeletons';
import { logger } from '@/lib/logger';
import { VendorProductCatalog } from '@/components/admin/vendors/VendorProductCatalog';
import { VendorOrderHistory } from '@/components/admin/vendors/VendorOrderHistory';
import { VendorPaymentTracking } from '@/components/admin/vendors/VendorPaymentTracking';
import { VendorContactsManager } from '@/components/admin/vendors/VendorContactsManager';
import { VendorComplianceTracking } from '@/components/admin/vendors/VendorComplianceTracking';
import { VendorPriceHistory } from '@/components/admin/vendors/VendorPriceHistory';
import { VendorCommunicationLog } from '@/components/admin/vendors/VendorCommunicationLog';
import { VendorDocumentManager } from '@/components/admin/vendors/VendorDocumentManager';
import { VendorQuickProductLink } from '@/components/admin/vendors/VendorQuickProductLink';
import { SwipeBackWrapper } from '@/components/mobile/SwipeBackWrapper';
import { SEOHead } from '@/components/SEOHead';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbContext';

type Vendor = Database['public']['Tables']['vendors']['Row'];

export default function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();

  // Fetch vendor details
  const { data: vendor, isLoading, error } = useQuery({
    queryKey: queryKeys.vendors.detail(tenant?.id ?? '', vendorId ?? ''),
    queryFn: async () => {
      if (!tenant?.id || !vendorId) return null;

      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, status, contact_email, contact_phone, contact_name, address, city, state, zip_code, license_number, tax_id, payment_terms, notes, account_id, created_at, updated_at')
        .eq('id', vendorId)
        .eq('account_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch vendor', error, { component: 'VendorDetailPage' });
        throw error;
      }

      return data as Vendor | null;
    },
    enabled: !!tenant?.id && !!vendorId,
  });

  // Set breadcrumb label to show vendor name
  useBreadcrumbLabel(vendor?.name ?? null);

  const handleBack = () => {
    navigateToAdmin('vendors');
  };

  const handleEdit = () => {
    navigateToAdmin(`vendors/${vendorId}/edit`);
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !vendor) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h2 className="text-2xl font-bold">Vendor not found</h2>
        <p className="text-muted-foreground mt-2">
          The vendor you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Vendors
        </Button>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <SwipeBackWrapper onBack={handleBack}>
      <div className="container mx-auto py-6 space-y-6">
        <SEOHead
          title={`${vendor.name} - Vendor Details`}
          description={`View details and products for vendor ${vendor.name}`}
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back to vendors">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-3">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                {vendor.name}
                <Badge variant={getStatusBadgeVariant(vendor.status)}>
                  {vendor.status || 'Unknown'}
                </Badge>
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground mt-1">
                {vendor.contact_email && (
                  <div className="flex items-center gap-1 text-sm">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${vendor.contact_email}`} className="hover:underline">
                      {vendor.contact_email}
                    </a>
                  </div>
                )}
                {vendor.contact_phone && (
                  <div className="flex items-center gap-1 text-sm">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${vendor.contact_phone}`} className="hover:underline">
                      {vendor.contact_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <VendorQuickProductLink
              vendorId={vendor.id}
              vendorName={vendor.name}
              paymentTerms={vendor.payment_terms}
              leadTimeDays={(vendor as unknown as Record<string, unknown>).lead_time_days as number | undefined}
              variant="outline"
            />
            <Button onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Vendor
            </Button>
          </div>
        </div>

        {/* Vendor Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Contact Details
                </h4>
                {vendor.contact_name && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Contact:</span>
                    <span className="font-medium">{vendor.contact_name}</span>
                  </div>
                )}
                {vendor.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${vendor.contact_email}`}
                      className="text-primary hover:underline"
                    >
                      {vendor.contact_email}
                    </a>
                  </div>
                )}
                {vendor.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${vendor.contact_phone}`}
                      className="text-primary hover:underline"
                    >
                      {vendor.contact_phone}
                    </a>
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Address
                </h4>
                {(vendor.address || vendor.city || vendor.state || vendor.zip_code) ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      {vendor.address && <div>{vendor.address}</div>}
                      <div>
                        {[vendor.city, vendor.state, vendor.zip_code]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">No address on file</span>
                )}
              </div>

              {/* Business Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Business Info
                </h4>
                {vendor.license_number && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">License:</span>
                    <span className="font-mono">{vendor.license_number}</span>
                  </div>
                )}
                {vendor.tax_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tax ID:</span>
                    <span className="font-mono">{vendor.tax_id}</span>
                  </div>
                )}
                {vendor.payment_terms && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Payment Terms:</span>
                    <Badge variant="outline">{vendor.payment_terms}</Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {vendor.notes && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2">
                  Notes
                </h4>
                <p className="text-sm whitespace-pre-wrap">{vendor.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Products, Order History, Contacts, Compliance, and Payments */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="price-history" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Price History
            </TabsTrigger>
            <TabsTrigger value="communications" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Communications
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <VendorProductCatalog vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>

          <TabsContent value="orders">
            <VendorOrderHistory vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>

          <TabsContent value="contacts">
            <VendorContactsManager vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>

          <TabsContent value="compliance">
            <VendorComplianceTracking vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>

          <TabsContent value="payments">
            <VendorPaymentTracking vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>

          <TabsContent value="price-history">
            <VendorPriceHistory vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>

          <TabsContent value="communications">
            <VendorCommunicationLog vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>

          <TabsContent value="documents">
            <VendorDocumentManager vendorId={vendor.id} vendorName={vendor.name} />
          </TabsContent>
        </Tabs>
      </div>
    </SwipeBackWrapper>
  );
}
