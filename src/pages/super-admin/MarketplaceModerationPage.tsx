import { logger } from '@/lib/logger';
/**
 * Marketplace Moderation Page
 * Super Admin can verify licenses and moderate marketplace profiles
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Shield,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';

export default function MarketplaceModerationPage() {
  const { superAdmin } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationAction, setVerificationAction] = useState<'approve' | 'reject' | null>(null);

  // Fetch marketplace profiles pending verification (both sellers and buyers)
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['marketplace-profiles-moderation', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_profiles')
        .select(`
          *,
          tenants!inner (
            id,
            business_name,
            slug,
            subscription_plan,
            subscription_status
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('marketplace_status', statusFilter);
      } else {
        // Show pending and active by default
        query = query.in('marketplace_status', ['pending', 'active', 'rejected']);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch marketplace profiles', error, { component: 'MarketplaceModerationPage' });
        throw error;
      }

      return data || [];
    },
  });

  // Filter profiles by search query
  const filteredProfiles = profiles.filter((profile: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      profile.business_name?.toLowerCase().includes(query) ||
      profile.license_number?.toLowerCase().includes(query) ||
      profile.tenants?.business_name?.toLowerCase().includes(query)
    );
  });

  // Verify license mutation
  const verifyLicenseMutation = useMutation({
    mutationFn: async ({ 
      profileId, 
      action, 
      notes 
    }: { 
      profileId: string; 
      action: 'approve' | 'reject';
      notes: string;
    }) => {
      // Get current profile to check if it's a seller or buyer
      const { data: currentProfile } = await supabase
        .from('marketplace_profiles')
        .select('can_sell')
        .eq('id', profileId)
        .maybeSingle();

      const isSeller = currentProfile?.can_sell !== false; // Default to seller if not explicitly set

      const updateData: any = {
        license_verified: action === 'approve',
        license_verified_at: action === 'approve' ? new Date().toISOString() : null,
        license_verified_by: superAdmin?.id || null,
        license_verification_notes: notes || null,
        marketplace_status: action === 'approve' ? 'active' : 'rejected',
      };

      if (action === 'approve') {
        updateData.verified_badge = true;
        // Only set can_sell for sellers; buyers remain can_sell = false
        if (isSeller) {
          updateData.can_sell = true;
        }
      } else if (action === 'reject') {
        updateData.can_sell = false;
      }

      const { error } = await supabase
        .from('marketplace_profiles')
        .update(updateData)
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-profiles-moderation'] });
      toast.success(variables.action === 'approve'
          ? 'Profile verified and activated'
          : 'License verification rejected');
      setShowVerificationDialog(false);
      setSelectedProfile(null);
      setVerificationNotes('');
    },
    onError: (error: unknown) => {
      logger.error('Failed to verify license', error, { component: 'MarketplaceModerationPage' });
      toast.error(error instanceof Error ? error.message : 'Failed to verify license');
    },
  });

  const handleVerify = (profile: any, action: 'approve' | 'reject') => {
    setSelectedProfile(profile);
    setVerificationAction(action);
    setVerificationNotes(profile.license_verification_notes || '');
    setShowVerificationDialog(true);
  };

  const handleSubmitVerification = () => {
    if (!selectedProfile) return;

    verifyLicenseMutation.mutate({
      profileId: selectedProfile.id,
      action: verificationAction!,
      notes: verificationNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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
            Pending
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Suspended
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Marketplace Moderation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verify licenses and moderate marketplace profiles (sellers & buyers)
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
                  placeholder="Search by business name, license number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Profiles Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Marketplace Profiles ({filteredProfiles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Profiles Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try adjusting your search' : 'No marketplace profiles to moderate'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>License Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile: any) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{profile.business_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {profile.tenants?.business_name || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.can_sell ? "default" : "secondary"}>
                          {profile.can_sell ? "Seller" : "Buyer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-mono">{profile.license_number || '—'}</div>
                          {profile.license_state && (
                            <div className="text-xs text-muted-foreground">{profile.license_state}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{profile.license_type || '—'}</TableCell>
                      <TableCell>{getStatusBadge(profile.marketplace_status)}</TableCell>
                      <TableCell>
                        {profile.license_verified ? (
                          <Badge className="bg-success/20 text-success border-success/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not Verified</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatSmartDate(profile.created_at as string)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProfile(profile);
                              setShowVerificationDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {profile.marketplace_status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerify(profile, 'approve')}
                                className="text-success border-success/30 hover:bg-success/10"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerify(profile, 'reject')}
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {verificationAction === 'approve' ? 'Approve License' : 'Reject License'}
            </DialogTitle>
            <DialogDescription>
              {selectedProfile && (
                <div className="mt-2 space-y-2">
                  <div>
                    <strong>Business:</strong> {selectedProfile.business_name}
                  </div>
                  <div>
                    <strong>License Number:</strong> {selectedProfile.license_number}
                  </div>
                  <div>
                    <strong>License Type:</strong> {selectedProfile.license_type}
                  </div>
                  {selectedProfile.license_document_url && (
                    <div>
                      <strong>License Document:</strong>{' '}
                      <a
                        href={selectedProfile.license_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        View Document
                      </a>
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Verification Notes</Label>
              <Textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder={verificationAction === 'approve' 
                  ? 'Add notes about the verification (optional)'
                  : 'Explain why the license was rejected (required)'}
                rows={4}
              />
            </div>
            {verificationAction === 'reject' && !verificationNotes.trim() && (
              <p className="text-sm text-destructive">
                Please provide a reason for rejection
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVerificationDialog(false);
                setSelectedProfile(null);
                setVerificationNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitVerification}
              disabled={verifyLicenseMutation.isPending || (verificationAction === 'reject' && !verificationNotes.trim())}
              variant={verificationAction === 'approve' ? 'default' : 'destructive'}
            >
              {verificationAction === 'approve' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve License
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject License
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

