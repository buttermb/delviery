/**
 * Vendor Documents Hook
 *
 * Manages document uploads for vendors including CRUD operations,
 * categorization, expiration tracking, and Supabase Storage integration.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import {
  validateFile,
  generateSecureStoragePath,
  FILE_SIZE_LIMITS,
} from '@/lib/fileValidation';

// ============================================================================
// Types
// ============================================================================

export type DocumentCategory =
  | 'contract'
  | 'license'
  | 'lab_result'
  | 'certificate'
  | 'pricing_sheet'
  | 'insurance'
  | 'other';

export interface VendorDocument {
  id: string;
  tenant_id: string;
  vendor_id: string;
  category: DocumentCategory;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  expiration_date: string | null;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInput {
  vendor_id: string;
  category: DocumentCategory;
  name: string;
  file: File;
  expiration_date?: string;
  notes?: string;
}

export interface UpdateDocumentInput {
  id: string;
  category?: DocumentCategory;
  name?: string;
  expiration_date?: string | null;
  notes?: string | null;
}

export interface DocumentFilters {
  category?: DocumentCategory;
  expiringWithinDays?: number;
  searchQuery?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  contract: 'Contract',
  license: 'License',
  lab_result: 'Lab Result',
  certificate: 'Certificate',
  pricing_sheet: 'Pricing Sheet',
  insurance: 'Insurance',
  other: 'Other',
};

export const DOCUMENT_CATEGORY_OPTIONS = Object.entries(DOCUMENT_CATEGORY_LABELS).map(
  ([value, label]) => ({
    value: value as DocumentCategory,
    label,
  })
);

// Storage bucket for vendor documents
const STORAGE_BUCKET = 'documents';
const STORAGE_PREFIX = 'vendor-documents';

// ============================================================================
// Hook: useVendorDocuments
// ============================================================================

export function useVendorDocuments(vendorId: string) {
  const { tenant, user } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Local state for filters
  const [filters, setFilters] = useState<DocumentFilters>({});

  // Fetch all documents for a vendor
  const documentsQuery = useQuery({
    queryKey: queryKeys.vendors.documents(tenantId || '', vendorId),
    queryFn: async (): Promise<VendorDocument[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch vendor documents', error, {
          component: 'useVendorDocuments',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorDocument[];
    },
    enabled: !!tenantId && !!vendorId,
  });

  // Filter documents client-side
  const filteredDocuments = useMemo(() => {
    if (!documentsQuery.data) return [];

    let result = [...documentsQuery.data];

    // Filter by category
    if (filters.category) {
      result = result.filter((d) => d.category === filters.category);
    }

    // Filter by expiring within days
    if (filters.expiringWithinDays !== undefined) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
      result = result.filter((d) => {
        if (!d.expiration_date) return false;
        const expDate = new Date(d.expiration_date);
        return expDate <= futureDate && expDate >= new Date();
      });
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          (d.notes && d.notes.toLowerCase().includes(query)) ||
          DOCUMENT_CATEGORY_LABELS[d.category].toLowerCase().includes(query)
      );
    }

    return result;
  }, [documentsQuery.data, filters]);

  // Get expiring documents (within 30 days)
  const expiringDocuments = useMemo(() => {
    if (!documentsQuery.data) return [];

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const now = new Date();

    return documentsQuery.data.filter((d) => {
      if (!d.expiration_date) return false;
      const expDate = new Date(d.expiration_date);
      return expDate <= futureDate && expDate >= now;
    });
  }, [documentsQuery.data]);

  // Get expired documents
  const expiredDocuments = useMemo(() => {
    if (!documentsQuery.data) return [];

    const now = new Date();
    return documentsQuery.data.filter((d) => {
      if (!d.expiration_date) return false;
      const expDate = new Date(d.expiration_date);
      return expDate < now;
    });
  }, [documentsQuery.data]);

  // Upload file to Supabase storage
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      // Validate file
      const validation = await validateFile(file, {
        context: 'complianceDocument',
        maxSize: FILE_SIZE_LIMITS.document,
      });

      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid file');
      }

      // Generate secure storage path with tenant isolation
      const filePath = generateSecureStoragePath(
        file.name,
        STORAGE_PREFIX,
        tenantId
      );

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        logger.error('File upload failed', uploadError, {
          component: 'useVendorDocuments',
          tenantId,
        });
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      return publicUrl;
    },
    [tenantId]
  );

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (input: CreateDocumentInput): Promise<VendorDocument> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      // Upload file first
      const fileUrl = await uploadFile(input.file);

      // Get user name for uploaded_by_name
      let uploadedByName: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('tenant_users')
          .select('full_name')
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        uploadedByName = profile?.full_name ?? user.email ?? null;
      }

      const { data, error } = await supabase
        .from('vendor_documents')
        .insert({
          tenant_id: tenantId,
          vendor_id: input.vendor_id,
          category: input.category,
          name: input.name,
          file_url: fileUrl,
          file_type: input.file.type,
          file_size: input.file.size,
          expiration_date: input.expiration_date ?? null,
          notes: input.notes ?? null,
          uploaded_by: user?.id ?? null,
          uploaded_by_name: uploadedByName,
        })
        .select('*')
        .single();

      if (error) {
        logger.error('Failed to create vendor document', error, {
          component: 'useVendorDocuments',
          tenantId,
          vendorId: input.vendor_id,
        });
        throw error;
      }

      return data as VendorDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.documents(tenantId || '', vendorId),
      });
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async (input: UpdateDocumentInput): Promise<VendorDocument> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const updateData: Record<string, unknown> = {};
      if (input.category !== undefined) updateData.category = input.category;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.expiration_date !== undefined) updateData.expiration_date = input.expiration_date;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('vendor_documents')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        logger.error('Failed to update vendor document', error, {
          component: 'useVendorDocuments',
          tenantId,
          documentId: input.id,
        });
        throw error;
      }

      return data as VendorDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.documents(tenantId || '', vendorId),
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      // First get the document to find the file path
      const { data: doc, error: fetchError } = await supabase
        .from('vendor_documents')
        .select('file_url')
        .eq('id', documentId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) {
        logger.error('Failed to fetch document for deletion', fetchError, {
          component: 'useVendorDocuments',
          tenantId,
          documentId,
        });
        throw fetchError;
      }

      // Delete from database
      const { error } = await supabase
        .from('vendor_documents')
        .delete()
        .eq('id', documentId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete vendor document', error, {
          component: 'useVendorDocuments',
          tenantId,
          documentId,
        });
        throw error;
      }

      // Try to delete from storage (don't fail if this fails)
      if (doc?.file_url) {
        try {
          // Extract path from URL
          const url = new URL(doc.file_url);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
          if (pathMatch?.[1]) {
            await supabase.storage.from(STORAGE_BUCKET).remove([pathMatch[1]]);
          }
        } catch (storageError) {
          logger.warn('Failed to delete file from storage', {
            component: 'useVendorDocuments',
            error: storageError,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.documents(tenantId || '', vendorId),
      });
    },
  });

  // Filter handlers
  const updateFilters = useCallback((newFilters: Partial<DocumentFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    // Query data
    documents: documentsQuery.data ?? [],
    filteredDocuments,
    expiringDocuments,
    expiredDocuments,
    isLoading: documentsQuery.isLoading,
    isError: documentsQuery.isError,
    error: documentsQuery.error,

    // Filters
    filters,
    updateFilters,
    clearFilters,

    // Mutations
    createDocument: createDocumentMutation.mutateAsync,
    updateDocument: updateDocumentMutation.mutateAsync,
    deleteDocument: deleteDocumentMutation.mutateAsync,

    // Mutation states
    isCreating: createDocumentMutation.isPending,
    isUpdating: updateDocumentMutation.isPending,
    isDeleting: deleteDocumentMutation.isPending,
  };
}
