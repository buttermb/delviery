/**
 * FileUploadDropzone
 *
 * A drag-and-drop file upload zone powered by react-dropzone and
 * integrated with useMultiFileUpload for Supabase Storage uploads.
 *
 * Features:
 * - Drag-and-drop + click-to-browse
 * - Per-file progress, retry, and remove
 * - Configurable via UploadContext (productImage, compliance, etc.)
 * - Tenant-isolated storage paths
 * - File type / size validation driven by fileValidation utilities
 */

import { useCallback } from "react";
import { useDropzone, type Accept } from "react-dropzone";

import type { UploadContext } from "@/lib/fileValidation";
import { ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS } from "@/lib/fileValidation";
import { formatFileSize } from "@/components/ui/file-upload";
import type { TrackedFile, UseMultiFileUploadOptions } from "@/hooks/useMultiFileUpload";
import { useMultiFileUpload } from "@/hooks/useMultiFileUpload";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  X,
  FileImage,
  FileText,
  File as FileIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FileUploadDropzoneProps {
  /** Supabase Storage bucket name */
  bucket: string;
  /** Path prefix inside the bucket */
  pathPrefix: string;
  /** Tenant ID for storage path isolation */
  tenantId: string | undefined;
  /** Upload context drives accepted MIME types and size limits */
  uploadContext: UploadContext;
  /** Maximum number of files (default 10) */
  maxFiles?: number;
  /** Override the default size limit for the context */
  maxSize?: number;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Called once per successful upload with the public URL */
  onFileUploaded?: (url: string, file: File) => void;
  /** Called when all queued files have been processed */
  onAllComplete?: (results: TrackedFile[]) => void;
  /** Extra validation overrides passed to useMultiFileUpload */
  validationOverrides?: UseMultiFileUploadOptions["validationOverrides"];
  /** Additional CSS classes */
  className?: string;
  /** Hint text shown below the main label */
  hint?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map UploadContext to a react-dropzone `Accept` object */
function buildAccept(context: UploadContext): Accept {
  const mimes = ALLOWED_MIME_TYPES[context];
  const accept: Accept = {};
  for (const mime of mimes) {
    accept[mime] = [];
  }
  return accept;
}

/** Return an appropriate icon for a tracked file */
function trackedFileIcon(file: File) {
  if (file.type.startsWith("image/")) return FileImage;
  if (file.type === "application/pdf" || file.type.startsWith("text/"))
    return FileText;
  return FileIcon;
}

/** Default max size for a given context */
function defaultMaxSize(context: UploadContext): number {
  switch (context) {
    case "productImage":
    case "idVerification":
    case "deliveryPhoto":
    case "barcode":
      return FILE_SIZE_LIMITS.image;
    case "coaDocument":
    case "complianceDocument":
      return FILE_SIZE_LIMITS.document;
    case "dataImport":
      return FILE_SIZE_LIMITS.spreadsheet;
    default:
      return FILE_SIZE_LIMITS.default;
  }
}

/** Human-readable list of accepted extensions */
function acceptedExtensionsLabel(context: UploadContext): string {
  const mimeToLabel: Record<string, string> = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "image/svg+xml": "SVG",
    "application/pdf": "PDF",
    "text/csv": "CSV",
    "text/plain": "TXT",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-excel": "XLS",
  };
  return ALLOWED_MIME_TYPES[context]
    .map((m) => mimeToLabel[m] ?? m)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FileUploadDropzone({
  bucket,
  pathPrefix,
  tenantId,
  uploadContext,
  maxFiles = 10,
  maxSize,
  disabled = false,
  onFileUploaded,
  onAllComplete,
  validationOverrides,
  className,
  hint,
}: FileUploadDropzoneProps) {
  const effectiveMaxSize = maxSize ?? defaultMaxSize(uploadContext);

  const {
    files,
    isUploading,
    addFiles,
    removeFile,
    retryFile,
    reset,
    successCount,
    errorCount,
  } = useMultiFileUpload({
    bucket,
    pathPrefix,
    tenantId,
    uploadContext,
    maxFiles,
    validationOverrides,
    onFileUploaded,
    onAllComplete,
  });

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;
      logger.debug("FileUploadDropzone: files dropped", {
        count: accepted.length,
        context: uploadContext,
      });
      addFiles(accepted);
    },
    [addFiles, uploadContext],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: buildAccept(uploadContext),
    maxSize: effectiveMaxSize,
    maxFiles,
    multiple: maxFiles > 1,
    disabled: disabled || isUploading,
  });

  const isDropzoneDisabled = disabled || isUploading;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Dropzone area */}
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
          isDragActive && "border-primary bg-primary/5",
          isDropzoneDisabled && "cursor-not-allowed opacity-50",
          !isDropzoneDisabled &&
            !isDragActive &&
            "hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <input {...getInputProps()} />

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Upload className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="text-center space-y-0.5">
          <p className="text-sm font-medium">
            {isDragActive ? (
              <span className="text-primary">Drop files here</span>
            ) : (
              <>
                <span className="text-primary">Click to upload</span>{" "}
                <span className="text-muted-foreground">or drag and drop</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {acceptedExtensionsLabel(uploadContext)} &middot; Max{" "}
            {formatFileSize(effectiveMaxSize)}
            {maxFiles > 1 && ` \u00B7 Up to ${maxFiles} files`}
          </p>
          {hint && (
            <p className="text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((tracked) => (
            <TrackedFileRow
              key={tracked.id}
              tracked={tracked}
              onRemove={removeFile}
              onRetry={retryFile}
            />
          ))}

          {/* Summary bar */}
          {files.length > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>
                {successCount}/{files.length} uploaded
                {errorCount > 0 && ` \u00B7 ${errorCount} failed`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={reset}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrackedFileRow
// ---------------------------------------------------------------------------

interface TrackedFileRowProps {
  tracked: TrackedFile;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

function TrackedFileRow({ tracked, onRemove, onRetry }: TrackedFileRowProps) {
  const Icon = trackedFileIcon(tracked.file);
  const isImage = tracked.file.type.startsWith("image/");

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
      {/* Thumbnail / icon */}
      {isImage && tracked.status === "success" && tracked.url ? (
        <img
          src={tracked.url}
          alt={tracked.file.name}
          className="h-10 w-10 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {/* Name + progress */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tracked.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(tracked.file.size)}
        </p>
        {(tracked.status === "uploading" || tracked.status === "validating") && (
          <Progress value={tracked.progress} className="mt-1 h-1" />
        )}
        {tracked.status === "error" && tracked.error && (
          <p className="mt-0.5 text-xs text-destructive">{tracked.error}</p>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-1">
        {(tracked.status === "uploading" || tracked.status === "validating") && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {tracked.status === "success" && (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
        {tracked.status === "error" && (
          <>
            <AlertCircle className="h-4 w-4 text-destructive" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onRetry(tracked.id)}
              aria-label="Retry upload"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onRemove(tracked.id)}
          aria-label="Remove file"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export { FileUploadDropzone };
export type { FileUploadDropzoneProps };
