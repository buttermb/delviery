/**
 * useMultiFileUpload — Generic hook for uploading multiple files to Supabase Storage.
 *
 * Features:
 * - Per-file validation via fileValidation utilities
 * - Per-file progress & status tracking
 * - Concurrent upload with configurable concurrency limit
 * - Tenant-isolated storage paths
 * - Retry / remove / reset helpers
 */

import { useState, useCallback, useRef } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  validateFile,
  generateSecureStoragePath,
  type UploadContext,
  type FileValidationOptions,
} from '@/lib/fileValidation';

// ============================================================================
// Types
// ============================================================================

export type FileUploadStatus = 'pending' | 'validating' | 'uploading' | 'success' | 'error';

export interface TrackedFile {
  /** Stable id for React keys */
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  /** Public URL after successful upload */
  url: string | null;
  /** Human-readable error when status === 'error' */
  error: string | null;
}

export interface UseMultiFileUploadOptions {
  /** Supabase Storage bucket name */
  bucket: string;
  /** Path prefix inside the bucket (e.g. "product-images") */
  pathPrefix: string;
  /** Tenant ID for storage path isolation */
  tenantId: string | undefined;
  /** Upload context for file validation rules */
  uploadContext: UploadContext;
  /** Extra validation overrides (maxSize, allowedTypes) */
  validationOverrides?: Omit<FileValidationOptions, 'context'>;
  /** Max concurrent uploads (default 3) */
  concurrency?: number;
  /** Max number of files that can be queued (default 20) */
  maxFiles?: number;
  /** Called once per successful upload with the public URL */
  onFileUploaded?: (url: string, file: File) => void;
  /** Called when all queued files have been processed */
  onAllComplete?: (results: TrackedFile[]) => void;
}

export interface UseMultiFileUploadReturn {
  /** Current list of tracked files */
  files: TrackedFile[];
  /** Whether any file is currently uploading or validating */
  isUploading: boolean;
  /** Add files to the queue and begin uploading */
  addFiles: (files: File[]) => void;
  /** Remove a file from the list by id */
  removeFile: (id: string) => void;
  /** Retry a failed upload by id */
  retryFile: (id: string) => void;
  /** Clear all tracked files */
  reset: () => void;
  /** Count of successfully uploaded files */
  successCount: number;
  /** Count of failed uploads */
  errorCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

let fileIdCounter = 0;
function nextFileId(): string {
  fileIdCounter += 1;
  return `upload-${fileIdCounter}-${Date.now()}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useMultiFileUpload(
  options: UseMultiFileUploadOptions,
): UseMultiFileUploadReturn {
  const {
    bucket,
    pathPrefix,
    tenantId,
    uploadContext,
    validationOverrides,
    concurrency = 3,
    maxFiles = 20,
    onFileUploaded,
    onAllComplete,
  } = options;

  const [files, setFiles] = useState<TrackedFile[]>([]);

  // Keep a ref to the latest files so async upload closures always read fresh state.
  const filesRef = useRef<TrackedFile[]>(files);
  filesRef.current = files;

  // Ref-ify callbacks to avoid stale closures without forcing re-renders.
  const onFileUploadedRef = useRef(onFileUploaded);
  onFileUploadedRef.current = onFileUploaded;
  const onAllCompleteRef = useRef(onAllComplete);
  onAllCompleteRef.current = onAllComplete;

  // ------------------------------------------------------------------
  // Internal: update a single TrackedFile by id
  // ------------------------------------------------------------------
  const updateFile = useCallback(
    (id: string, patch: Partial<TrackedFile>) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
    [],
  );

  // ------------------------------------------------------------------
  // Internal: upload a single file
  // ------------------------------------------------------------------
  const uploadSingleFile = useCallback(
    async (tracked: TrackedFile) => {
      if (!tenantId) {
        updateFile(tracked.id, {
          status: 'error',
          error: 'No tenant context',
        });
        return;
      }

      // --- Validate ---
      updateFile(tracked.id, { status: 'validating', progress: 0 });

      const validation = await validateFile(tracked.file, {
        context: uploadContext,
        ...validationOverrides,
      });

      if (!validation.isValid) {
        updateFile(tracked.id, {
          status: 'error',
          error: validation.error ?? 'Validation failed',
        });
        return;
      }

      // --- Upload ---
      updateFile(tracked.id, { status: 'uploading', progress: 10 });

      const storagePath = generateSecureStoragePath(
        tracked.file.name,
        pathPrefix,
        tenantId,
      );

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, tracked.file, {
          cacheControl: '3600',
          contentType: tracked.file.type,
          upsert: false,
        });

      if (uploadError) {
        logger.error('Multi-file upload failed', uploadError, {
          component: 'useMultiFileUpload',
          fileName: tracked.file.name,
          bucket,
        });
        updateFile(tracked.id, {
          status: 'error',
          error: uploadError.message || 'Upload failed',
        });
        return;
      }

      // --- Get public URL ---
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      updateFile(tracked.id, {
        status: 'success',
        progress: 100,
        url: publicUrl,
      });

      onFileUploadedRef.current?.(publicUrl, tracked.file);
    },
    [bucket, pathPrefix, tenantId, uploadContext, validationOverrides, updateFile],
  );

  // ------------------------------------------------------------------
  // Internal: process the queue with concurrency control
  // ------------------------------------------------------------------
  const processQueue = useCallback(
    async (trackedFiles: TrackedFile[]) => {
      const pending = [...trackedFiles];
      const active: Promise<void>[] = [];

      const runNext = async (): Promise<void> => {
        const next = pending.shift();
        if (!next) return;

        await uploadSingleFile(next);
        await runNext();
      };

      // Start up to `concurrency` workers
      const workerCount = Math.min(concurrency, pending.length);
      for (let i = 0; i < workerCount; i++) {
        active.push(runNext());
      }

      await Promise.all(active);

      // Fire onAllComplete with the latest state
      // Use a setState callback to read the freshest value
      setFiles((latest) => {
        onAllCompleteRef.current?.(latest);
        return latest;
      });
    },
    [concurrency, uploadSingleFile],
  );

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  const addFiles = useCallback(
    (incoming: File[]) => {
      const currentCount = filesRef.current.length;
      const available = Math.max(0, maxFiles - currentCount);

      if (available === 0) {
        logger.warn('Max file limit reached', {
          component: 'useMultiFileUpload',
          maxFiles,
        });
        return;
      }

      const accepted = incoming.slice(0, available);
      const newTracked: TrackedFile[] = accepted.map((file) => ({
        id: nextFileId(),
        file,
        status: 'pending' as const,
        progress: 0,
        url: null,
        error: null,
      }));

      setFiles((prev) => [...prev, ...newTracked]);

      // Kick off uploads (non-blocking)
      processQueue(newTracked);
    },
    [maxFiles, processQueue],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const retryFile = useCallback(
    (id: string) => {
      const target = filesRef.current.find((f) => f.id === id);
      if (!target || target.status !== 'error') return;

      updateFile(id, { status: 'pending', progress: 0, error: null, url: null });

      // Re-upload
      uploadSingleFile({ ...target, status: 'pending', progress: 0, error: null, url: null });
    },
    [updateFile, uploadSingleFile],
  );

  const reset = useCallback(() => {
    setFiles([]);
  }, []);

  // Derived state
  const isUploading = files.some(
    (f) => f.status === 'uploading' || f.status === 'validating',
  );
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return {
    files,
    isUploading,
    addFiles,
    removeFile,
    retryFile,
    reset,
    successCount,
    errorCount,
  };
}
