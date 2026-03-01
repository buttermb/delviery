import { logger } from '@/lib/logger';
/**
 * Business Verification Card
 * Allows customers to upload business license for wholesale buyer verification
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  Building2, 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const LICENSE_TYPES = [
  { value: 'adult_use', label: 'Adult-Use Retail' },
  { value: 'medical', label: 'Medical Retail' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'cultivator', label: 'Cultivator' },
  { value: 'processor', label: 'Processor' },
  { value: 'testing_lab', label: 'Testing Lab' },
  { value: 'other', label: 'Other' },
];

export function BusinessVerificationCard() {
  const { tenant } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    license_number: '',
    license_type: '',
    license_state: '',
    license_expiry_date: '',
    tax_id: '',
    business_description: '',
  });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

  const tenantId = tenant?.id;

  // Fetch existing marketplace profile (buyer profile)
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.marketplaceProfile.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('marketplace_profiles')
        .select('id, business_name, license_number, license_type, license_state, license_expiry_date, business_description, license_document_url, marketplace_status, license_verified, license_verified_at, license_verified_by, license_verification_notes')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch marketplace profile', error, { component: 'BusinessVerificationCard' });
        throw error;
      }

      return data;
    },
    enabled: !!tenantId,
  });

  // Initialize form with existing data
  useEffect(() => {
    if (profile) {
      setFormData({
        business_name: profile.business_name ?? '',
        license_number: profile.license_number ?? '',
        license_type: profile.license_type ?? '',
        license_state: profile.license_state ?? '',
        license_expiry_date: profile.license_expiry_date ? new Date(profile.license_expiry_date).toISOString().split('T')[0] : '',
        tax_id: '', // Not stored in marketplace_profiles, would need separate field
        business_description: profile.business_description ?? '',
      });
    }
  }, [profile]);

  // Upload license document
  const handleFileUpload = async (file: File): Promise<string> => {
    if (!tenantId) throw new Error('Tenant ID required');

    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}/business-license-${Date.now()}.${fileExt}`;
    const filePath = `marketplace/licenses/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('marketplace-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      logger.error('Failed to upload license document', uploadError, { component: 'BusinessVerificationCard' });
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('marketplace-documents')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  // Create or update marketplace profile
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');

      let licenseDocumentUrl = profile?.license_document_url;

      // Upload license document if provided
      if (licenseFile) {
        setUploading(true);
        try {
          licenseDocumentUrl = await handleFileUpload(licenseFile);
        } finally {
          setUploading(false);
        }
      }

      const profileData = {
        tenant_id: tenantId,
        business_name: formData.business_name,
        business_description: formData.business_description,
        license_number: formData.license_number,
        license_type: formData.license_type,
        license_state: formData.license_state,
        license_expiry_date: formData.license_expiry_date || null,
        license_document_url: licenseDocumentUrl,
        marketplace_status: profile ? profile.marketplace_status : 'pending',
        license_verified: false, // Reset verification when updated
        license_verified_at: null,
        license_verified_by: null,
        license_verification_notes: null,
      };

      if (profile) {
        // Update existing profile
        const { error } = await supabase
          .from('marketplace_profiles')
          .update(profileData)
          .eq('id', profile.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('marketplace_profiles')
          .insert(profileData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProfile.byTenant(tenantId) });
      toast.success('Business Profile Submitted — Your business information has been submitted for verification. You will be notified once verified.');
    },
    onError: (error: unknown) => {
      logger.error('Failed to submit business profile', error, { component: 'BusinessVerificationCard' });
      toast.error('Failed to submit business profile', { description: humanizeError(error) });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isVerified = profile?.license_verified === true;
  const isPending = profile?.marketplace_status === 'pending';
  const isRejected = profile?.marketplace_status === 'rejected';

  return (
    <Card className="bg-white border-[hsl(var(--customer-border))] shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[hsl(var(--customer-text))]">
          <Building2 className="h-5 w-5 text-[hsl(var(--customer-primary))]" />
          Business Verification
        </CardTitle>
        <CardDescription className="text-[hsl(var(--customer-text-light))]">
          Verify your business to access wholesale marketplace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Badge */}
        {profile && (
          <div className="flex items-center gap-2">
            {isVerified ? (
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : isPending ? (
              <Badge className="bg-yellow-500 text-white">
                <Clock className="h-3 w-3 mr-1" />
                Pending Verification
              </Badge>
            ) : isRejected ? (
              <Badge className="bg-red-500 text-white">
                <XCircle className="h-3 w-3 mr-1" />
                Rejected
              </Badge>
            ) : null}
            {profile.license_verification_notes && (
              <p className="text-sm text-muted-foreground">
                {profile.license_verification_notes}
              </p>
            )}
          </div>
        )}

        {!isVerified && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="business_name" className="text-[hsl(var(--customer-text))]">
                Business Name *
              </Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                placeholder="Your business name"
                required
                className="border-[hsl(var(--customer-border))]"
              />
            </div>

            {/* License Number */}
            <div className="space-y-2">
              <Label htmlFor="license_number" className="text-[hsl(var(--customer-text))]">
                Business License Number *
              </Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                placeholder="Enter your business license number"
                required
                className="border-[hsl(var(--customer-border))]"
              />
            </div>

            {/* License Type & State */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="license_type" className="text-[hsl(var(--customer-text))]">
                  License Type *
                </Label>
                <Select
                  value={formData.license_type}
                  onValueChange={(value) => setFormData({ ...formData, license_type: value })}
                  required
                >
                  <SelectTrigger className="border-[hsl(var(--customer-border))]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LICENSE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_state" className="text-[hsl(var(--customer-text))]">
                  License State *
                </Label>
                <Select
                  value={formData.license_state}
                  onValueChange={(value) => setFormData({ ...formData, license_state: value })}
                  required
                >
                  <SelectTrigger className="border-[hsl(var(--customer-border))]">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* License Expiry Date */}
            <div className="space-y-2">
              <Label htmlFor="license_expiry_date" className="text-[hsl(var(--customer-text))]">
                License Expiry Date
              </Label>
              <Input
                id="license_expiry_date"
                type="date"
                value={formData.license_expiry_date}
                onChange={(e) => setFormData({ ...formData, license_expiry_date: e.target.value })}
                className="border-[hsl(var(--customer-border))]"
              />
            </div>

            {/* Tax ID / EIN */}
            <div className="space-y-2">
              <Label htmlFor="tax_id" className="text-[hsl(var(--customer-text))]">
                Tax ID / EIN
              </Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="Enter your Tax ID or EIN (optional)"
                className="border-[hsl(var(--customer-border))]"
              />
            </div>

            {/* Business Description */}
            <div className="space-y-2">
              <Label htmlFor="business_description" className="text-[hsl(var(--customer-text))]">
                Business Description
              </Label>
              <Textarea
                id="business_description"
                value={formData.business_description}
                onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                placeholder="Brief description of your business"
                rows={3}
                className="border-[hsl(var(--customer-border))]"
              />
            </div>

            {/* License Document Upload */}
            <div className="space-y-2">
              <Label htmlFor="license_document" className="text-[hsl(var(--customer-text))]">
                License Document (PDF) *
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="license_document"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('File must be less than 10MB');
                        return;
                      }
                      setLicenseFile(file);
                    }
                  }}
                  className="border-[hsl(var(--customer-border))]"
                />
                {licenseFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    {licenseFile.name}
                  </div>
                )}
                {profile?.license_document_url && !licenseFile && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Document uploaded
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a clear photo or PDF of your business license (max 10MB)
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitMutation.isPending || uploading}
              className="w-full bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
            >
              {submitMutation.isPending || uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? 'Uploading...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {profile ? 'Update Business Profile' : 'Submit for Verification'}
                </>
              )}
            </Button>

            {!profile && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-800">
                  After submission, your business license will be reviewed by our team. 
                  You'll receive an email notification once verification is complete.
                </p>
              </div>
            )}
          </form>
        )}

        {isVerified && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Business Verified</p>
                <p className="text-sm text-green-700 mt-1">
                  Your business has been verified. You can now access the wholesale marketplace and place orders.
                </p>
                {profile.license_verified_at && (
                  <p className="text-xs text-green-600 mt-2">
                    Verified on: {formatSmartDate(profile.license_verified_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

