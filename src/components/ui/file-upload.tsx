import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  X,
  File,
  FileImage,
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  validateImageDimensions,
  formatDimensionConstraints,
  type ImageDimensionConstraints,
} from "@/lib/utils/validation";

/**
 * File type icons mapping
 */
const fileTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  image: FileImage,
  text: FileText,
  application: FileArchive,
  audio: FileAudio,
  video: FileVideo,
  default: File,
};

/**
 * Get icon component for file type
 */
function getFileIcon(mimeType: string): React.ComponentType<{ className?: string }> {
  const type = mimeType.split("/")[0];
  return fileTypeIcons[type] || fileTypeIcons.default;
}

/**
 * Format file size to human readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * File with upload status
 */
interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
  preview?: string;
}

interface FileUploadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /**
   * Accepted file types (e.g., "image/*", ".pdf,.doc")
   */
  accept?: string;
  /**
   * Maximum file size in bytes
   */
  maxSize?: number;
  /**
   * Maximum number of files (1 for single file upload)
   */
  maxFiles?: number;
  /**
   * Whether multiple files can be uploaded
   */
  multiple?: boolean;
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
  /**
   * Callback when files are selected
   */
  onChange?: (files: File[]) => void;
  /**
   * Callback when a file is removed
   */
  onRemove?: (file: File) => void;
  /**
   * Custom upload handler that returns progress updates
   */
  onUpload?: (file: File, onProgress: (progress: number) => void) => Promise<void>;
  /**
   * Currently uploaded files (for controlled mode)
   */
  value?: File[];
  /**
   * Display variant
   */
  variant?: "default" | "compact" | "button";
  /**
   * Whether to show file previews for images
   */
  showPreview?: boolean;
  /**
   * Image dimension constraints (only applies to image files)
   * Set minWidth, minHeight, maxWidth, maxHeight to validate image dimensions
   */
  imageDimensions?: ImageDimensionConstraints;
}

/**
 * FileUpload Component
 * 
 * A drag-and-drop file upload component with progress tracking,
 * file previews, and validation.
 * 
 * @example
 * ```tsx
 * <FileUpload
 *   accept="image/*"
 *   maxSize={5 * 1024 * 1024}
 *   maxFiles={3}
 *   onChange={(files) => logger.debug('files', files)}
 *   showPreview
 * />
 * ```
 */
function FileUpload({
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 5,
  multiple = true,
  disabled = false,
  onChange,
  onRemove,
  onUpload,
  value,
  variant = "default",
  showPreview = true,
  imageDimensions,
  className,
  ...props
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isCompressing, _setIsCompressing] = React.useState(false);

  // Sync with controlled value
  React.useEffect(() => {
    if (value) {
      setFiles(
        value.map((file) => ({
          file,
          id: `${file.name}-${file.lastModified}`,
          progress: 100,
          status: "complete" as const,
          preview: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        }))
      );
    }
  }, [value]);

  // Cleanup previews on unmount
  React.useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only on unmount; files ref is captured at cleanup time
  }, []);

  const validateFileBasic = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`;
    }
    if (accept) {
      const acceptedTypes = accept.split(",").map((t) => t.trim());
      const isAccepted = acceptedTypes.some((type) => {
        if (type.startsWith(".")) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        if (type.endsWith("/*")) {
          return file.type.startsWith(type.replace("/*", "/"));
        }
        return file.type === type;
      });
      if (!isAccepted) {
        return `File "${file.name}" has an unsupported format`;
      }
    }
    return null;
  };

  const validateFile = async (file: File): Promise<string | null> => {
    // Basic validation (sync)
    const basicError = validateFileBasic(file);
    if (basicError) return basicError;

    // Image dimension validation (async)
    if (imageDimensions && file.type.startsWith("image/")) {
      const result = await validateImageDimensions(file, imageDimensions);
      if (!result.valid) {
        return `File "${file.name}": ${result.error}`;
      }
    }

    return null;
  };

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles || disabled) return;

    setError(null);
    const fileArray = Array.from(newFiles);

    // Check max files
    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate each file (including async dimension checks for images)
    const validFiles: File[] = [];
    for (const file of fileArray) {
      const validationError = await validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      validFiles.push(file);
    }

    // Skip compression for now - compression library not available
    const processedFiles = validFiles;

    // Create upload entries
    const newUploadedFiles: UploadedFile[] = processedFiles.map((file) => ({
      file,
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      progress: 0,
      status: onUpload ? "pending" : "complete",
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
    }));

    setFiles((prev) => [...prev, ...newUploadedFiles]);
    onChange?.(processedFiles);

    // Handle uploads if custom handler provided
    if (onUpload) {
      for (const uploadedFile of newUploadedFiles) {
        try {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id ? { ...f, status: "uploading" } : f
            )
          );

          await onUpload(uploadedFile.file, (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id ? { ...f, progress } : f
              )
            );
          });

          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? { ...f, status: "complete", progress: 100 }
                : f
            )
          );
        } catch (err) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? {
                    ...f,
                    status: "error",
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : f
            )
          );
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (id: string) => {
    const fileToRemove = files.find((f) => f.id === id);
    if (fileToRemove) {
      if (fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      onRemove?.(fileToRemove.file);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  // Button variant
  if (variant === "button") {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple && maxFiles > 1}
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
          disabled={disabled || isCompressing}
          aria-label="File upload"
          title="Choose files to upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={openFilePicker}
          disabled={disabled || isCompressing || files.length >= maxFiles}
          className="gap-2"
        >
          {isCompressing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Compressing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Choose Files
            </>
          )}
        </Button>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {files.length > 0 && (
          <FileList files={files} onRemove={handleRemove} showPreview={showPreview} />
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        <div
          className={cn(
            "flex items-center gap-4 p-3 border-2 border-dashed rounded-lg transition-colors cursor-pointer",
            isDragging && "border-primary bg-primary/5",
            (disabled || isCompressing) && "opacity-50 cursor-not-allowed",
            !disabled && !isCompressing && !isDragging && "hover:border-primary/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!disabled && !isCompressing ? openFilePicker : undefined}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple && maxFiles > 1}
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
            disabled={disabled || isCompressing}
            aria-label="File upload"
            title="Choose files to upload"
          />
          {isCompressing ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <div className="flex-1 text-sm">
            {isCompressing ? (
              <span className="text-muted-foreground">Compressing images...</span>
            ) : (
              <>
                <span className="font-medium text-primary">Click to upload</span>{" "}
                <span className="text-muted-foreground">or drag and drop</span>
              </>
            )}
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {files.length > 0 && (
          <FileList files={files} onRemove={handleRemove} showPreview={showPreview} compact />
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-all cursor-pointer",
          isDragging && "border-primary bg-primary/5 scale-[1.02]",
          (disabled || isCompressing) && "opacity-50 cursor-not-allowed",
          !disabled && !isCompressing && !isDragging && "hover:border-primary/50 hover:bg-muted/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!disabled && !isCompressing ? openFilePicker : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple && maxFiles > 1}
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
          disabled={disabled || isCompressing}
          aria-label="File upload"
          title="Choose files to upload"
        />

        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted mb-4">
          {isCompressing ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-medium">
            <span className="text-primary">Click to upload</span>{" "}
            <span className="text-muted-foreground">or drag and drop</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {accept ? `Accepted: ${accept}` : "All file types accepted"}
            {maxSize && ` • Max ${formatFileSize(maxSize)}`}
            {imageDimensions && ` • ${formatDimensionConstraints(imageDimensions)}`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {files.length > 0 && (
        <FileList files={files} onRemove={handleRemove} showPreview={showPreview} />
      )}
    </div>
  );
}

/**
 * FileList Component
 * Displays uploaded files with progress and status
 */
interface FileListProps {
  files: UploadedFile[];
  onRemove: (id: string) => void;
  showPreview?: boolean;
  compact?: boolean;
}

function FileList({ files, onRemove, showPreview = true, compact = false }: FileListProps) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      {files.map((uploadedFile) => {
        const FileIcon = getFileIcon(uploadedFile.file.type);
        const isImage = uploadedFile.file.type.startsWith("image/");

        return (
          <div
            key={uploadedFile.id}
            className={cn(
              "flex items-center gap-3 p-3 border rounded-lg bg-card",
              compact && "p-2 gap-2"
            )}
          >
            {/* Preview or Icon */}
            {showPreview && isImage && uploadedFile.preview ? (
              <img
                src={uploadedFile.preview}
                alt={uploadedFile.file.name}
                className={cn(
                  "object-cover rounded",
                  compact ? "h-8 w-8" : "h-12 w-12"
                )}
                loading="lazy"
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded bg-muted",
                  compact ? "h-8 w-8" : "h-12 w-12"
                )}
              >
                <FileIcon
                  className={cn(
                    "text-muted-foreground",
                    compact ? "h-4 w-4" : "h-6 w-6"
                  )}
                />
              </div>
            )}

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium truncate", compact && "text-sm")}>
                {uploadedFile.file.name}
              </p>
              <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                {formatFileSize(uploadedFile.file.size)}
              </p>
              {uploadedFile.status === "uploading" && (
                <Progress value={uploadedFile.progress} className="h-1 mt-1" />
              )}
              {uploadedFile.status === "error" && (
                <p className="text-xs text-destructive mt-1">{uploadedFile.error}</p>
              )}
            </div>

            {/* Status Icon */}
            <div className="flex items-center gap-2">
              {uploadedFile.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {uploadedFile.status === "complete" && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {uploadedFile.status === "error" && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              
              {/* Remove Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(uploadedFile.id);
                }}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { FileUpload, FileList, formatFileSize, getFileIcon };
export type { FileUploadProps, UploadedFile };
// Re-export compression utilities for convenience
export {
  compressImage,
  compressImageWithPreset,
  compressImages,
  isCompressibleImage,
  COMPRESSION_PRESETS,
  DEFAULT_COMPRESSION_OPTIONS,
} from "@/lib/utils/image-compression";
export type { ImageCompressionOptions, CompressionStats } from "@/lib/utils/image-compression";


