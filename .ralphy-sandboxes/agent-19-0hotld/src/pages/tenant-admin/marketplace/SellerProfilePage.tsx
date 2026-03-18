import { logger } from '@/lib/logger';
/**
 * Marketplace Seller Profile Page
 * Allows sellers to create and manage their marketplace profile
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ProfileForm } from './ProfileForm';
import { Building2, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';

export default function SellerProfilePage() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch existing marketplace profile
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('marketplace_profiles')
        .select('id, tenant_id, business_name, business_description, license_number, license_type, license_state, license_verified, license_verified_at, license_verification_notes, marketplace_status, can_sell, shipping_states, logo_url')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch marketplace profile', error, { component: 'SellerProfilePage', tenantId });
        throw error;
      }

      return data;
    },
    enabled: !!tenantId,
  });

  // Check subscription tier (must be Medium+ to access marketplace)
  const subscriptionPlan = tenant?.subscription_plan || 'starter';
  const canAccessMarketplace = subscriptionPlan === 'professional' || subscriptionPlan === 'enterprise' || subscriptionPlan === 'medium';

  if (!canAccessMarketplace) {
    return (
      <div className="space-y-6">
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              Marketplace Access Required
            </CardTitle>
            <CardDescription>
              You need to upgrade to Medium tier or higher to access the marketplace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/${tenant?.slug}/admin/billing`)}>
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If profile exists, show status and edit option
  if (profile) {
    const getStatusBadge = () => {
      switch (profile.marketplace_status) {
        case 'active':
          return (
            <Badge className="bg-success/20 text-success border-success/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          );
        case 'pending':
          return (
            <Badge className="bg-warning/20 text-warning border-warning/30">
              <Clock className="h-3 w-3 mr-1" />
              Pending Verification
            </Badge>
          );
        case 'suspended':
          return (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30">
              <XCircle className="h-3 w-3 mr-1" />
              Suspended
            </Badge>
          );
        case 'rejected':
          return (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30">
              <XCircle className="h-3 w-3 mr-1" />
              Rejected
            </Badge>
          );
        default:
          return null;
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Marketplace Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your seller profile and license information
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Profile Status</CardTitle>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.license_verified ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">License Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-warning">
                <Clock className="h-5 w-5" />
                <span className="font-medium">License Verification Pending</span>
              </div>
            )}

            {profile.license_verified_at && (
              <div className="text-sm text-muted-foreground">
                Verified on: {formatSmartDate(profile.license_verified_at)}
              </div>
            )}

            {profile.license_verification_notes && (
              <div className="text-sm text-muted-foreground">
                <strong>Notes:</strong> {profile.license_verification_notes}
              </div>
            )}

            {profile.marketplace_status === 'rejected' && profile.license_verification_notes && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium mb-1">Rejection Reason:</p>
                <p className="text-sm text-destructive/90">{profile.license_verification_notes}</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/profile/edit`)}>
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Business Name</label>
              <p className="text-sm font-medium">{profile.business_name}</p>
            </div>

            {profile.business_description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm">{profile.business_description}</p>
              </div>
            )}

            {profile.license_number && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">License Number</label>
                <p className="text-sm font-medium">{profile.license_number}</p>
              </div>
            )}

            {profile.license_type && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">License Type</label>
                <p className="text-sm">{profile.license_type}</p>
              </div>
            )}

            {profile.license_state && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">License State</label>
                <p className="text-sm">{profile.license_state}</p>
              </div>
            )}

            {profile.shipping_states && profile.shipping_states.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Shipping States</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.shipping_states.map((state: string) => (
                    <Badge key={state} variant="outline">
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.logo_url && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Logo</label>
                <div className="mt-2">
                  <img src={profile.logo_url} alt="Business logo" className="h-20 w-20 object-contain rounded-lg border" loading="lazy" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // No profile exists - show create form
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Create Marketplace Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up your seller profile to start listing products on the marketplace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Setup</CardTitle>
          <CardDescription>
            Complete your marketplace profile to start selling. Your license will be verified by our team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenantId) });
            toast.success('Profile Created', { description: 'Your profile is pending verification. You\'ll be notified once approved.' });
          }} />
        </CardContent>
      </Card>
    </div>
  );
}

