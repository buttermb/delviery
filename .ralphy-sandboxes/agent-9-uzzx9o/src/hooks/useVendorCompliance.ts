/**
 * Vendor Compliance Hook
 *
 * Manages vendor compliance tracking for cannabis vendors.
 * Features:
 * - License tracking (number, type, expiration, jurisdiction)
 * - Approved product categories
 * - Compliance document uploads
 * - License expiration warnings
 * - Audit trail for compliance changes
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// Types
// ============================================================================

export type LicenseType =
  | 'cultivator'
  | 'processor'
  | 'distributor'
  | 'retailer'
  | 'testing_lab'
  | 'transporter'
  | 'manufacturer'
  | 'other';

export type ComplianceStatus = 'compliant' | 'warning' | 'expired' | 'pending';

export interface VendorCompliance {
  id: string;
  tenant_id: string;
  vendor_id: string;
  license_number: string;
  license_type: LicenseType;
  license_expiration: string | null;
  jurisdiction: string | null;
  approved_categories: string[];
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceDocument {
  id: string;
  tenant_id: string;
  vendor_compliance_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface ComplianceAuditEntry {
  id: string;
  tenant_id: string;
  vendor_compliance_id: string;
  action: string;
  changes: Record<string, unknown>;
  performed_by: string | null;
  performed_at: string;
}

export interface CreateVendorComplianceInput {
  vendor_id: string;
  license_number: string;
  license_type: LicenseType;
  license_expiration?: string;
  jurisdiction?: string;
  approved_categories?: string[];
  is_active?: boolean;
  notes?: string;
}

export interface UpdateVendorComplianceInput {
  id: string;
  license_number?: string;
  license_type?: LicenseType;
  license_expiration?: string | null;
  jurisdiction?: string | null;
  approved_categories?: string[];
  is_active?: boolean;
  notes?: string | null;
}

export interface UploadComplianceDocInput {
  vendor_compliance_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
}

// ============================================================================
// Constants
// ============================================================================

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  cultivator: 'Cultivator',
  processor: 'Processor',
  distributor: 'Distributor',
  retailer: 'Retailer',
  testing_lab: 'Testing Lab',
  transporter: 'Transporter',
  manufacturer: 'Manufacturer',
  other: 'Other',
};

export const LICENSE_TYPE_OPTIONS = Object.entries(LICENSE_TYPE_LABELS).map(
  ([value, label]) => ({
    value: value as LicenseType,
    label,
  })
);

export const COMMON_PRODUCT_CATEGORIES = [
  'Flower',
  'Concentrates',
  'Edibles',
  'Topicals',
  'Tinctures',
  'Pre-rolls',
  'Vapes',
  'Accessories',
  'Seeds',
  'Clones',
];

export const WARNING_DAYS_THRESHOLD = 30;

// ============================================================================
// Helper Functions
// ============================================================================

export function getComplianceStatus(
  compliance: VendorCompliance | null
): ComplianceStatus {
  if (!compliance) return 'pending';
  if (!compliance.is_active) return 'expired';
  if (!compliance.license_expiration) return 'compliant';

  const expirationDate = new Date(compliance.license_expiration);
  const today = new Date();
  const daysUntilExpiration = Math.ceil(
    (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiration < 0) return 'expired';
  if (daysUntilExpiration <= WARNING_DAYS_THRESHOLD) return 'warning';
  return 'compliant';
}

export function getDaysUntilExpiration(
  expirationDate: string | null
): number | null {
  if (!expirationDate) return null;
  const expDate = new Date(expirationDate);
  const today = new Date();
  return Math.ceil(
    (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ============================================================================
// Hook: useVendorCompliance
// ============================================================================

export function useVendorCompliance(vendorId: string) {
  const { tenant, admin: user } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch compliance records for a vendor
  const complianceQuery = useQuery({
    queryKey: queryKeys.vendors.compliance(tenantId ?? '', vendorId),
    queryFn: async (): Promise<VendorCompliance[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_compliance')
        .select('id, tenant_id, vendor_id, license_number, license_type, license_expiration, jurisdiction, approved_categories, is_active, notes, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .order('is_active', { ascending: false })
        .order('license_expiration', { ascending: true });

      if (error) {
        logger.error('Failed to fetch vendor compliance', error, {
          component: 'useVendorCompliance',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorCompliance[];
    },
    enabled: !!tenantId && !!vendorId,
  });

  // Create compliance mutation
  const createComplianceMutation = useMutation({
    mutationFn: async (
      input: CreateVendorComplianceInput
    ): Promise<VendorCompliance> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_compliance')
        .insert({
          tenant_id: tenantId,
          vendor_id: input.vendor_id,
          license_number: input.license_number,
          license_type: input.license_type,
          license_expiration: input.license_expiration ?? null,
          jurisdiction: input.jurisdiction ?? null,
          approved_categories: input.approved_categories ?? [],
          is_active: input.is_active ?? true,
          notes: input.notes ?? null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create vendor compliance', error, {
          component: 'useVendorCompliance',
          tenantId,
          vendorId: input.vendor_id,
        });
        throw error;
      }

      // Log audit entry
      await logAuditEntry(tenantId, (data as VendorCompliance).id, 'created', {
        license_number: input.license_number,
        license_type: input.license_type,
      });

      return data as VendorCompliance;
    },
    onSuccess: () => {
      toast.success('Compliance record created successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.compliance(tenantId ?? '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to create compliance record'));
    },
  });

  // Update compliance mutation
  const updateComplianceMutation = useMutation({
    mutationFn: async (
      input: UpdateVendorComplianceInput
    ): Promise<VendorCompliance> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      // Fetch current state for audit
      const { data: currentData } = await supabase
        .from('vendor_compliance')
        .select('license_number, license_type, license_expiration, jurisdiction, approved_categories, is_active')
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const updateData: Record<string, unknown> = {};
      const changes: Record<string, unknown> = {};

      if (input.license_number !== undefined) {
        updateData.license_number = input.license_number;
        if (currentData?.license_number !== input.license_number) {
          changes.license_number = {
            from: currentData?.license_number,
            to: input.license_number,
          };
        }
      }
      if (input.license_type !== undefined) {
        updateData.license_type = input.license_type;
        if (currentData?.license_type !== input.license_type) {
          changes.license_type = {
            from: currentData?.license_type,
            to: input.license_type,
          };
        }
      }
      if (input.license_expiration !== undefined) {
        updateData.license_expiration = input.license_expiration;
        if (currentData?.license_expiration !== input.license_expiration) {
          changes.license_expiration = {
            from: currentData?.license_expiration,
            to: input.license_expiration,
          };
        }
      }
      if (input.jurisdiction !== undefined) {
        updateData.jurisdiction = input.jurisdiction;
        if (currentData?.jurisdiction !== input.jurisdiction) {
          changes.jurisdiction = {
            from: currentData?.jurisdiction,
            to: input.jurisdiction,
          };
        }
      }
      if (input.approved_categories !== undefined) {
        updateData.approved_categories = input.approved_categories;
        changes.approved_categories = {
          from: currentData?.approved_categories,
          to: input.approved_categories,
        };
      }
      if (input.is_active !== undefined) {
        updateData.is_active = input.is_active;
        if (currentData?.is_active !== input.is_active) {
          changes.is_active = { from: currentData?.is_active, to: input.is_active };
        }
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      const { data, error } = await supabase
        .from('vendor_compliance')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update vendor compliance', error, {
          component: 'useVendorCompliance',
          tenantId,
          complianceId: input.id,
        });
        throw error;
      }

      // Log audit entry if there were changes
      if (Object.keys(changes).length > 0) {
        await logAuditEntry(tenantId, input.id, 'updated', changes);
      }

      return data as VendorCompliance;
    },
    onSuccess: () => {
      toast.success('Compliance record updated successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.compliance(tenantId ?? '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to update compliance record'));
    },
  });

  // Delete compliance mutation
  const deleteComplianceMutation = useMutation({
    mutationFn: async (complianceId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { error } = await supabase
        .from('vendor_compliance')
        .delete()
        .eq('id', complianceId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete vendor compliance', error, {
          component: 'useVendorCompliance',
          tenantId,
          complianceId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Compliance record deleted successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.compliance(tenantId ?? '', vendorId),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to delete compliance record'));
    },
  });

  // Helper to log audit entries
  const logAuditEntry = async (
    tenantIdVal: string,
    complianceId: string,
    action: string,
    changes: Record<string, unknown>
  ) => {
    try {
      await supabase.from('vendor_compliance_audit').insert({
        tenant_id: tenantIdVal,
        vendor_compliance_id: complianceId,
        action,
        changes,
        performed_by: user?.id ?? null,
      });
    } catch (error) {
      // Silent fail for audit logging
      logger.warn('Failed to log compliance audit entry', {
        component: 'useVendorCompliance',
        error,
      });
    }
  };

  // Get primary/active compliance
  const activeCompliance =
    complianceQuery.data?.find((c) => c.is_active) ?? null;
  const complianceStatus = getComplianceStatus(activeCompliance);
  const isExpired = complianceStatus === 'expired';
  const isWarning = complianceStatus === 'warning';

  return {
    // Query data
    complianceRecords: complianceQuery.data ?? [],
    activeCompliance,
    complianceStatus,
    isExpired,
    isWarning,
    isLoading: complianceQuery.isLoading,
    isError: complianceQuery.isError,
    error: complianceQuery.error,

    // Mutations
    createCompliance: createComplianceMutation.mutateAsync,
    updateCompliance: updateComplianceMutation.mutateAsync,
    deleteCompliance: deleteComplianceMutation.mutateAsync,

    // Mutation states
    isCreating: createComplianceMutation.isPending,
    isUpdating: updateComplianceMutation.isPending,
    isDeleting: deleteComplianceMutation.isPending,
  };
}

// ============================================================================
// Hook: useVendorComplianceDocuments
// ============================================================================

export function useVendorComplianceDocuments(complianceId: string) {
  const { tenant, admin: user } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const documentsQuery = useQuery({
    queryKey: queryKeys.vendors.complianceDocuments(
      tenantId ?? '',
      complianceId
    ),
    queryFn: async (): Promise<ComplianceDocument[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_compliance_documents')
        .select('id, tenant_id, vendor_compliance_id, document_name, document_type, file_url, uploaded_by, uploaded_at')
        .eq('tenant_id', tenantId)
        .eq('vendor_compliance_id', complianceId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch compliance documents', error, {
          component: 'useVendorComplianceDocuments',
          tenantId,
          complianceId,
        });
        throw error;
      }

      return (data ?? []) as ComplianceDocument[];
    },
    enabled: !!tenantId && !!complianceId,
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (
      input: UploadComplianceDocInput
    ): Promise<ComplianceDocument> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_compliance_documents')
        .insert({
          tenant_id: tenantId,
          vendor_compliance_id: input.vendor_compliance_id,
          document_name: input.document_name,
          document_type: input.document_type,
          file_url: input.file_url,
          uploaded_by: user?.id ?? null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to upload compliance document', error, {
          component: 'useVendorComplianceDocuments',
          tenantId,
          complianceId: input.vendor_compliance_id,
        });
        throw error;
      }

      return data as ComplianceDocument;
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.complianceDocuments(
          tenantId ?? '',
          complianceId
        ),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to upload document'));
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { error } = await supabase
        .from('vendor_compliance_documents')
        .delete()
        .eq('id', documentId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete compliance document', error, {
          component: 'useVendorComplianceDocuments',
          tenantId,
          documentId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Document deleted successfully');
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.complianceDocuments(
          tenantId ?? '',
          complianceId
        ),
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to delete document'));
    },
  });

  return {
    documents: documentsQuery.data ?? [],
    isLoading: documentsQuery.isLoading,
    isError: documentsQuery.isError,
    uploadDocument: uploadDocumentMutation.mutateAsync,
    deleteDocument: deleteDocumentMutation.mutateAsync,
    isUploading: uploadDocumentMutation.isPending,
    isDeleting: deleteDocumentMutation.isPending,
  };
}

// ============================================================================
// Hook: useVendorComplianceAudit
// ============================================================================

export function useVendorComplianceAudit(complianceId: string) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.vendors.complianceAudit(tenantId ?? '', complianceId),
    queryFn: async (): Promise<ComplianceAuditEntry[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_compliance_audit')
        .select('id, tenant_id, vendor_compliance_id, action, changes, performed_by, performed_at')
        .eq('tenant_id', tenantId)
        .eq('vendor_compliance_id', complianceId)
        .order('performed_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch compliance audit log', error, {
          component: 'useVendorComplianceAudit',
          tenantId,
          complianceId,
        });
        throw error;
      }

      return (data ?? []) as ComplianceAuditEntry[];
    },
    enabled: !!tenantId && !!complianceId,
  });
}
