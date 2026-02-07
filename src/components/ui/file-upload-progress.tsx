import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadProgressProps {
  /** Upload handler that receives file and progress callback */
  onUpload: (
    file: File,
    onProgress: (percent: number) => void
  ) => Promise<string | void>;
  /** Called when upload completes successfully */
  onComplete?: (file: File, result?: string) => void;
  /** Called when upload fails */
  onError?: (file: File, error: Error) => void;
  /** Accepted file types */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Whether multiple files can be uploaded */
  multiple?: boolean;
  /** Custom class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

/**
 * File upload component with progress indication
 * 
 * @example
 * ```tsx
 * <FileUploadProgress
 *   onUpload={async (file, onProgress) => {
 *     const result = await uploadToStorage(file, onProgress);
 *     return result.url;
 *   }}
 *   onComplete={(file, url) => {
 *     console.log('Uploaded:', url);
 *   }}
 *   accept="image/*"
 *   maxSize={5 * 1024 * 1024} // 5MB
 * />
 * ```
 */
export function FileUploadProgress({
  onUpload,
  onComplete,
  onError,
  accept,
  maxSize,
  multiple = false,
  className,
  disabled = false,
}: FileUploadProgressProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        // Validate file size
        if (maxSize && file.size > maxSize) {
          const errorMsg = `File too large. Max size: ${formatBytes(maxSize)}`;
          setUploadingFiles(prev => [
            ...prev,
            { file, progress: 0, status: 'error', error: errorMsg },
          ]);
          onError?.(file, new Error(errorMsg));
          continue;
        }

        // Add to uploading list
        setUploadingFiles(prev => [
          ...prev,
          { file, progress: 0, status: 'uploading' },
        ]);

        try {
          // Upload with progress tracking
          const result = await onUpload(file, progress => {
            setUploadingFiles(prev =>
              prev.map(f =>
                f.file === file ? { ...f, progress } : f
              )
            );
          });

          // Mark as complete
          setUploadingFiles(prev =>
            prev.map(f =>
              f.file === file ? { ...f, progress: 100, status: 'complete' as const } : f
            )
          );

          onComplete?.(file, typeof result === 'string' ? result : undefined);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Upload failed';
          setUploadingFiles(prev =>
            prev.map(f =>
              f.file === file ? { ...f, status: 'error', error: errorMsg } : f
            )
          );
          onError?.(file, error as Error);
        }
      }
    },
    [onUpload, onComplete, onError, maxSize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(multiple ? files : [files[0]]);
      }
    },
    [disabled, multiple, handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      // Reset input
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeFile = useCallback((file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploadingFiles(prev => prev.filter(f => f.status === 'uploading'));
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={e => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop {multiple ? 'files' : 'a file'} here, or
        </p>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          Browse Files
        </Button>

        {maxSize && (
          <p className="text-xs text-muted-foreground mt-2">
            Max file size: {formatBytes(maxSize)}
          </p>
        )}
      </div>

      {/* File list with progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Uploads</span>
            {uploadingFiles.some(f => f.status !== 'uploading') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
              >
                Clear completed
              </Button>
            )}
          </div>

          {uploadingFiles.map((upload, index) => (
            <div
              key={`${upload.file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
            >
              <FileIcon status={upload.status} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {upload.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(upload.file.size)}
                </p>

                {upload.status === 'uploading' && (
                  <Progress value={upload.progress} className="h-1 mt-2" />
                )}

                {upload.status === 'error' && upload.error && (
                  <p className="text-xs text-destructive mt-1">{upload.error}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {upload.status === 'uploading' && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(upload.progress)}%
                  </span>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFile(upload.file)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ status }: { status: UploadingFile['status'] }) {
  switch (status) {
    case 'uploading':
      return <Loader2 className="h-8 w-8 text-primary animate-spin" />;
    case 'complete':
      return <CheckCircle className="h-8 w-8 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-8 w-8 text-destructive" />;
    default:
      return <File className="h-8 w-8 text-muted-foreground" />;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default FileUploadProgress;
