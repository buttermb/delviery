/**
 * Secure File Upload Hook
 *
 * Provides secure file upload functionality with:
 * - MIME type validation
 * - File size limits
 * - Magic byte verification
 * - Sanitized filenames
 * - Progress tracking
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  validateFile,
  generateSecureStoragePath,
  type UploadContext,
  type FileValidationResult,
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
} from '@/lib/fileValidation';

export interface SecureUploadOptions {
  /** The storage bucket name */
  bucket: string;
  /** Upload context for validation rules */
  context: UploadContext;
  /** Optional path prefix within the bucket */
  pathPrefix?: string;
  /** Optional tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Optional user ID for user-scoped uploads */
  userId?: string;
  /** Optional custom max file size (overrides context default) */
  maxSize?: number;
  /** Whether to use upsert (overwrite existing) */
  upsert?: boolean;
  /** Optional custom allowed types (overrides context default) */
  allowedTypes?: string[];
}

export interface UploadResult {
  success: boolean;
  publicUrl?: string;
  storagePath?: string;
  error?: string;
}

export interface UseSecureFileUploadReturn {
  /** Upload a single file */
  uploadFile: (file: File) => Promise<UploadResult>;
  /** Upload multiple files */
  uploadFiles: (files: File[]) => Promise<UploadResult[]>;
  /** Validate a file without uploading */
  validateOnly: (file: File) => Promise<FileValidationResult>;
  /** Current upload progress (0-100) */
  progress: number;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Last validation error */
  validationError: string | null;
  /** Clear validation error */
  clearError: () => void;
  /** Get allowed file types for the context */
  allowedTypes: readonly string[];
  /** Get max file size for the context */
  maxFileSize: number;
}

/**
 * Hook for secure file uploads with validation
 */
export function useSecureFileUpload(
  options: SecureUploadOptions
): UseSecureFileUploadReturn {
  const {
    bucket,
    context,
    pathPrefix = '',
    tenantId,
    userId,
    maxSize,
    upsert = false,
    allowedTypes,
  } = options;

  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const contextAllowedTypes = allowedTypes || ALLOWED_MIME_TYPES[context];
  const contextMaxSize = maxSize || getMaxSizeForContext(context);

  const clearError = useCallback(() => {
    setValidationError(null);
  }, []);

  const validateOnly = useCallback(
    async (file: File): Promise<FileValidationResult> => {
      return validateFile(file, {
        context,
        maxSize: contextMaxSize,
        allowedTypes: contextAllowedTypes as string[],
      });
    },
    [context, contextMaxSize, contextAllowedTypes]
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => {
      setIsUploading(true);
      setProgress(0);
      setValidationError(null);

      try {
        // Step 1: Validate the file
        const validation = await validateFile(file, {
          context,
          maxSize: contextMaxSize,
          allowedTypes: contextAllowedTypes as string[],
        });

        if (!validation.isValid) {
          setValidationError(validation.error || 'File validation failed');
          logger.warn('File validation failed', {
            fileName: file.name,
            error: validation.error,
            context,
          });
          return {
            success: false,
            error: validation.error,
          };
        }

        setProgress(20);

        // Step 2: Generate secure storage path
        const prefix = userId || tenantId
          ? (userId ? `${userId}/${pathPrefix}` : `${tenantId}/${pathPrefix}`)
          : pathPrefix;

        const storagePath = generateSecureStoragePath(
          validation.sanitizedFileName || file.name,
          prefix.replace(/\/+/g, '/').replace(/^\/|\/$/g, ''),
        );

        setProgress(30);

        // Step 3: Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, {
            contentType: validation.detectedMimeType || file.type,
            upsert,
            cacheControl: '3600',
          });

        if (uploadError) {
          logger.error('Storage upload failed', uploadError, {
            bucket,
            storagePath,
            fileSize: file.size,
          });
          return {
            success: false,
            error: uploadError.message,
          };
        }

        setProgress(90);

        // Step 4: Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(storagePath);

        setProgress(100);

        logger.debug('File uploaded successfully', {
          bucket,
          storagePath,
          publicUrl: urlData.publicUrl,
        });

        return {
          success: true,
          publicUrl: urlData.publicUrl,
          storagePath,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        logger.error('File upload error', error instanceof Error ? error : new Error(String(error)), {
          context,
          bucket,
        });
        setValidationError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsUploading(false);
      }
    },
    [bucket, context, pathPrefix, tenantId, userId, contextMaxSize, upsert, contextAllowedTypes]
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      const results: UploadResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const result = await uploadFile(files[i]);
        results.push(result);

        // Update overall progress
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      return results;
    },
    [uploadFile]
  );

  return {
    uploadFile,
    uploadFiles,
    validateOnly,
    progress,
    isUploading,
    validationError,
    clearError,
    allowedTypes: contextAllowedTypes,
    maxFileSize: contextMaxSize,
  };
}

/**
 * Get max file size for upload context
 */
function getMaxSizeForContext(context: UploadContext): number {
  switch (context) {
    case 'productImage':
    case 'idVerification':
    case 'deliveryPhoto':
      return FILE_SIZE_LIMITS.image;
    case 'coaDocument':
    case 'complianceDocument':
      return FILE_SIZE_LIMITS.document;
    case 'dataImport':
      return FILE_SIZE_LIMITS.spreadsheet;
    default:
      return FILE_SIZE_LIMITS.default;
  }
}

/**
 * Convert allowed MIME types to file input accept string
 */
export function getMimeTypesAcceptString(context: UploadContext): string {
  const mimeTypes = ALLOWED_MIME_TYPES[context];
  return mimeTypes.join(',');
}

/**
 * Get human-readable file types for display
 */
export function getReadableFileTypes(context: UploadContext): string {
  const mimeToReadable: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
    'image/gif': 'GIF',
    'image/svg+xml': 'SVG',
    'application/pdf': 'PDF',
    'text/csv': 'CSV',
    'text/plain': 'TXT',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
  };

  const mimeTypes = ALLOWED_MIME_TYPES[context];
  const readable = mimeTypes
    .map((mime) => mimeToReadable[mime] || mime)
    .filter((v, i, a) => a.indexOf(v) === i); // unique values

  return readable.join(', ');
}
